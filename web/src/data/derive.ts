import type { Camera, Session } from "./schema";

/** Labels ordered by how often they were detected across the session. */
export function labelRanking(session: Session): { label: string; count: number }[] {
  return Object.entries(session.summary.labels)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Detections per frame for one label (or all labels), aligned to frame time. */
export function countSeries(camera: Camera, label?: string): { t: number; n: number }[] {
  return camera.frames.map((f) => ({
    t: f.t,
    n: label ? f.detections.filter((d) => d.label === label).length : f.detections.length,
  }));
}

/** The frame closest to `t` (frames are sorted by time). */
export function frameAt(camera: Camera, t: number): number {
  const frames = camera.frames;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((frames[mid]?.t ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs((frames[lo - 1]?.t ?? 0) - t) <= Math.abs((frames[lo]?.t ?? 0) - t)) return lo - 1;
  return lo;
}

/** A grid of where detections of `label` occur in the frame, for the floor heatmap. */
export function occupancy(camera: Camera, label: string, cells = 16): number[] {
  const grid = new Array<number>(cells * cells).fill(0);
  for (const f of camera.frames) {
    for (const d of f.detections) {
      if (d.label !== label) continue;
      const [x1, , x2, y2] = d.box;
      const cx = Math.min(cells - 1, Math.floor(((x1 + x2) / 2) * cells));
      const cy = Math.min(cells - 1, Math.floor(y2 * cells));
      grid[cy * cells + cx] = (grid[cy * cells + cx] ?? 0) + 1;
    }
  }
  return grid;
}

/** Session length in seconds for one camera. */
export function duration(camera: Camera): number {
  return camera.frames.at(-1)?.t ?? 0;
}

/** A fixed colour per label so the 3D view, the frame view and the legend always agree. */
const LABEL_COLORS: Record<string, string> = {
  person: "#f7b733",
  car: "#4fa3ff",
  truck: "#8b5cf6",
  chair: "#36d39a",
  "dining table": "#e86fa8",
  bicycle: "#fc4a1a",
};
const FALLBACK = ["#7dd3fc", "#fda4af", "#bef264", "#c4b5fd", "#fdba74"];

export function labelColor(label: string): string {
  const known = LABEL_COLORS[label];
  if (known) return known;
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length]!;
}

/** Longest camera recording in seconds; the shared timeline runs from 0 to this. */
export function sessionDuration(session: Session): number {
  return Math.max(0, ...Object.values(session.cameras).map(duration));
}

/**
 * Per-frame inference times bucketed for the latency histogram. The first frame of each
 * camera also pays for loading the model, so it is reported separately as warm-up instead
 * of stretching the histogram.
 */
export function latencyHistogram(
  session: Session,
  bins = 24,
): { bins: { from: number; to: number; n: number }[]; warmup: number[] } {
  const cams = Object.values(session.cameras);
  const warmup = cams.map((c) => c.frames[0]?.inference_ms ?? 0);
  const all = cams.flatMap((c) => c.frames.slice(1).map((f) => f.inference_ms));
  if (all.length === 0) return { bins: [], warmup };
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const width = (hi - lo) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, n: 0 }));
  for (const v of all) {
    const i = Math.min(bins - 1, Math.floor((v - lo) / width));
    out[i]!.n += 1;
  }
  return { bins: out, warmup };
}

/** Median and 95th percentile of steady-state inference time (warm-up frames excluded). */
export function steadyLatency(session: Session): { p50: number; p95: number } {
  const v = Object.values(session.cameras)
    .flatMap((c) => c.frames.slice(1).map((f) => f.inference_ms))
    .sort((a, b) => a - b);
  const q = (p: number) => {
    if (v.length === 0) return 0;
    const x = (v.length - 1) * p;
    const i = Math.floor(x);
    return Math.round((v[i]! + ((v[Math.min(i + 1, v.length - 1)] ?? v[i]!) - v[i]!) * (x - i)) * 10) / 10;
  };
  return { p50: q(0.5), p95: q(0.95) };
}

export interface DetectionRow {
  camera: string;
  frame: number;
  index: number;
  t: number;
  label: string;
  confidence: number;
}

/** Every detection as a flat row, for the table view and keyboard navigation. */
export function detectionRows(session: Session): DetectionRow[] {
  const rows: DetectionRow[] = [];
  for (const [camera, cam] of Object.entries(session.cameras)) {
    cam.frames.forEach((f, frame) =>
      f.detections.forEach((d, index) => rows.push({ camera, frame, index, t: f.t, label: d.label, confidence: d.confidence })),
    );
  }
  return rows;
}

export const fmtInt = new Intl.NumberFormat("en-US");
export const fmtSec = (t: number) => `${t.toFixed(1)} s`;
