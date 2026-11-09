import { fmtSec, labelColor } from "../data/derive";
import type { Session } from "../data/schema";
import { useRoom, type DetectionRef } from "../state/store";

/** The detection the visitor clicked, with where and when it was seen. */
export function DetectionDetail({ session, at }: { session: Session; at: DetectionRef }) {
  const setSelected = useRoom((s) => s.setSelected);
  const setT = useRoom((s) => s.setT);
  const cam = session.cameras[at.camera];
  const frame = cam?.frames[at.frame];
  const d = frame?.detections[at.index];
  if (!cam || !frame || !d) return null;
  const [x1, y1, x2, y2] = d.box;
  const area = (x2 - x1) * (y2 - y1);
  const same = frame.detections.filter((o) => o.label === d.label).length;
  return (
    <div className="px-4 pb-4 pt-2 text-sm">
      <div className="flex items-center gap-2">
        <i className="h-3 w-3 rounded-sm" style={{ background: labelColor(d.label) }} aria-hidden />
        <b className="text-lg font-semibold">{d.label}</b>
        <span className="ml-auto text-xs text-muted">{Math.round(d.confidence * 100)}% confidence</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted">Camera</dt><dd>{at.camera}</dd>
        <dt className="text-muted">Time</dt><dd>{fmtSec(frame.t)} (frame {at.frame + 1})</dd>
        <dt className="text-muted">Box</dt><dd className="tabular-nums">{Math.round(x1 * cam.width)},{Math.round(y1 * cam.height)} to {Math.round(x2 * cam.width)},{Math.round(y2 * cam.height)} px</dd>
        <dt className="text-muted">Share of frame</dt><dd>{(area * 100).toFixed(1)}%</dd>
        <dt className="text-muted">Same label in frame</dt><dd>{same}</dd>
        <dt className="text-muted">Frame inference</dt><dd>{frame.inference_ms} ms</dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setT(frame.t)} className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-[#1d2638]">Move playhead here</button>
        <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-[#1d2638]">Back to overview</button>
      </div>
    </div>
  );
}
