import { useEffect, useState } from "react";
import Editor from "./components/Editor";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");
const STORAGE_KEY = "fastvid_auth";

const normalizeMediaUrl = (url) => {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^https?:\/\/localhost(?::\d+)?/i.test(trimmed)) {
    return trimmed.replace(/^https:/i, "http:");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `http:${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `${API_BASE}${trimmed}`;
  }

  return `${API_BASE}/${trimmed.replace(/^\.?\//, "")}`;
};

const normalizeVideoItem = (item = {}) => {
  const playbackUrl = normalizeMediaUrl(item.playbackUrl || item.src || item.url || "");
  const thumbnailUrl = normalizeMediaUrl(
    item.thumbnailUrl || item.poster || item.thumbnail || ""
  );

  return {
    ...item,
    src: playbackUrl,
    playbackUrl,
    thumbnailUrl,
    poster: thumbnailUrl,
    filename: item.filename || item.originalName || "Uploaded Video",
  };
};

export default function App() {
  const [video, setVideo] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const clearAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken("");
    setUploadedVideos([]);
  };

  const fetchUploadedVideos = async (authToken) => {
    const bearer = authToken || token;
    if (!bearer) return;

    try {
      setLoadingVideos(true);
      const res = await fetch(`${API_BASE}/api/videos`, {
        headers: {
          Authorization: `Bearer ${bearer}`,
        },
      });

      if (!res.ok) {
        throw new Error("Unable to load uploaded videos.");
      }

      const data = await res.json();
      const normalizedVideos = Array.isArray(data.videos)
        ? data.videos.map((item) => normalizeVideoItem(item))
        : [];

      setUploadedVideos(normalizedVideos);
    } catch (err) {
      console.warn("Load uploaded videos failed:", err);
      setUploadedVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError("");
    setStatus("Signing out...");

    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: {
          ...authHeaders,
        },
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      clearAuth();
      setLoading(false);
      setStatus("");
    }
  };

  const saveAuth = (userData, authToken) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: userData, token: authToken }));
    setUser(userData);
    setToken(authToken);
  };

  const parseResponse = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text || `${res.status} ${res.statusText}` };
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    let parsed;
    try {
      parsed = JSON.parse(saved);
    } catch {
      clearAuth();
      return;
    }

    if (!parsed?.token) {
      clearAuth();
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${parsed.token}` },
        });

        if (!res.ok) {
          clearAuth();
          return;
        }

        const data = await parseResponse(res);
        setUser(data.user);
        setToken(parsed.token);
        await fetchUploadedVideos(parsed.token);
      } catch (err) {
        clearAuth();
      }
    };

    verifyToken();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchUploadedVideos(token);
  }, [token]);

  const handleAuthSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      setStatus(authMode === "login" ? "Signing in..." : "Creating account...");

      const payload =
        authMode === "login"
          ? { email, password }
          : { email, password, displayName };

      const res = await fetch(`${API_BASE}/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || "Authentication failed.");

      saveAuth(data.user, data.token);
      await fetchUploadedVideos(data.token);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setStatus("");
    } catch (err) {
      setError(err.message || "Authentication failed.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError("");
      setStatus("Uploading video...");

      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: {
          ...authHeaders,
        },
        body: formData,
      });

      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      await fetchUploadedVideos();

      const normalizedVideo = normalizeVideoItem({
        ...data,
        filename: data.originalName || data.filename,
      });

      console.log("Uploaded video:", normalizedVideo);
      setVideo(normalizedVideo);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const handleLoadUrl = async () => {
    if (!url.trim()) return;

    try {
      setLoading(true);
      setError("");

      const isPlatformUrl =
        /(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vt\.tiktok\.com)/i.test(
          url.trim()
        );

      const endpoint = isPlatformUrl ? "/api/import-media" : "/api/import-url";
      setStatus(
        isPlatformUrl
          ? "Resolving platform stream and loading playback..."
          : "Resolving direct video stream..."
      );

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || "Import failed.");

      await fetchUploadedVideos();

      const normalizedVideo = normalizeVideoItem({
        ...data,
        filename: data.originalName || data.filename,
      });

      console.log("Imported video:", normalizedVideo);
      setVideo(normalizedVideo);
    } catch (err) {
      setError(err.message || "Import failed.");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const appRootClass = isDarkMode
    ? "min-h-screen bg-black text-white"
    : "min-h-screen bg-[#ACFFFC] text-slate-900";
  const loginCardClass = isDarkMode ? "bg-[#1d1d1d]" : "bg-white shadow-lg";
  const mainPageBg = isDarkMode ? "bg-[#050505] text-white" : "bg-[#E6FFFF] text-slate-900";
  const loginInputClass = isDarkMode
    ? "mt-2 w-full rounded-2xl border border-gray-700 bg-[#111111] px-4 py-3 text-white outline-none"
    : "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none";
  const loginLabelClass = isDarkMode ? "block text-sm text-gray-400" : "block text-sm text-slate-700";
  const mainHeaderClass = isDarkMode
    ? "mb-6 flex flex-col gap-4 rounded-[30px] border border-white/10 bg-[#111111] p-5 md:flex-row md:items-center md:justify-between"
    : "mb-6 flex flex-col gap-4 rounded-[30px] border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between";

  return (
    <div className={appRootClass}>
      {!user ? (
        <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col items-center justify-center px-6 py-10">
          <div className="mb-8 flex h-24 w-full items-center justify-center">
            <img
              src="/FastVid_Logo.png"
              alt="FastVid Logo"
              className="max-h-full w-auto max-w-[420px] object-contain"
            />
          </div>

          <div className={`w-full max-w-[500px] space-y-6 rounded-[40px] px-8 py-10 shadow-xl ${loginCardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="text-3xl font-semibold">
                {authMode === "login" ? "Sign in to FastVid" : "Create your account"}
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
              >
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={loginLabelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={loginInputClass}
                />
              </div>

              <div>
                <label className={loginLabelClass}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={loginInputClass}
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label className={loginLabelClass}>Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={loginInputClass}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleAuthSubmit}
              disabled={loading}
              className="w-full rounded-full bg-orange-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {loading ? "Working..." : authMode === "login" ? "Sign in" : "Create account"}
            </button>

            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setError("");
              }}
              className="w-full rounded-full border border-gray-700 bg-transparent px-6 py-4 text-sm text-white hover:border-white"
            >
              {authMode === "login" ? "Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      ) : !video ? (
        <div className={`min-h-screen px-6 py-8 ${mainPageBg}`}>
          <div className="mx-auto w-full max-w-[1800px]">
            <div className={mainHeaderClass}>
              <div>
                <img src="/FastVid_Logo.png" alt="FastVid Logo" className="h-16 w-auto" />
                <p className={isDarkMode ? "mt-2 text-sm text-gray-400" : "mt-2 text-sm text-slate-700"}>
                  FastVid dashboard: upload, select, and trim faster.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
              >
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-white/5 px-4 py-3 text-sm text-gray-300">
                  Signed in as <span className="font-semibold text-white">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px_280px]">
              <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Uploaded Videos</div>
                    <div className="text-sm text-gray-500">Click a thumbnail to open the editor.</div>
                  </div>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-300">
                    {uploadedVideos.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[760px] overflow-y-auto pr-2">
                  {loadingVideos ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-[#111111] p-6 text-center text-sm text-gray-400">
                      Loading uploaded videos...
                    </div>
                  ) : uploadedVideos.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-[#111111] p-6 text-center text-sm text-gray-400">
                      No uploaded videos yet.
                    </div>
                  ) : (
                    uploadedVideos.map((item) => {
                      const normalizedItem = normalizeVideoItem(item);
                      const itemKey =
                        normalizedItem.id ||
                        normalizedItem.playbackUrl ||
                        normalizedItem.src ||
                        normalizedItem.filename ||
                        "video";

                      return (
                        <button
                          key={itemKey}
                          type="button"
                          onClick={() => {
                            console.log("Selected video:", normalizedItem);
                            setVideo(normalizedItem);
                          }}
                          className="group flex w-full items-start gap-3 rounded-3xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-orange-500 hover:bg-white/10"
                        >
                          <div className="h-20 w-28 overflow-hidden rounded-2xl bg-[#0f0f0f]">
                            <img
                              src={normalizedItem.thumbnailUrl || normalizedItem.src}
                              alt={normalizedItem.filename || "Video thumbnail"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {normalizedItem.filename || normalizedItem.originalName || "Uploaded video"}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              {normalizedItem.duration
                                ? `${Math.floor(normalizedItem.duration / 60)}:${String(
                                    Math.floor(normalizedItem.duration % 60)
                                  ).padStart(2, "0")}${
                                    normalizedItem.originalFormat
                                      ? ` · ${normalizedItem.originalFormat.toUpperCase()}`
                                      : ""
                                  }`
                                : normalizedItem.originalFormat || "Imported file"}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
                <div className="mb-5">
                  <div className="text-lg font-semibold">Upload or Load URL</div>
                  <div className="text-sm text-gray-500">Upload a local file or import a video link.</div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl bg-[#111111] p-5">
                    <div className="mb-3 text-sm text-gray-400">Paste video URL</div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder="YouTube, TikTok, Facebook, or direct MP4"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="h-14 w-full rounded-3xl border border-white/10 bg-[#0f0f0f] px-4 text-sm text-white outline-none"
                      />
                      <button
                        onClick={handleLoadUrl}
                        disabled={loading}
                        className="h-14 rounded-3xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                      >
                        {loading ? "Loading..." : "Load URL"}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      {status || "Imported video links are resolved and then made ready for trimming."}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#111111] p-5">
                    <div className="mb-3 text-sm text-gray-400">Upload from your device</div>
                    <label className="flex min-h-[250px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#0f0f0f] p-6 text-center text-sm text-gray-400 transition hover:border-orange-500 hover:text-white">
                      <span className="text-5xl">⤴</span>
                      <span className="mt-4 block text-white">Choose a video file</span>
                      <span className="mt-2 text-xs text-gray-500">MP4, WebM, MOV, or other common formats</span>
                      <input type="file" accept="video/*" hidden onChange={handleUpload} />
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
                <div className="mb-5">
                  <div className="text-lg font-semibold">Quick actions</div>
                  <div className="text-sm text-gray-500">Open the editor or review recent activity.</div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl bg-[#111111] p-4 text-sm text-gray-300">
                    <div className="mb-2 text-gray-400">You can also:</div>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-gray-300">
                      <li>Upload a new file</li>
                      <li>Paste a platform URL</li>
                      <li>Click any uploaded thumbnail</li>
                    </ul>
                  </div>
                  <div className="rounded-3xl bg-[#111111] p-4 text-sm text-gray-300">
                    <div className="mb-2 text-gray-400">Tip</div>
                    <p>Once a video is selected, the editor page opens with trimming, filters, and export controls.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
                <div className="mb-5">
                  <div className="text-lg font-semibold">Account summary</div>
                  <div className="text-sm text-gray-500">Keep your uploads in one place.</div>
                </div>
                <div className="space-y-4 rounded-3xl bg-[#111111] p-5 text-sm text-gray-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Videos uploaded</span>
                    <span className="font-semibold text-white">{uploadedVideos.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Current status</span>
                    <span className="text-white">{loading ? "Busy" : "Ready"}</span>
                  </div>
                  <div className="text-gray-400">
                    Your uploaded videos will appear on the left. Click one to start editing.
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <Editor
          video={video}
          onBack={() => setVideo(null)}
          token={token}
          uploadedVideos={uploadedVideos}
          onSelectVideo={(nextVideo) => setVideo(normalizeVideoItem(nextVideo))}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}
    </div>
  );
}