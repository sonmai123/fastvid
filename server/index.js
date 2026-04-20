import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

// Build DATABASE_URL from separate MongoDB env vars when provided.
if (!process.env.DATABASE_URL) {
  const { MONGO_USER, MONGO_PASS, MONGO_HOST, MONGO_DB } = process.env;
  if (MONGO_USER && MONGO_PASS && MONGO_HOST && MONGO_DB) {
    process.env.DATABASE_URL = `mongodb+srv://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}@${MONGO_HOST}/${MONGO_DB}?retryWrites=true&w=majority`;
  }
}

const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-a-strong-secret';
const TMP_DIR = path.join(__dirname, "tmp");

const prisma = new PrismaClient({ log: ["error", "warn"] });
const app = express();

function getBaseUrl(req) {
  const host = req.get("host");

  if (host && host.includes("localhost")) {
    return `http://${host}`;
  }

  const forwardedProto = String(
    req.headers["x-forwarded-proto"] ||
    req.headers["x-forwarded-protocol"] ||
    req.protocol ||
    "https"
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  const protocol = forwardedProto === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Range"],
  exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
  optionsSuccessStatus: 204,
  preflightContinue: false,
  credentials: true,
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
app.use("/media", express.static(TMP_DIR));

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

function createAssetId() {
  return crypto.randomBytes(12).toString("hex");
}

function extFromFilename(filename = "") {
  if (!filename) return ".mp4";
  try {
    new URL(filename);
    return ".mp4";
  } catch {
    const ext = path.extname(filename).toLowerCase();
    return ext || ".mp4";
  }
}

function normalizeFormat(ext = "") {
  return ext.replace('.', '').toUpperCase() || 'MP4';
}

function extractFilenameFromContentDisposition(header) {
  if (!header || typeof header !== 'string') return null;

  const filenameMatch = header.match(/filename\*=(?:UTF-8'')?"?([^";]+)"?/i);
  if (filenameMatch && filenameMatch[1]) {
    return decodeURIComponent(filenameMatch[1].trim());
  }

  const fallbackMatch = header.match(/filename="?([^";]+)"?/i);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].trim();
  }

  return null;
}

function getOriginalNameFromUrl(url, fallback = 'imported_video.mp4', contentDisposition) {
  try {
    const parsed = new URL(url);
    const filenameFromHeader = extractFilenameFromContentDisposition(contentDisposition);
    if (filenameFromHeader) {
      return filenameFromHeader;
    }

    const base = path.basename(parsed.pathname || '');
    return decodeURIComponent(base || fallback);
  } catch {
    return fallback;
  }
}

function isRemoteUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authorization required. Use Bearer token.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired.' });
      }
      return res.status(401).json({ error: 'Invalid authorization token.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: 'Token user not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('AUTH MIDDLEWARE ERROR:', error);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

function getScaleFilter(resolution) {
  const scales = {
    '144p': '256:144',
    '240p': '426:240',
    '360p': '640:360',
    '480p': '854:480',
    '720p': '1280:720',
    '1080p': '1920:1080',
    '4k': '3840:2160',
  };
  return scales[resolution] ? `scale=${scales[resolution]}` : null;
}

function runYtdlp(args) {
  return new Promise((resolve, reject) => {
    const localYtdlpPath = path.join(
      __dirname,
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
    );
    const ytdlpPath = fs.existsSync(localYtdlpPath) ? localYtdlpPath : "yt-dlp";

    if (process.platform === "win32" && !fs.existsSync(localYtdlpPath)) {
      return reject(new Error(`yt-dlp binary not found at ${localYtdlpPath}`));
    }

    const yt = spawn(ytdlpPath, ["--js-runtimes", "deno", ...args], {
      windowsHide: true,
    });

    let stderr = "";
    let stdout = "";

    yt.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    yt.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    yt.on("error", (error) => {
      reject(error);
    });

    yt.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, {
      windowsHide: true,
    });

    let stderr = "";
    let stdout = "";

    ff.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ff.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ff.on("error", (error) => {
      reject(error);
    });

    ff.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `FFmpeg exited with code ${code}`));
      }
    });
  });
}

function sanitizeFilename(name) {
  return String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[-\s]+|[-\s]+$/g, '');
}

async function getYtdlpMetadata(url) {
  const { stdout } = await runYtdlp(["--dump-single-json", "--no-playlist", "--no-progress", url]);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`yt-dlp metadata parse failed: ${error.message}`);
  }
}

async function downloadRemoteFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download remote asset: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destination, Buffer.from(buffer));
}

