import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { countSeries, duration, frameAt, labelRanking, occupancy } from "../src/data/derive";
import { SessionSchema } from "../src/data/schema";

const raw = JSON.parse(readFileSync(resolve(__dirname, "../public/data/session.json"), "utf8"));
const session = SessionSchema.parse(raw);
const street = session.cameras.street!;

describe("session schema", () => {
  it("accepts the recorded session", () => {
    expect(Object.keys(session.cameras)).toEqual(["street", "classroom"]);
    expect(session.summary.frames).toBe(
      Object.values(session.cameras).reduce((n, c) => n + c.frames.length, 0),
    );
  });

  it("rejects a box with corners out of order", () => {
    const broken = structuredClone(raw);
    const det = broken.cameras.street.frames.find((f: { detections: unknown[] }) => f.detections.length).detections[0];
    det.box = [0.9, 0.1, 0.2, 0.5];
    const parsed = SessionSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("box corners are out of order");
  });

  it("rejects a confidence outside 0..1", () => {
    const broken = structuredClone(raw);
    broken.cameras.street.frames.find((f: { detections: unknown[] }) => f.detections.length).detections[0].confidence = 1.4;
    expect(SessionSchema.safeParse(broken).success).toBe(false);
  });
});

describe("derived views", () => {
  it("ranks labels by count and matches the summary", () => {
    const ranking = labelRanking(session);
    expect(ranking[0]?.count).toBeGreaterThanOrEqual(ranking.at(-1)?.count ?? 0);
    expect(ranking.reduce((n, r) => n + r.count, 0)).toBe(session.summary.detections);
  });

  it("counts per frame add up to the label total", () => {
    const total = Object.values(session.cameras).reduce(
      (n, c) => n + countSeries(c, "person").reduce((m, p) => m + p.n, 0),
      0,
    );
    expect(total).toBe(session.summary.labels.person);
  });

  it("finds the nearest frame by time", () => {
    expect(frameAt(street, 0)).toBe(0);
    expect(frameAt(street, duration(street) + 100)).toBe(street.frames.length - 1);
    const mid = street.frames[10]!;
    expect(frameAt(street, mid.t + 0.01)).toBe(10);
  });

  it("puts every detection of a label in exactly one occupancy cell", () => {
    const grid = occupancy(street, "person", 8);
    expect(grid).toHaveLength(64);
    expect(grid.reduce((a, b) => a + b, 0)).toBe(countSeries(street, "person").reduce((a, p) => a + p.n, 0));
  });
});

describe("latency", () => {
  it("keeps warm-up frames out of the histogram and the percentiles", async () => {
    const { latencyHistogram, steadyLatency } = await import("../src/data/derive");
    const frame = (ms: number, t: number) => ({ t, inference_ms: ms, detections: [] });
    const session = {
      cameras: {
        a: { width: 4, height: 3, frames: [frame(9000, 0), frame(100, 0.25), frame(200, 0.5)] },
        b: { width: 4, height: 3, frames: [frame(8000, 0), frame(300, 0.25)] },
      },
    } as unknown as import("../src/data/schema").Session;
    const h = latencyHistogram(session, 4);
    expect(h.warmup).toEqual([9000, 8000]);
    expect(h.bins.reduce((n, b) => n + b.n, 0)).toBe(3);
    expect(h.bins[0]!.from).toBe(100);
    expect(steadyLatency(session).p50).toBe(200);
  });
});
