import { useEffect, useMemo, useRef } from "react";
import { countSeries, fmtSec, labelColor } from "../data/derive";
import type { Session } from "../data/schema";
import { useRoom } from "../state/store";

const W = 640;
const ROW = 34;

/** Plays the recording: the 3D playhead and the frame view follow the time set here. */
export function TimelinePlayer({ session, duration, reducedMotion }: { session: Session; duration: number; reducedMotion: boolean }) {
  const t = useRoom((s) => s.t);
  const playing = useRoom((s) => s.playing);
  const label = useRoom((s) => s.label);
  const setT = useRoom((s) => s.setT);
  const setPlaying = useRoom((s) => s.setPlaying);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const s = useRoom.getState();
      const next = s.t + ((now - last) / 1000) * (reducedMotion ? 4 : 1);
      last = now;
      if (next >= duration) {
        s.setT(duration);
        s.setPlaying(false);
        return;
      }
      s.setT(next);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, duration, reducedMotion]);

  const names = Object.keys(session.cameras);
  const lanes = useMemo(
    () =>
      names.map((n) => {
        const series = countSeries(session.cameras[n]!, label ?? undefined);
        const max = Math.max(1, ...series.map((p) => p.n));
        const d = series
          .map((p, i) => `${i ? "L" : "M"}${((p.t / duration) * W).toFixed(1)},${(ROW - 4 - (p.n / max) * (ROW - 10)).toFixed(1)}`)
          .join(" ");
        return { n, d, max };
      }),
    [names, session, label, duration],
  );

  const seek = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPlaying(false);
    setT(((e.clientX - r.left) / r.width) * duration);
  };

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!playing && t >= duration) setT(0);
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause the recording" : "Play the recording"}
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-system to-violet text-[#0b0f18] shadow-panel transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-demand"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-xs text-muted">
          <span className="w-14 tabular-nums text-ink">{fmtSec(t)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={t}
            aria-label="Time in the recording"
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            className="h-1.5 flex-1 cursor-pointer accent-[#4fa3ff]"
          />
          <span className="tabular-nums">{fmtSec(duration)}</span>
        </label>
      </div>
      <svg
        viewBox={`0 0 ${W} ${ROW * names.length}`}
        className="mt-2 w-full cursor-crosshair"
        role="img"
        aria-label={`Detections per frame over time${label ? ` for ${label}` : ""}, one row per camera; click to jump`}
        onPointerDown={seek}
      >
        {lanes.map((l, i) => (
          <g key={l.n} transform={`translate(0 ${i * ROW})`}>
            <text x={4} y={11} className="fill-[#5d677a] text-[10px]">{l.n} · peak {l.max}</text>
            <path d={l.d} fill="none" stroke={label ? labelColor(label) : "#4fa3ff"} strokeWidth={1.4} />
          </g>
        ))}
        <line x1={(t / duration) * W} x2={(t / duration) * W} y1={0} y2={ROW * names.length} stroke="#f7b733" strokeWidth={1.2} />
      </svg>
    </div>
  );
}
