import { fmtInt, latencyHistogram, steadyLatency } from "../data/derive";
import type { Session } from "../data/schema";

/** How long inference took per frame on the recording hardware, with p50 and p95 marked. */
export function LatencyPanel({ session }: { session: Session }) {
  const { bins, warmup } = latencyHistogram(session);
  if (bins.length === 0) return null;
  const W = 360;
  const H = 110;
  const lo = bins[0]!.from;
  const hi = bins.at(-1)!.to;
  const max = Math.max(...bins.map((b) => b.n));
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * W;
  const { p50, p95 } = steadyLatency(session);
  return (
    <div className="px-4 pb-4 pt-2">
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label={`Inference time per frame: median ${p50} ms, 95th percentile ${p95} ms`}>
        {bins.map((b, i) => (
          <rect key={i} x={x(b.from) + 1} y={H - (b.n / max) * H} width={Math.max(1, x(b.to) - x(b.from) - 2)} height={(b.n / max) * H} fill="#4fa3ff" opacity={0.75} rx={1.5} />
        ))}
        {[{ v: p50, name: "p50", c: "#36d39a" }, { v: p95, name: "p95", c: "#f7b733" }].map((m) => (
          <g key={m.name}>
            <line x1={x(m.v)} x2={x(m.v)} y1={0} y2={H} stroke={m.c} strokeDasharray="3 3" />
            <text x={x(m.v) + 3} y={10} fill={m.c} className="text-[10px]">{m.name} {m.v} ms</text>
          </g>
        ))}
        <text x={0} y={H + 13} className="fill-[#5d677a] text-[10px]">{Math.round(lo)} ms</text>
        <text x={W} y={H + 13} textAnchor="end" className="fill-[#5d677a] text-[10px]">{Math.round(hi)} ms</text>
      </svg>
      <p className="mt-1 text-xs text-muted">
        {session.hardware}, batch size 1, measured around every model call. The first frame on each camera is left out: the
        session's first call also loaded the model and took {fmtInt.format(Math.round(Math.max(...warmup)))} ms.
      </p>
    </div>
  );
}
