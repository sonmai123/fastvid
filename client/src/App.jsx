import { useState } from "react";
import Editor from "./components/Editor";

const API_BASE = "http://localhost:5000";

export default function App() {
  const [video, setVideo] = useState(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

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
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      setVideo({
        assetId: data.assetId,
        src: data.playbackUrl,
        filename: data.filename,
      });
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

      const isPlatformUrl = /(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vt\.tiktok\.com)/i.test(url.trim());
      const endpoint = isPlatformUrl ? "/api/import-media" : "/api/import-url";
      setStatus(isPlatformUrl ? "Resolving platform stream and loading playback..." : "Resolving direct video stream...");

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");

      setVideo({
        assetId: data.assetId,
        src: data.playbackUrl,
        filename: data.filename,
      });
    } catch (err) {
      setError(err.message || "Import failed.");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {!video ? (
        <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col items-center justify-center px-6 py-10">
          <div className="mb-8 flex h-24 w-full items-center justify-center">
            <img
              src="/FastVid_Logo.png"
              alt="FastVid Logo"
              className="max-h-full w-auto max-w-[420px] object-contain"
            />
          </div>

          <div className="w-full max-w-[1100px] space-y-6">
            <div className="rounded-full bg-[#2b2b2b] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  placeholder="Paste video URL (YouTube, Facebook, TikTok, or direct .mp4/.webm...)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-14 flex-1 rounded-full border border-transparent bg-transparent px-6 text-center text-xl text-gray-300 outline-none placeholder:text-gray-500"
                />
                <button
                  onClick={handleLoadUrl}
                  disabled={loading}
                  className="h-14 rounded-full bg-orange-500 px-8 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {loading ? "Loading..." : "Load URL"}
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-400">
                {status || "Importing a platform URL can take longer than a direct MP4 link. Please wait while the server downloads the video."}
              </p>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="flex min-h-[360px] w-full cursor-pointer flex-col items-center justify-center rounded-[40px] bg-[#2b2b2b] px-6 text-center transition hover:bg-[#333333]">
              <div className="mb-8 text-7xl text-gray-400">⤴</div>
              <p className="mb-2 text-2xl text-gray-300 md:text-4xl">
                Or upload your videos from your device
              </p>
              <p className="text-sm text-gray-500 md:text-base">
                Click here to choose a video file
              </p>

              <input
                type="file"
                accept="video/*"
                hidden
                onChange={handleUpload}
              />
            </label>
          </div>
        </div>
      ) : (
        <Editor video={video} onBack={() => setVideo(null)} />
      )}
    </div>
  );
}