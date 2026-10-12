export interface StreamStats {
  /** Results received per second over the window. */
  fps: number;
  /** Median browser-measured round trip, in milliseconds. */
  p50Ms: number;
  /** 95th percentile round trip, in milliseconds. */
  p95Ms: number;
  /** Median time the server reported for decode + batching + inference. */
  serverP50Ms: number;
  samples: number;
}

interface Sample {
  at: number;
  roundTripMs: number;
  serverMs: number;
}

/** Nearest-rank percentile of an already sorted array. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? 0;
}

/**
 * Time-windowed stats for one stream.
 *
 * Only the last `windowMs` of results count, so the readout reacts within a couple of
 * seconds when the network or the server slows down instead of averaging over the
 * whole session.
 */
export class RollingStats {
  private samples: Sample[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 3000) {
    this.windowMs = windowMs;
  }

  add(at: number, roundTripMs: number, serverMs: number): void {
    this.samples.push({ at, roundTripMs, serverMs });
    this.evict(at);
  }

  snapshot(now: number): StreamStats {
    this.evict(now);
    const n = this.samples.length;
    if (n === 0) return { fps: 0, p50Ms: 0, p95Ms: 0, serverP50Ms: 0, samples: 0 };
    const rtt = this.samples.map((s) => s.roundTripMs).sort((a, b) => a - b);
    const server = this.samples.map((s) => s.serverMs).sort((a, b) => a - b);
    // Rate over the span actually covered, so a fresh stream does not read as 0 fps.
    const first = this.samples[0]?.at ?? now;
    const span = Math.max(now - first, 1);
    const fps = n < 2 ? 0 : ((n - 1) * 1000) / Math.min(span, this.windowMs);
    return {
      fps,
      p50Ms: percentile(rtt, 50),
      p95Ms: percentile(rtt, 95),
      serverP50Ms: percentile(server, 50),
      samples: n,
    };
  }

  reset(): void {
    this.samples = [];
  }

  private evict(now: number): void {
    const cutoff = now - this.windowMs;
    let drop = 0;
    while ((this.samples[drop]?.at ?? Infinity) < cutoff) drop++;
    if (drop) this.samples.splice(0, drop);
  }
}
