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

  const handleLoadedMetadata = (event) => {
    const nextDuration = event.target.duration || 0;
    setDuration(nextDuration);
    setStart(0);
    setEnd(nextDuration);
  };

  const handleVideoError = (event) => {
    console.error("Video load error:", event.target?.error);
  };

  const handleTimeUpdate = () => {
    const player = videoRef.current;
    if (!player) return;

    setCurrentTime(player.currentTime);

    if (end > 0 && player.currentTime >= end) {
      player.pause();
      player.currentTime = start;
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

    const player = videoRef.current;
    if (player && (player.currentTime < safeStart || player.currentTime > safeEnd)) {
      player.currentTime = safeStart;
      setCurrentTime(safeStart);
    }
  };

  const togglePlayPause = async () => {
    const player = videoRef.current;
    if (!player) return;

    if (player.paused) {
      if (player.currentTime < start || player.currentTime >= end) {
        player.currentTime = start;
      }
      await player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  };

  const jumpToStart = () => {
    const player = videoRef.current;
    if (!player) return;
    player.pause();
    player.currentTime = start;
    setCurrentTime(start);
    setIsPlaying(false);
  };

  const jumpToEnd = () => {
    const player = videoRef.current;
    if (!player) return;
    player.pause();
    const target = Math.max(start, end - 0.05);
    player.currentTime = target;
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
    const element = playerBoxRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (element.requestFullscreen) {
      await element.requestFullscreen();
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

      const cutName = data.name || `clip-${cuts.length + 1}`;
      const newCut = {
        id: data.id || `${Date.now()}-${cuts.length}`,
        name: cutName,
        src: data.outputUrl,
        start,
        end,
      };

      setCuts((prev) => [newCut, ...prev]);
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

  const currentThumbnail = video.thumbnailUrl || video.playbackUrl || video.src;

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-semibold">FastVid Editor</div>
            <div className="mt-1 text-sm text-gray-400">Select uploaded videos, trim clips, and export faster.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-full border border-gray-700 bg-[#1f1f1f] px-5 py-3 text-sm text-white transition hover:border-white"
            >
              Back to dashboard
            </button>
            <button
              onClick={togglePlayPause}
              className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px_340px]">
          <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Uploaded Videos</div>
                <div className="text-sm text-gray-500">Click any thumbnail to switch the current clip.</div>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-300">{uploadedVideos.length}</span>
            </div>
            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-2">
              {uploadedVideos.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-[#111111] p-6 text-center text-sm text-gray-400">
                  No videos uploaded yet.
                </div>
              ) : (
                uploadedVideos.map((item) => {
                  const itemKey = item.id || item.playbackUrl || item.src || item.filename || "video";
                  const isActive = itemKey === selectedVideoId;
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      onClick={() => handleSelectVideo({
                        ...item,
                        src: item.playbackUrl || item.src,
                        filename: item.filename || item.originalName || "Uploaded Video",
                      })}
                      className={`group flex w-full items-start gap-3 rounded-3xl border p-3 text-left transition ${isActive ? "border-orange-500 bg-orange-500/10" : "border-white/5 bg-white/5 hover:border-orange-500 hover:bg-white/10"}`}
                    >
                      <div className="h-20 w-28 overflow-hidden rounded-2xl bg-[#0f0f0f]">
                        <img
                          src={item.thumbnailUrl || item.poster || item.playbackUrl || item.src}
                          alt={item.filename || item.originalName || "Video thumbnail"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{item.filename || item.originalName || "Uploaded video"}</div>
                        <div className="mt-1 text-xs text-gray-400">{item.duration ? `${formatTime(item.duration)} duration` : "Imported file"}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Current Video</div>
                <div className="text-sm text-gray-500">Preview the current clip before trimming.</div>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-300">{video.filename || "Current"}</span>
            </div>
            <div ref={playerBoxRef} className="relative overflow-hidden rounded-3xl bg-[#111111]">
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
                className="h-full w-full min-h-[240px] cursor-pointer object-contain"
                crossOrigin="anonymous"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute left-4 top-4 rounded-2xl bg-black/70 px-3 py-2 text-sm text-white">{isPlaying ? "Playing" : "Paused"} · {formatTime(currentTime)}</div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={togglePlayPause} className="rounded-3xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">{isPlaying ? "Pause" : "Play"}</button>
              <button onClick={jumpToStart} className="rounded-3xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600">Jump to Start</button>
              <button onClick={jumpToEnd} className="rounded-3xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600">Jump to End</button>
              <button onClick={enterFullscreen} className="rounded-3xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600">Fullscreen</button>
            </div>
            <div className="mt-6 rounded-3xl bg-[#111111] p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
                <span>Duration: {formatTime(duration)}</span>
                <span>Start: {formatTime(start)}</span>
                <span>End: {formatTime(end)}</span>
              </div>
              <TrimTimeline duration={duration} start={start} end={end} currentTime={currentTime} onChange={handleTrimChange} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={handleCut} disabled={cutting} className="rounded-3xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60">{cutting ? "Cutting..." : "Cut Video"}</button>
              <button onClick={onBack} className="rounded-3xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">Return to Main page</button>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
            <div className="mb-5">
              <div className="text-lg font-semibold">Adjustments</div>
              <div className="text-sm text-gray-500">Fine tune brightness, contrast and saturation.</div>
            </div>
            <div className="space-y-6">
              {[
                { label: "Brightness", value: brightness, setter: setBrightness },
                { label: "Contrast", value: contrast, setter: setContrast },
                { label: "Saturation", value: saturation, setter: setSaturation },
              ].map((control) => (
                <div key={control.label} className="space-y-3 rounded-3xl bg-[#111111] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{control.label}</div>
                      <div className="text-xs text-gray-400">{control.value}%</div>
                    </div>
                    <button onClick={() => control.setter(0)} className="rounded-full bg-white/10 px-4 py-2 text-xs text-gray-200 transition hover:bg-white/20">Reset</button>
                  </div>
                  <input type="range" min="-100" max="100" value={control.value} onChange={(event) => control.setter(Number(event.target.value))} className="w-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-[#161616] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Trimmed Clips</div>
                <div className="text-sm text-gray-500">Export your edited clips or audio tracks.</div>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-300">{cuts.length}</span>
            </div>
            <div className="space-y-4 max-h-[760px] overflow-y-auto pr-2">
              {cuts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-[#111111] p-6 text-center text-sm text-gray-400">You have no trimmed clips yet.</div>
              ) : (
                cuts.map((cut) => (
                  <div key={cut.id} className="rounded-3xl border border-white/5 bg-[#111111] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{cut.name}</div>
                        <div className="text-xs text-gray-400">{formatTime(cut.start)} - {formatTime(cut.end)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDownloadVideo(cut)} className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white">Download</button>
                        <button onClick={() => handleDownloadAudioOnly(cut)} className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Audio</button>
                      </div>
                    </div>
                  </div>
                ))}
              )}
            </div>
            {cuts.length > 0 && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button onClick={handleDownloadAllVideos} className="rounded-3xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">Download All Clips</button>
                <button onClick={handleDownloadAllAudioOnly} className="rounded-3xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">Download All Audio</button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
