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
