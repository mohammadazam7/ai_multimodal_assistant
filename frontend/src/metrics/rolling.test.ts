import { percentile, RollingStats } from "./rolling";

describe("percentile", () => {
  test("uses nearest rank", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(100);
    expect(percentile(xs, 0)).toBe(10);
  });

  test("is zero for no data", () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe("RollingStats", () => {
  test("reports zeros before any result", () => {
    expect(new RollingStats().snapshot(0)).toEqual({
      fps: 0,
      p50Ms: 0,
      p95Ms: 0,
      serverP50Ms: 0,
      samples: 0,
    });
  });

  test("computes fps and latency percentiles over the window", () => {
    const stats = new RollingStats(3000);
    // 11 results, 100 ms apart -> 10 intervals over one second.
    for (let i = 0; i <= 10; i++) stats.add(i * 100, 40 + i, 20);
    const snap = stats.snapshot(1000);
    expect(snap.fps).toBeCloseTo(10);
    expect(snap.p50Ms).toBe(45);
    expect(snap.p95Ms).toBe(50);
    expect(snap.serverP50Ms).toBe(20);
    expect(snap.samples).toBe(11);
  });

  test("forgets results older than the window", () => {
    const stats = new RollingStats(1000);
    stats.add(0, 500, 400);
    stats.add(1500, 30, 10);
    stats.add(1600, 30, 10);
    const snap = stats.snapshot(1700);
    expect(snap.samples).toBe(2);
    expect(snap.p95Ms).toBe(30);
  });

  test("reset clears everything", () => {
    const stats = new RollingStats();
    stats.add(0, 10, 5);
    stats.reset();
    expect(stats.snapshot(0).samples).toBe(0);
  });
});
