import { useCountUp } from "../atlas/hooks";
import { fmtInt, steadyLatency } from "../data/derive";
import type { Session } from "../data/schema";

function Kpi({ label, value, unit, note, animate }: { label: string; value: number; unit?: string; note: string; animate: boolean }) {
  const shown = useCountUp(value, 900, animate);
  return (
    <div className="rounded-panel border border-line bg-gradient-to-b from-raised to-panel px-4 py-3 shadow-panel">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {fmtInt.format(Math.round(shown))}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </div>
      <div className="mt-0.5 text-[11.5px] text-dim">{note}</div>
    </div>
  );
}

export function KpiRow({ session, animate }: { session: Session; animate: boolean }) {
  const s = session.summary;
  const cams = Object.keys(session.cameras).length;
  const lat = steadyLatency(session);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi label="Frames analysed" value={s.frames} note={`${cams} cameras at ${session.sample_fps} fps`} animate={animate} />
      <Kpi label="Detections" value={s.detections} note={`confidence at least ${session.confidence_threshold}`} animate={animate} />
      <Kpi label="Inference p50" value={lat.p50} unit="ms" note={`${session.model} on ${session.device}`} animate={animate} />
      <Kpi label="Inference p95" value={lat.p95} unit="ms" note="per frame, model warm-up excluded" animate={animate} />
    </div>
  );
}
