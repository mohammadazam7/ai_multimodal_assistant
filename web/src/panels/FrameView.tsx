import { fmtSec, frameAt, labelColor } from "../data/derive";
import type { Session } from "../data/schema";
import { useRoom } from "../state/store";

/** What one camera saw at the playhead: its detections drawn at their place in the frame. */
export function FrameView({ session }: { session: Session }) {
  const names = Object.keys(session.cameras);
  const t = useRoom((s) => s.t);
  const label = useRoom((s) => s.label);
  const focus = useRoom((s) => s.focusCamera) ?? names[0]!;
  const setFocus = useRoom((s) => s.setFocusCamera);
  const selected = useRoom((s) => s.selected);
  const setSelected = useRoom((s) => s.setSelected);
  const cam = session.cameras[focus]!;
  const i = frameAt(cam, t);
  const frame = cam.frames[i]!;
  const W = 320;
  const H = (W * cam.height) / cam.width;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Camera">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === focus}
            onClick={() => setFocus(n)}
            className="rounded-[7px] border border-line px-2.5 py-1 text-xs text-muted hover:text-ink aria-pressed:bg-[#1d2638] aria-pressed:text-ink"
          >
            {n}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line bg-[#0c111b]" role="img" aria-label={`${focus} at ${fmtSec(frame.t)}: ${frame.detections.length} detections`}>
        {frame.detections.map((d, k) => {
          const [x1, y1, x2, y2] = d.box;
          const dim = label != null && d.label !== label;
          const isSel = selected?.camera === focus && selected.frame === i && selected.index === k;
          return (
            <g key={k} opacity={dim ? 0.18 : 1} className="cursor-pointer" onClick={() => setSelected({ camera: focus, frame: i, index: k })}>
              <rect x={x1 * W} y={y1 * H} width={(x2 - x1) * W} height={(y2 - y1) * H} fill={`${labelColor(d.label)}22`} stroke={isSel ? "#ffffff" : labelColor(d.label)} strokeWidth={isSel ? 2 : 1.2} />
              <text x={x1 * W + 2} y={y1 * H + 9} className="text-[8px]" fill={labelColor(d.label)}>
                {d.label} {Math.round(d.confidence * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted">
        Frame {i + 1} of {cam.frames.length} at {fmtSec(frame.t)} · {frame.detections.length} detections · inference {frame.inference_ms} ms
      </p>
    </div>
  );
}
