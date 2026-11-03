import { useEffect, useState } from "react";
import { labelRanking } from "./data/derive";
import { loadSession } from "./data/loadSession";
import type { Session } from "./data/schema";

/** Shell: loads and validates the session; the 3D room and panels mount inside it. */
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSession().then(setSession, (e: unknown) => setError(String(e)));
  }, []);

  if (error) return <main className="p-8 text-red-300">{error}</main>;
  if (!session) return <main className="p-8 text-slate-400">Loading session…</main>;

  const { summary } = session;
  return (
    <main className="mx-auto max-w-6xl p-6 text-slate-200">
      <h1 className="text-2xl font-semibold">Vision Control Room</h1>
      <p className="mt-1 text-sm text-slate-400">
        {session.model} on {session.device}, threshold {session.confidence_threshold}, sampled at{" "}
        {session.sample_fps} fps on {session.hardware}
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><dt className="text-xs text-slate-400">Frames</dt><dd className="text-xl">{summary.frames}</dd></div>
        <div><dt className="text-xs text-slate-400">Detections</dt><dd className="text-xl">{summary.detections}</dd></div>
        <div><dt className="text-xs text-slate-400">Inference p50</dt><dd className="text-xl">{summary.latency_ms.p50} ms</dd></div>
        <div><dt className="text-xs text-slate-400">Inference p95</dt><dd className="text-xl">{summary.latency_ms.p95} ms</dd></div>
      </dl>
      <ul className="mt-6 text-sm">
        {labelRanking(session).map((r) => (
          <li key={r.label}>{r.label}: {r.count}</li>
        ))}
      </ul>
    </main>
  );
}
