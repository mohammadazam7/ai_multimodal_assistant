import { useMemo, useState } from "react";
import { detectionRows, fmtInt, fmtSec, labelColor, labelRanking } from "../data/derive";
import type { Session } from "../data/schema";
import { useRoom } from "../state/store";

/** The same data without WebGL: counts by camera and label, and the most confident detections. */
export function DetectionTable({ session }: { session: Session }) {
  const names = Object.keys(session.cameras);
  const labels = labelRanking(session).map((r) => r.label);
  const rows = useMemo(() => detectionRows(session), [session]);
  const setSelected = useRoom((s) => s.setSelected);
  const [limit, setLimit] = useState(12);
  const counts = (cam: string, label: string) => rows.filter((r) => r.camera === cam && r.label === label).length;
  const top = [...rows].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
  return (
    <div className="overflow-x-auto px-4 pb-4 pt-2 text-xs">
      <table className="w-full border-collapse">
        <caption className="pb-2 text-left text-muted">Detections by camera and label</caption>
        <thead>
          <tr className="text-muted">
            <th className="py-1 text-left font-normal">Label</th>
            {names.map((n) => <th key={n} className="py-1 text-right font-normal">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {labels.map((l) => (
            <tr key={l} className="border-t border-line">
              <td className="py-1"><i className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: labelColor(l) }} aria-hidden />{l}</td>
              {names.map((n) => <td key={n} className="py-1 text-right tabular-nums">{fmtInt.format(counts(n, l))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mt-4 w-full border-collapse">
        <caption className="pb-2 text-left text-muted">Most confident detections</caption>
        <thead><tr className="text-muted"><th className="text-left font-normal">Label</th><th className="text-left font-normal">Camera</th><th className="text-right font-normal">Time</th><th className="text-right font-normal">Confidence</th></tr></thead>
        <tbody>
          {top.map((r) => (
            <tr key={`${r.camera}-${r.frame}-${r.index}`} className="cursor-pointer border-t border-line hover:bg-[#151b29]" onClick={() => setSelected(r)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelected(r)}>
              <td className="py-1">{r.label}</td><td>{r.camera}</td><td className="text-right tabular-nums">{fmtSec(r.t)}</td><td className="text-right tabular-nums">{Math.round(r.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {limit < rows.length && <button type="button" onClick={() => setLimit(limit + 24)} className="mt-2 text-system hover:underline">Show more</button>}
    </div>
  );
}