async function createVideoThumbnail(source, filename) {
  const thumbnailPath = path.join(TMP_DIR, filename);
  await runFfmpeg([
    '-y',
    '-ss', '00:00:01',
    '-i', source,
    '-frames:v', '1',
    '-q:v', '2',
    '-vf', 'scale=360:-2',
    thumbnailPath,
  ]);
  return thumbnailPath;
}

app.get('/', (_req, res) => {
  res.send('FastVid backend is running');
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (rawPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: displayName?.trim() || null,
      },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    return res.status(201).json({ user, token: signAccessToken(user) });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    return res.status(500).json({ error: 'Register failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const dbUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!dbUser) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(rawPassword, dbUser.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    return res.json({ user: { id: dbUser.id, email: dbUser.email, displayName: dbUser.displayName }, token: signAccessToken(dbUser) });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json({ user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName } });
});

app.post('/api/auth/logout', requireAuth, async (_req, res) => {
  return res.json({ success: true, message: 'Logout successful.' });
});

app.get('/api/videos', requireAuth, async (req, res) => {
  try {
    const videos = await prisma.video.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        assetId: true,
        storedFilename: true,
        originalName: true,
        originalFormat: true,
        playbackUrl: true,
        thumbnailUrl: true,
        sourceType: true,
        fileSize: true,
        durationSec: true,
        createdAt: true,
      },
    });

    return res.json({ videos });
  } catch (error) {
    console.error('GET VIDEOS ERROR:', error);
    return res.status(500).json({ error: 'Could not load videos.' });
  }
});

app.patch('/api/videos/:videoId', requireAuth, async (req, res) => {
  try {
    const nextName = String((req.body || {}).originalName || '').trim();
    if (!nextName) {
      return res.status(400).json({ error: 'New name is required.' });
    }

    const video = await prisma.video.findFirst({ where: { id: req.params.videoId, userId: req.user.id } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: { originalName: nextName },
      select: {
        id: true,
        assetId: true,
        storedFilename: true,
        originalName: true,
        originalFormat: true,
        playbackUrl: true,
        thumbnailUrl: true,
        sourceType: true,
        fileSize: true,
        durationSec: true,
        createdAt: true,
      },
    });

    return res.json({ video: updated });
  } catch (error) {
    console.error('RENAME VIDEO ERROR:', error);
    return res.status(500).json({ error: 'Rename video failed.' });
  }
});

app.delete('/api/videos/:videoId', requireAuth, async (req, res) => {
  try {
    const video = await prisma.video.findFirst({ where: { id: req.params.videoId, userId: req.user.id } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    await prisma.video.delete({ where: { id: video.id } });
    safeUnlink(video.storedFilename ? path.join(TMP_DIR, video.storedFilename) : '');
    safeUnlink(video.thumbnailFilename ? path.join(TMP_DIR, video.thumbnailFilename) : '');

    return res.json({ success: true, deletedVideoId: video.id });
  } catch (error) {
    console.error('DELETE VIDEO ERROR:', error);
    return res.status(500).json({ error: 'Delete video failed.' });
  }
});

app.post('/api/upload', requireAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const ext = extFromFilename(req.file.originalname);
    const assetId = createAssetId();
    const filename = `${assetId}${ext}`;
    const finalPath = path.join(TMP_DIR, filename);

    fs.renameSync(req.file.path, finalPath);
    const baseUrl = getBaseUrl(req);
    const thumbnailFilename = `${assetId}-thumb.jpg`;
    const thumbnailUrl = `${baseUrl}/media/${thumbnailFilename}`;

    let newVideo = await prisma.video.create({
      data: {
        userId: req.user.id,
        assetId,
        storedFilename: filename,
        originalName: req.file.originalname,
        originalFormat: normalizeFormat(ext),
        playbackUrl: `${baseUrl}/media/${filename}`,
        thumbnailUrl: null,
        thumbnailFilename: null,
        sourceType: 'upload',
        fileSize: req.file.size,
      },
      select: {
        id: true,
        assetId: true,
        storedFilename: true,
        originalName: true,
        originalFormat: true,
        playbackUrl: true,
        thumbnailUrl: true,
        thumbnailFilename: true,
        sourceType: true,
        fileSize: true,
        durationSec: true,
        createdAt: true,
      },
    });

    try {
      await createVideoThumbnail(finalPath, thumbnailFilename);
      newVideo = await prisma.video.update({
        where: { id: newVideo.id },
        data: {
          thumbnailUrl,
          thumbnailFilename,
        },
        select: {
          id: true,
          assetId: true,
          storedFilename: true,
          originalName: true,
          originalFormat: true,
          playbackUrl: true,
          thumbnailUrl: true,
          thumbnailFilename: true,
          sourceType: true,
          fileSize: true,
          durationSec: true,
          createdAt: true,
        },
      });
    } catch (thumbError) {
      console.warn('VIDEO THUMBNAIL ERROR:', thumbError);
    }

    return res.json(newVideo);
  } catch (error) {
    console.error('UPLOAD ERROR:', error);
    return res.status(500).json({ error: 'Upload failed.' });
  }
});

