import { Range, getTrackBackground } from "react-range";

function formatTime(value) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function TrimTimeline({
  duration,
  start,
  end,
  currentTime,
  onChange,
}) {
  const safeDuration = Math.max(duration || 0, 0.1);
  const values = [start, end];
  const tickCount = Math.min(12, Math.max(2, Math.floor(safeDuration / 2)));
  const playheadLeft =
    duration > 0 ? `${(currentTime / duration) * 100}%` : "0%";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between text-sm text-gray-300">
        <span>Start: {formatTime(start)}</span>
        <span>End: {formatTime(end)}</span>
      </div>

      <div className="rounded-[24px] bg-[#3b3b3b] px-5 py-5">
        <div className="mb-4 grid h-14 grid-cols-12 gap-1 overflow-hidden rounded-2xl">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-full rounded-lg border border-white/5 bg-gradient-to-b from-[#707070] via-[#5a5a5a] to-[#3f3f3f]"
            />
          ))}
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute top-0 z-10 h-full w-[2px] bg-white/90"
            style={{ left: playheadLeft }}
          />

          <Range
            values={values}
            step={0.1}
            min={0}
            max={safeDuration}
            draggableTrack={true}
            onChange={(vals) => {
              const [nextStart, nextEnd] = vals;
              if (nextEnd - nextStart < 0.2) return;
              onChange(nextStart, nextEnd);
            }}
            renderTrack={({ props, children }) => (
              <div
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                className="flex h-16 w-full items-center"
                style={props.style}
              >
                <div
                  ref={props.ref}
                  className="relative h-5 w-full rounded-full"
                  style={{
                    background: getTrackBackground({
                      values,
                      colors: ["#0b3d78", "#f59e0b", "#0b3d78"],
                      min: 0,
                      max: safeDuration,
                    }),
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-3 w-[2px] rounded-full bg-black/20"
                      />
                    ))}
                  </div>
                  {children}
                </div>
              </div>
            )}
            renderThumb={({ props, index, isDragged }) => {
              const isLeft = index === 0;
              const { key, style, ...thumbProps } = props;

              return (
                <div
                  {...thumbProps}
                  className="outline-none"
                  style={style}
                >
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`${
                        isLeft
                          ? "border-y-[26px] border-r-[18px] border-y-transparent border-r-[#1d5ea8]"
                          : "border-y-[26px] border-l-[18px] border-y-transparent border-l-[#1d5ea8]"
                      } h-0 w-0 transition ${
                        isDragged ? "scale-110" : "scale-100"
                      }`}
                    />
                    <div className="absolute h-8 w-1 rounded-full bg-white/80" />
                  </div>
                </div>
              );
            }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          {Array.from({ length: tickCount + 1 }).map((_, i) => {
            const value = (safeDuration / tickCount) * i;
            return <span key={i}>{formatTime(value)}</span>;
          })}
        </div>
      </div>
    </div>
  );
}