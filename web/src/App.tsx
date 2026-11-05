import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Card } from "./atlas/Card";
import { ErrorBoundary } from "./atlas/ErrorBoundary";
import { hasWebGL, useReducedMotion } from "./atlas/hooks";
import { Segmented } from "./atlas/Segmented";
import { fmtSec, labelColor, sessionDuration } from "./data/derive";
import { loadSession } from "./data/loadSession";
import type { Session } from "./data/schema";
import { DetectionDetail } from "./panels/DetectionDetail";
import { DetectionTable } from "./panels/DetectionTable";
import { FrameView } from "./panels/FrameView";
import { KpiRow } from "./panels/KpiRow";
import { LabelLegend } from "./panels/LabelLegend";
import { LatencyPanel } from "./panels/LatencyPanel";
import { TimelinePlayer } from "./panels/TimelinePlayer";
import { useRoom } from "./state/store";

const Scene = lazy(() => import("./scene/Scene"));

type Load = { state: "loading" } | { state: "ready"; session: Session } | { state: "error"; message: string };

export function App() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    loadSession().then(
      (session) => setLoad({ state: "ready", session }),
      (e: unknown) => setLoad({ state: "error", message: e instanceof Error ? e.message : String(e) }),
    );
  }, []);
  if (load.state === "loading") return <Splash text="Loading the recorded session" />;
  if (load.state === "error") return <Splash text={load.message} />;
  return <ControlRoom session={load.session} />;
}

function Splash({ text }: { text: string }) {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center text-muted">
      <p role="status">{text}</p>
    </main>
  );
}

/** Shows what the hovered detection is, over the 3D view. */
function HoverReadout({ session }: { session: Session }) {
  const hovered = useRoom((s) => s.hovered);
  const f = hovered ? session.cameras[hovered.camera]?.frames[hovered.frame] : undefined;
  const d = hovered ? f?.detections[hovered.index] : undefined;
  if (!hovered || !f || !d) return null;
  return (
    <div className="scene-callout pointer-events-none absolute left-4 top-3 flex items-center gap-2">
      <i className="h-2.5 w-2.5 rounded-sm" style={{ background: labelColor(d.label) }} aria-hidden />
      {d.label} · {Math.round(d.confidence * 100)}% · {hovered.camera} at {fmtSec(f.t)}
    </div>
  );
}

function ControlRoom({ session }: { session: Session }) {
  const reduced = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);
  const duration = useMemo(() => sessionDuration(session), [session]);
  const preset = useRoom((s) => s.preset);
  const setPreset = useRoom((s) => s.setPreset);
  const selected = useRoom((s) => s.selected);
  const setSelected = useRoom((s) => s.setSelected);
  const [view, setView] = useState<"3d" | "table">(webgl ? "3d" : "table");

  // Keyboard: space plays or pauses, arrows step a quarter second, Escape clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "BUTTON", "TEXTAREA"].includes(target.tagName)) return;
      const s = useRoom.getState();
      if (e.key === " ") {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.key === "ArrowRight") s.setT(Math.min(duration, s.t + 0.25));
      else if (e.key === "ArrowLeft") s.setT(s.t - 0.25);
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration, setSelected]);

  const sceneLabel = `3D time tunnel of ${session.summary.detections} detections across ${Object.keys(session.cameras).length} cameras over ${Math.round(duration)} seconds; each slab is one detection placed where and when it was seen`;

  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-12 pt-5">
      <header className="flex flex-wrap items-center gap-3.5">
        <div aria-hidden className="grid h-10 w-10 place-items-center rounded-[11px] bg-gradient-to-br from-system to-violet font-extrabold text-[#0b0f18]">VC</div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vision Control Room</h1>
          <p className="text-[13px] text-muted">A recorded session from the real-time vision service: every detection the model made, where and when</p>
        </div>
        <span className="ml-auto rounded-full border border-health/40 bg-health/10 px-2.5 py-1 text-xs text-health" title="Detections come from running the model on public sample videos">
          Real model output
        </span>
      </header>

      <div className="mt-5"><KpiRow session={session} animate={!reduced} /></div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        <Card
          title="Time tunnel"
          note="cameras side by side, time runs into the screen"
          actions={
            <div className="flex gap-2">
              {view === "3d" && (
                <Segmented label="Camera angle" value={preset} onChange={setPreset} options={[{ value: "tunnel", label: "Tunnel" }, { value: "front", label: "Front" }, { value: "side", label: "Side" }]} />
              )}
              <Segmented label="View" value={view} onChange={setView} options={webgl ? [{ value: "3d", label: "3D" }, { value: "table", label: "Table" }] : [{ value: "table", label: "Table" }]} />
            </div>
          }
        >
          {view === "3d" ? (
            <div className="relative h-[440px]">
              <ErrorBoundary label="The 3D view" fallback={<DetectionTable session={session} />}>
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading the 3D view</div>}>
                  <Scene session={session} reducedMotion={reduced} label={sceneLabel} />
                </Suspense>
              </ErrorBoundary>
              <HoverReadout session={session} />
              <p className="pointer-events-none absolute bottom-3 right-4 text-[11.5px] text-dim">Drag to orbit · scroll to zoom · click a detection · space to play</p>
            </div>
          ) : (
            <DetectionTable session={session} />
          )}
          {!webgl && <p className="px-4 pb-3 text-xs text-dim">This browser has no WebGL, so the table view is shown.</p>}
          <TimelinePlayer session={session} duration={duration} reducedMotion={reduced} />
        </Card>
        <div className="grid gap-3.5">
          {selected ? (
            <Card title="Detection" note="the one you clicked">
              <DetectionDetail session={session} at={selected} />
            </Card>
          ) : (
            <Card title="What the camera saw" note="the frame under the playhead">
              <FrameView session={session} />
            </Card>
          )}
          <Card title="Labels" note="click to highlight">
            <LabelLegend session={session} />
          </Card>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1fr_1fr]">
        <Card title="Inference time per frame" note={`${session.summary.frames} frames`}>
          <LatencyPanel session={session} />
        </Card>
        <Card title="About this recording" note="how the numbers were made">
          <div className="space-y-2 px-4 pb-4 pt-2 text-xs text-muted">
            <p>
              <b className="text-ink">{session.model}</b> ran on {session.device} with a confidence threshold of {session.confidence_threshold}, on frames sampled at {session.sample_fps} per second. Nothing here is simulated: each box is one model prediction.
            </p>
            <ul className="list-disc space-y-1 pl-4">
              {session.sources.map((s) => (
                <li key={s.camera}><span className="text-ink">{s.camera}</span>: {s.file} ({s.credit})</li>
              ))}
            </ul>
            <p>Recorded with <code className="text-ink">python -m tools.record_session</code> in backend/.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