app.post('/api/import-url', requireAuth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing URL.' });
    }

    let normalizedUrl = url.trim();
    try {
      normalizedUrl = new URL(normalizedUrl).href;
    } catch {
      // leave the raw URL if it cannot be normalized
    }

    const existing = await prisma.video.findFirst({
      where: {
        userId: req.user.id,
        sourceType: 'url',
        playbackUrl: normalizedUrl,
      },
      select: {
        id: true,
        assetId: true,
        storedFilename: true,
        originalName: true,
        originalFormat: true,
        playbackUrl: true,
        thumbnailUrl: true,
        sourceType: true,
        fileSize: true,
        durationSec: true,
        createdAt: true,
      },
    });

    if (existing) {
      return res.json(existing);
    }

    let response = await fetch(normalizedUrl, { method: 'HEAD' });
    if (!response.ok || !response.headers.get('content-type')) {
      response = await fetch(normalizedUrl, { method: 'GET' });
    }

    if (!response.ok) {
      return res.status(400).json({ error: 'Could not fetch the video URL.' });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('video/')) {
      return res.status(400).json({ error: `The provided URL is not a direct video file. Content-Type: ${contentType}` });
    }

    let ext = '.mp4';
    if (contentType.includes('webm')) ext = '.webm';
    if (contentType.includes('ogg')) ext = '.ogg';
    if (contentType.includes('quicktime')) ext = '.mov';

    const assetId = createAssetId();
    const originalName = getOriginalNameFromUrl(normalizedUrl, `${assetId}${ext}`, response.headers.get('content-disposition'));
    const thumbnailFilename = `${assetId}-thumb.jpg`;
    const baseUrl = getBaseUrl(req);
    const thumbnailUrl = `${baseUrl}/media/${thumbnailFilename}`;

    let video = await prisma.video.create({
      data: {
        userId: req.user.id,
        assetId,
        storedFilename: null,
        originalName,
        originalFormat: normalizeFormat(ext),
        playbackUrl: normalizedUrl,
        thumbnailUrl: null,
        thumbnailFilename: null,
        sourceType: 'url',
      },
      select: {
        id: true,
        assetId: true,
        storedFilename: true,
        originalName: true,
        originalFormat: true,
        playbackUrl: true,
        thumbnailUrl: true,
        thumbnailFilename: true,
        sourceType: true,
        fileSize: true,
        durationSec: true,
        createdAt: true,
      },
    });

    try {
      await createVideoThumbnail(normalizedUrl, thumbnailFilename);
      video = await prisma.video.update({
        where: { id: video.id },
        data: {
          thumbnailUrl,
          thumbnailFilename,
        },
        select: {
          id: true,
          assetId: true,
          storedFilename: true,
          originalName: true,
          originalFormat: true,
          playbackUrl: true,
          thumbnailUrl: true,
          thumbnailFilename: true,
          sourceType: true,
          fileSize: true,
          durationSec: true,
          createdAt: true,
        },
      });
    } catch (thumbError) {
      console.warn('IMPORT URL THUMBNAIL ERROR:', thumbError);
    }

    return res.json(video);
  } catch (error) {
    console.error('IMPORT URL ERROR:', error);
    return res.status(500).json({ error: 'Import URL failed.' });
  }
});

