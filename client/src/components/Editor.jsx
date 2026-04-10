import { useEffect, useMemo, useRef, useState } from "react";
import TrimTimeline from "./TrimTimeline";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function formatTime(value) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function Editor({ video, onBack, token, uploadedVideos = [], onSelectVideo }) {
  const videoRef = useRef(null);
  const playerBoxRef = useRef(null);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [cuts, setCuts] = useState([]);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(video?.id || video?.src || "");

  const filterStyle = useMemo(() => {
    return {
      filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`,
    };
  }, [brightness, contrast, saturation]);

  useEffect(() => {
    setCuts([]);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setDuration(0);
    setStart(0);
    setEnd(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setCutting(false);
  }, [video.src]);

  useEffect(() => {
    setSelectedVideoId(video?.id || video?.src || "");
  }, [video?.id, video?.src]);

  const handleLoadedMetadata = (e) => {
    const d = e.target.duration || 0;
    setDuration(d);
    setStart(0);
    setEnd(d);
  };
  const handleVideoError = (e) => {
    console.error("Video load error:", e.target?.error);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    setCurrentTime(v.currentTime);

    if (end > 0 && v.currentTime >= end) {
      v.pause();
      v.currentTime = start;
      setCurrentTime(start);
      setIsPlaying(false);
    }
  };

  const handleTrimChange = (nextStart, nextEnd) => {
    if (duration <= 0) return;

    const safeStart = Math.max(0, Math.min(nextStart, duration));
    const safeEnd = Math.max(0, Math.min(nextEnd, duration));

    if (safeEnd - safeStart < 0.2) return;

    setStart(safeStart);
    setEnd(safeEnd);

    const v = videoRef.current;
    if (v && (v.currentTime < safeStart || v.currentTime > safeEnd)) {
      v.currentTime = safeStart;
      setCurrentTime(safeStart);
    }
  };

  const togglePlayPause = async () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end) {
        v.currentTime = start;
      }
      await v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const jumpToStart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = start;
    setCurrentTime(start);
    setIsPlaying(false);
  };

  const jumpToEnd = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const target = Math.max(start, end - 0.05);
    v.currentTime = target;
    setCurrentTime(target);
    setIsPlaying(false);
  };

  const handleSelectVideo = (nextVideo) => {
    if (!nextVideo) return;
    const nextId = nextVideo.id || nextVideo.src || "";
    if (nextId === selectedVideoId) return;
    setSelectedVideoId(nextId);
    onSelectVideo(nextVideo);
  };

  const enterFullscreen = async () => {
    const el = playerBoxRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  };

  const handleCut = async () => {
    if (duration <= 0 || end <= start) return;

    try {
      setCutting(true);

      const res = await fetch(`${API_BASE}/api/cut-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          inputUrl: video.src,
          originalFilename: video.filename || "video.mp4",
          start,
          end,
          brightness,
          contrast,
          saturation,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Cut video failed.");
      }

      const newCut = {
        id: data.id,
        name: data.name,
        src: data.outputUrl,
        start: data.start,
        end: data.end,
      };

      setCuts((prev) => [...prev, newCut]);
    } catch (error) {
      alert(error.message || "Cut video failed.");
    } finally {
      setCutting(false);
    }
  };

  const downloadFile = async (url, filename) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Download failed.");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const handleDownloadVideo = async (cut) => {
    try {
      await downloadFile(cut.src, `${cut.name}.mp4`);
    } catch (error) {
      alert(error.message || "Download video failed.");
    }
  };

  const handleDownloadAudioOnly = async (cut) => {
    try {
      const res = await fetch(`${API_BASE}/api/extract-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          inputUrl: cut.src,
          originalFilename: `${cut.name}.mp4`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Extract audio failed.");
      }
      await downloadFile(data.outputUrl, `${cut.name}.mp3`);
    } catch (error) {
      alert(error.message || "Download audio failed.");
    }
  };

  const handleDownloadAllVideos = async () => {
    if (cuts.length === 0) {
      alert("No trimmed videos available.");
      return;
    }

    for (const cut of cuts) {
      try {
        await downloadFile(cut.src, `${cut.name}.mp4`);
      } catch (error) {
        alert(`Download failed for ${cut.name}: ${error.message}`);
        break;
      }
    }
  };

  const handleDownloadAllAudioOnly = async () => {
    if (cuts.length === 0) {
      alert("No trimmed videos available.");
      return;
    }

    for (const cut of cuts) {
      try {
        const res = await fetch(`${API_BASE}/api/extract-audio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            inputUrl: cut.src,
            originalFilename: `${cut.name}.mp4`,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Extract audio failed for ${cut.name}`);
        }
        await downloadFile(data.outputUrl, `${cut.name}.mp3`);
      } catch (error) {
        alert(`Audio export failed for ${cut.name}: ${error.message}`);
        break;
      }
    }
  };

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-8 flex justify-center">
          <img
            src="/FastVid_Logo.png"
            alt="FastVid Logo"
            className="h-auto w-auto max-w-[320px] object-contain"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-[28px] bg-[#1f1f1f]">
            <div className="bg-[#b55400] px-6 py-5 text-2xl font-semibold">
              Adjustments
            </div>

            <div className="space-y-10 px-6 py-8">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-2xl">Brightness</span>
                  <button
                    onClick={() => setBrightness(0)}
                    className="rounded-lg bg-[#4a4a4a] px-4 py-2 text-sm"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-2xl">Contrast</span>
                  <button
                    onClick={() => setContrast(0)}
                    className="rounded-lg bg-[#4a4a4a] px-4 py-2 text-sm"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-2xl">Saturation</span>
                  <button
                    onClick={() => setSaturation(0)}
                    className="rounded-lg bg-[#4a4a4a] px-4 py-2 text-sm"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <div className="overflow-hidden rounded-[28px] bg-[#1f1f1f]">
              <div className="bg-[#b55400] px-6 py-5 text-2xl font-semibold">
                Player
              </div>

              <div className="p-4 md:p-6">
                <div
                  ref={playerBoxRef}
                  className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#111111]"
                >
                  <video
                    ref={videoRef}
                    src={video.src}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={handleVideoError}
                    onClick={togglePlayPause}
                    style={filterStyle}
                    className="h-full w-full cursor-pointer object-contain"
                    crossOrigin="anonymous"
                  />

                  <button
                    onClick={enterFullscreen}
                    className="absolute bottom-4 right-4 rounded-lg bg-black/60 px-4 py-2 text-sm text-white"
                  >
                    Fullscreen
                  </button>

                  <div className="absolute left-4 top-4 rounded-lg bg-black/60 px-3 py-2 text-sm">
                    {isPlaying ? "Playing" : "Paused"} · {formatTime(currentTime)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-[#2d2d2d] px-6 py-6">
              <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-300">
                <span>Duration: {formatTime(duration)}</span>
                <span>Start: {formatTime(start)}</span>
                <span>End: {formatTime(end)}</span>
              </div>

              <TrimTimeline
                duration={duration}
                start={start}
                end={end}
                currentTime={currentTime}
                onChange={handleTrimChange}
              />

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={togglePlayPause}
                  className="rounded-xl bg-slate-600 px-6 py-3 font-semibold transition hover:bg-slate-500"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>

                <button
                  onClick={jumpToStart}
                  className="rounded-xl bg-gray-600 px-6 py-3 font-semibold transition hover:bg-gray-500"
                >
                  Jump to Start
                </button>

                <button
                  onClick={jumpToEnd}
                  className="rounded-xl bg-gray-600 px-6 py-3 font-semibold transition hover:bg-gray-500"
                >
                  Jump to End
                </button>

                <button
                  onClick={handleCut}
                  disabled={cutting}
                  className="rounded-xl bg-orange-500 px-6 py-3 font-semibold transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {cutting ? "Cutting..." : "Cut Video"}
                </button>

                <button
                  onClick={onBack}
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-700"
                >
                  Return to Main page
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] bg-[#1f1f1f]">
            <div className="bg-[#b55400] px-6 py-5 text-2xl font-semibold">
              Cut Videos
            </div>

            <div className="space-y-4 p-4">
              <div className="min-h-[260px] rounded-2xl bg-[#111111] p-4">
                {cuts.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No trimmed videos yet.
                  </p>
                ) : (
                  cuts.map((cut) => (
                    <div
                      key={cut.id}
                      className="mb-3 rounded-xl bg-[#1c1c1c] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{cut.name}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownloadVideo(cut)}
                            className="rounded-md bg-orange-500 px-3 py-2 text-sm"
                            title="Download video"
                          >
                            ⬇
                          </button>
                          <button
                            onClick={() => handleDownloadAudioOnly(cut)}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm"
                            title="Download audio only"
                          >
                            🔊
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatTime(cut.start)} - {formatTime(cut.end)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={handleDownloadAllVideos}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold"
                >
                  Download all videos
                </button>
                <button
                  onClick={handleDownloadAllAudioOnly}
                  className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold"
                >
                  Download all audio only
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}