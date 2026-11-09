import { fmtInt, labelColor, labelRanking } from "../data/derive";
import type { Session } from "../data/schema";
import { useRoom } from "../state/store";

/** Detections by label; clicking one highlights it in the tunnel, the timeline and the frame. */
export function LabelLegend({ session }: { session: Session }) {
  const ranking = labelRanking(session);
  const label = useRoom((s) => s.label);
  const setLabel = useRoom((s) => s.setLabel);
  const max = ranking[0]?.count ?? 1;
  return (
    <ul className="space-y-1 px-4 pb-4 pt-2">
      {ranking.map((r) => (
        <li key={r.label}>
          <button
            type="button"
            aria-pressed={label === r.label}
            onClick={() => setLabel(r.label)}
            className="group grid w-full grid-cols-[110px_1fr_56px] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-[#151b29] aria-pressed:bg-[#1d2638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-system"
          >
            <span className="flex items-center gap-2 text-ink">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: labelColor(r.label) }} aria-hidden />
              {r.label}
            </span>
            <span className="h-1.5 rounded-full bg-[#1a2133]">
              <span className="block h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: labelColor(r.label) }} />
            </span>
            <span className="text-right tabular-nums text-muted">{fmtInt.format(r.count)}</span>
          </button>
        </li>
      ))}
      <li className="pt-1 text-[11.5px] text-dim">{label ? "Click again to show every label" : "Click a label to highlight it everywhere"}</li>
    </ul>
  );
}