app.post('/api/import-media', requireAuth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing URL.' });
    }

    let normalizedUrl = url.trim();
    try {
      normalizedUrl = new URL(normalizedUrl).href;
    } catch {
      // leave the raw URL if it cannot be normalized
    }

    const metadata = await getYtdlpMetadata(normalizedUrl);
    const assetId = createAssetId();
    const outputTemplate = path.join(TMP_DIR, `${assetId}.%(ext)s`);

    await runYtdlp(['-f', 'best[ext=mp4]/best', '--no-progress', '-o', outputTemplate, normalizedUrl]);

    const downloadedFilename = fs.readdirSync(TMP_DIR).find((name) => name.startsWith(`${assetId}.`));
    if (!downloadedFilename) {
      return res.status(500).json({ error: 'Imported media could not be saved.' });
    }

    const downloadedExt = path.extname(downloadedFilename);
    const metadataTitle = metadata?.title || metadata?.fulltitle || metadata?.filename || metadata?.id || path.basename(downloadedFilename, downloadedExt);
    const safeTitle = sanitizeFilename(metadataTitle) || `video-${assetId}`;
    const originalName = `${safeTitle}${downloadedExt}`;
    const uploaderName = metadata?.uploader || metadata?.uploader_id || metadata?.channel || null;
    const durationSeconds = Number(metadata?.duration) || null;
    const thumbnailSource = metadata?.thumbnail || null;
    const baseUrl = getBaseUrl(req);
    const thumbnailFilename = `${assetId}-thumb.jpg`;
    const thumbnailUrl = `${baseUrl}/media/${thumbnailFilename}`;

    let video = await prisma.video.create({
      data: {
        userId: req.user.id,
        assetId,
        storedFilename: downloadedFilename,
        originalName,
        originalFormat: normalizeFormat(downloadedExt),
        playbackUrl: `${baseUrl}/media/${downloadedFilename}`,
        durationSec: durationSeconds,
        thumbnailUrl: null,
        thumbnailFilename: null,
        sourceType: 'media',
      },
      select: {
        id: true,
        assetId: true,
        storedFilename: true,
        originalName: true,
        originalFormat: true,
        playbackUrl: true,
        thumbnailUrl: true,
        thumbnailFilename: true,
        sourceType: true,
        fileSize: true,
        durationSec: true,
        createdAt: true,
      },
    });

    try {
      if (thumbnailSource) {
        await downloadRemoteFile(thumbnailSource, path.join(TMP_DIR, thumbnailFilename));
      } else {
        await createVideoThumbnail(path.join(TMP_DIR, downloadedFilename), thumbnailFilename);
      }
      video = await prisma.video.update({
        where: { id: video.id },
        data: {
          thumbnailUrl,
          thumbnailFilename,
        },
        select: {
          id: true,
          assetId: true,
          storedFilename: true,
          originalName: true,
          originalFormat: true,
          playbackUrl: true,
          thumbnailUrl: true,
          thumbnailFilename: true,
          sourceType: true,
          fileSize: true,
          durationSec: true,
          createdAt: true,
        },
      });
    } catch (thumbError) {
      console.warn('IMPORT MEDIA THUMBNAIL ERROR:', thumbError);
    }

    return res.json(video);
  } catch (error) {
    console.error('IMPORT MEDIA ERROR:', error);
    return res.status(500).json({ error: error.message || 'Import media failed.' });
  }
});

