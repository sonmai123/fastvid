import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { fileURLToPath } from "url";

const app = express();
const PORT = 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use("/media", express.static(TMP_DIR));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Range");
  res.header("Accept-Ranges", "bytes");
  next();
});

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
    const url = new URL(filename);
    // If it's a URL, common video extensions
    return ".mp4";
  } catch {
    // It's a regular filename
    const ext = path.extname(filename).toLowerCase();
    return ext || ".mp4";
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

function runYtdlp(args) {
  return new Promise((resolve, reject) => {
    const ytdlpPath = path.join(__dirname, "yt-dlp.exe");
    if (!fs.existsSync(ytdlpPath)) {
      return reject(new Error(`yt-dlp binary not found at ${ytdlpPath}`));
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

app.get("/", (req, res) => {
  res.send("FastVid backend is running");
});

app.post("/api/upload", upload.single("video"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const ext = extFromFilename(req.file.originalname);
    const assetId = createAssetId();
    const filename = `${assetId}${ext}`;
    const finalPath = path.join(TMP_DIR, filename);

    fs.renameSync(req.file.path, finalPath);

    return res.json({
      assetId,
      filename,
      playbackUrl: `http://localhost:${PORT}/media/${filename}`,
      sourceType: "upload",
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return res.status(500).json({ error: "Upload failed." });
  }
});

app.post("/api/import-url", async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL." });
    }

    const normalizedUrl = url.trim();

    let response = await fetch(normalizedUrl, { method: "HEAD" });
    if (!response.ok || !response.headers.get("content-type")) {
      response = await fetch(normalizedUrl, { method: "GET" });
    }

    if (!response.ok) {
      return res.status(400).json({ error: "Could not fetch the video URL." });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("video/")) {
      return res.status(400).json({
        error: `The provided URL is not a direct video file. Content-Type: ${contentType}`,
      });
    }

    let ext = ".mp4";
    if (contentType.includes("webm")) ext = ".webm";
    if (contentType.includes("ogg")) ext = ".ogg";
    if (contentType.includes("quicktime")) ext = ".mov";

    const assetId = createAssetId();
    const filename = `${assetId}${ext}`;

    if (response.body && response.body.cancel) {
      response.body.cancel();
    }

    return res.json({
      assetId,
      filename,
      playbackUrl: normalizedUrl,
      sourceType: "url",
    });
  } catch (error) {
    console.error("IMPORT URL ERROR:", error);
    return res.status(500).json({ error: "Import URL failed." });
  }
});

app.post("/api/import-media", async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL." });
    }

    const assetId = createAssetId();
    const outputTemplate = path.join(TMP_DIR, `${assetId}.%(ext)s`);

    await runYtdlp([
      "-f",
      "best[ext=mp4]/best",
      "--no-progress",
      "-o",
      outputTemplate,
      url,
    ]);

    const downloadedFilename = fs.readdirSync(TMP_DIR).find((name) => name.startsWith(`${assetId}.`));
    if (!downloadedFilename) {
      return res.status(500).json({ error: "Imported media could not be saved." });
    }

    return res.json({
      assetId,
      filename: downloadedFilename,
      playbackUrl: `http://localhost:${PORT}/media/${downloadedFilename}`,
      sourceType: "media",
    });
  } catch (error) {
    console.error("IMPORT MEDIA ERROR:", error);
    return res.status(500).json({ error: error.message || "Import media failed." });
  }
});

app.post("/api/cut-video", async (req, res) => {
  try {
    const {
      inputUrl,
      originalFilename = "video.mp4",
      start,
      end,
      brightness = 0,
      contrast = 0,
      saturation = 0,
    } = req.body || {};

    if (!inputUrl || typeof inputUrl !== "string") {
      return res.status(400).json({ error: "Missing inputUrl." });
    }

    const startNum = Number(start);
    const endNum = Number(end);

    if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) {
      return res.status(400).json({ error: "Invalid start/end." });
    }

    if (startNum < 0 || endNum <= startNum) {
      return res.status(400).json({ error: "Invalid trim range." });
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
        return res.status(404).json({ error: "Source video not found on server." });
      }
    }

    const outputId = createAssetId();
    const ext = extFromFilename(originalFilename || inputFilename);
    const outputFilename = `${outputId}${ext}`;
    const outputPath = path.join(TMP_DIR, outputFilename);

    const brightnessValue = 1 + Number(brightness) / 100;
    const contrastValue = 1 + Number(contrast) / 100;
    const saturationValue = 1 + Number(saturation) / 100;

    const eqFilter = `eq=brightness=${(brightnessValue - 1).toFixed(3)}:contrast=${contrastValue.toFixed(3)}:saturation=${saturationValue.toFixed(3)}`;

    const args = [
      "-y",
      "-ss",
      String(startNum),
      "-to",
      String(endNum),
      "-i",
      inputPath,
      "-vf",
      eqFilter,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    await runFfmpeg(args);

    return res.json({
      id: outputId,
      name: `trimmed_video_${outputId.slice(0, 6)}`,
      outputFilename,
      outputUrl: `http://localhost:${PORT}/media/${outputFilename}`,
      start: Number(startNum.toFixed(1)),
      end: Number(endNum.toFixed(1)),
    });
  } catch (error) {
    console.error("CUT VIDEO ERROR:", error);
    return res.status(500).json({
      error: error.message || "Cut video failed.",
    });
  }
});
app.post("/api/extract-audio", async (req, res) => {
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

    return res.json({
      id: outputId,
      name: `${path.parse(originalFilename).name || "audio"}_audio`,
      outputFilename,
      outputUrl: `http://localhost:${PORT}/media/${outputFilename}`,
    });
  } catch (error) {
    console.error("EXTRACT AUDIO ERROR:", error);
    return res.status(500).json({
      error: error.message || "Extract audio failed.",
    });
  }
});
app.listen(PORT, () => {
  console.log(`FastVid API running at http://localhost:${PORT}`);
});