app.post('/api/cut-video', requireAuth, async (req, res) => {
  try {
    const { inputUrl, originalFilename = 'video.mp4', start, end, brightness = 0, contrast = 0, saturation = 0, resolution = 'original' } = req.body || {};
    if (!inputUrl || typeof inputUrl !== 'string') {
      return res.status(400).json({ error: 'Missing inputUrl.' });
    }

    const startNum = Number(start);
    const endNum = Number(end);
    if (!Number.isFinite(startNum) || !Number.isFinite(endNum) || startNum < 0 || endNum <= startNum) {
      return res.status(400).json({ error: 'Invalid trim range.' });
    }

    let inputPath;
    if (isRemoteUrl(inputUrl)) {
      inputPath = inputUrl;
    } else {
      const inputFilename = decodeURIComponent(inputUrl.split('/media/')[1] || '');
      if (!inputFilename) {
        return res.status(400).json({ error: 'Invalid inputUrl.' });
      }
      inputPath = path.join(TMP_DIR, inputFilename);
      if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Source video not found on server.' });
      }
    }

    const outputId = createAssetId();
    const ext = extFromFilename(originalFilename);
    const outputFilename = `${outputId}${ext}`;
    const outputPath = path.join(TMP_DIR, outputFilename);

    const brightnessValue = 1 + Number(brightness) / 100;
    const contrastValue = 1 + Number(contrast) / 100;
    const saturationValue = 1 + Number(saturation) / 100;
    let vfFilters = [`eq=brightness=${(brightnessValue - 1).toFixed(3)}:contrast=${contrastValue.toFixed(3)}:saturation=${saturationValue.toFixed(3)}`];

    const scaleFilter = getScaleFilter(resolution);
    console.log('CUT VIDEO - resolution:', resolution, 'scaleFilter:', scaleFilter);
    if (scaleFilter) {
      vfFilters.push(scaleFilter);
    }
    console.log('CUT VIDEO - vfFilters:', vfFilters.join(','));

    await runFfmpeg(['-y', '-ss', String(startNum), '-to', String(endNum), '-i', inputPath, '-vf', vfFilters.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outputPath]);

    const baseUrl = getBaseUrl(req);
    return res.json({
      id: outputId,
      name: `trimmed_video_${outputId.slice(0, 6)}`,
      outputFilename,
      outputUrl: `${baseUrl}/media/${outputFilename}`,
      start: Number(startNum.toFixed(1)),
      end: Number(endNum.toFixed(1)),
    });
  } catch (error) {
    console.error('CUT VIDEO ERROR:', error);
    return res.status(500).json({ error: error.message || 'Cut video failed.' });
  }
});
app.post('/api/extract-audio', requireAuth, async (req, res) => {
  try {
    const {
      inputUrl,
      originalFilename = "video.mp4",
    } = req.body || {};

    if (!inputUrl || typeof inputUrl !== "string") {
      return res.status(400).json({ error: "Missing inputUrl." });
    }

    let inputPath;

    if (isRemoteUrl(inputUrl)) {
      inputPath = inputUrl;
    } else {
      const inputFilename = decodeURIComponent(inputUrl.split("/media/")[1] || "");
      if (!inputFilename) {
        return res.status(400).json({ error: "Invalid inputUrl." });
      }

      inputPath = path.join(TMP_DIR, inputFilename);
      if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: "Source media not found on server." });
      }
    }

    const outputId = createAssetId();
    const outputFilename = `${outputId}.mp3`;
    const outputPath = path.join(TMP_DIR, outputFilename);

    const args = [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "2",
      outputPath,
    ];

    await runFfmpeg(args);

    const baseUrl = getBaseUrl(req);
    return res.json({
      id: outputId,
      name: `${path.parse(originalFilename).name || "audio"}_audio`,
      outputFilename,
      outputUrl: `${baseUrl}/media/${outputFilename}`,
    });
  } catch (error) {
    console.error("EXTRACT AUDIO ERROR:", error);
    return res.status(500).json({
      error: error.message || "Extract audio failed.",
    });
  }
});

app.post('/api/convert-video', requireAuth, async (req, res) => {
  try {
    const {
      inputUrl,
      originalFilename = "video.mp4",
      outputFormat = "mp4",
      resolution = "original",
    } = req.body || {};

    if (!inputUrl || typeof inputUrl !== "string") {
      return res.status(400).json({ error: "Missing inputUrl." });
    }

    const normalizedFormat = String(outputFormat || "mp4").trim().toLowerCase();
    const supportedFormats = ["mp4", "webm", "mov"];
    if (!supportedFormats.includes(normalizedFormat)) {
      return res.status(400).json({ error: "Unsupported output format." });
    }

    let inputPath;

    if (isRemoteUrl(inputUrl)) {
      inputPath = inputUrl;
    } else {
      const inputFilename = decodeURIComponent(inputUrl.split("/media/")[1] || "");
      if (!inputFilename) {
        return res.status(400).json({ error: "Invalid inputUrl." });
      }

      inputPath = path.join(TMP_DIR, inputFilename);
      if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: "Source media not found on server." });
      }
    }

    const outputId = createAssetId();
    const outputFilename = `${outputId}.${normalizedFormat}`;
    const outputPath = path.join(TMP_DIR, outputFilename);
    const args = ["-y", "-i", inputPath];

    const scaleFilter = getScaleFilter(resolution);
    console.log('CONVERT VIDEO - resolution:', resolution, 'scaleFilter:', scaleFilter);
    if (scaleFilter) {
      args.push("-vf", scaleFilter);
    }
    console.log('CONVERT VIDEO - args:', args);

    if (normalizedFormat === "webm") {
      args.push("-c:v", "libvpx", "-b:v", "1M", "-c:a", "libvorbis");
    } else {
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac");
    }

    args.push(outputPath);
    await runFfmpeg(args);

    const baseUrl = getBaseUrl(req);
    return res.json({
      id: outputId,
      name: `${path.parse(originalFilename).name || "video"}`,
      outputFilename,
      outputUrl: `${baseUrl}/media/${outputFilename}`,
    });
  } catch (error) {
    console.error("CONVERT VIDEO ERROR:", error);
    return res.status(500).json({
      error: error.message || "Convert video failed.",
    });
  }
});

async function startServer() {
  try {
    console.log(`Starting FastVid API on port ${PORT}...`);
    await prisma.$connect();
    console.log("✅ MongoDB connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`FastVid API running at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("❌ FastVid startup failed:", error);
    console.error("Please check your DATABASE_URL or MONGO_* environment variables");
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

startServer();