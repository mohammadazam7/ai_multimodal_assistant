import type { Detection } from "../api/types";
import { drawDetections, formatLabel, labelColor, scaleBox } from "./draw";

const det = (x1: number, y1: number, x2: number, y2: number, label = "person"): Detection => ({
  label,
  confidence: 0.876,
  box: { x1, y1, x2, y2 },
});

describe("scaleBox", () => {
  test("scales from source pixels to canvas pixels", () => {
    const box = scaleBox(det(64, 48, 320, 240), { width: 640, height: 480 }, { width: 320, height: 240 });
    expect(box).toEqual({ x: 32, y: 24, width: 128, height: 96 });
  });

  test("clamps boxes that spill past the frame", () => {
    const box = scaleBox(det(-10, -10, 700, 500), { width: 640, height: 480 }, { width: 640, height: 480 });
    expect(box).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  test("returns an empty box for a zero-sized source", () => {
    const box = scaleBox(det(1, 1, 2, 2), { width: 0, height: 0 }, { width: 100, height: 100 });
    expect(box.width).toBe(0);
    expect(box.height).toBe(0);
  });
});

test("labelColor is stable per label and differs between labels", () => {
  expect(labelColor("person")).toBe(labelColor("person"));
  expect(labelColor("person")).not.toBe(labelColor("car"));
});

test("formatLabel rounds confidence to a whole percent", () => {
  expect(formatLabel(det(0, 0, 1, 1))).toBe("person 88%");
});

describe("drawDetections", () => {
  function fakeContext() {
    return {
      clearRect: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 }) as TextMetrics),
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      font: "",
      textBaseline: "alphabetic" as CanvasTextBaseline,
    };
  }

  test("clears the canvas and draws a box and tag per detection", () => {
    const ctx = fakeContext();
    const size = { width: 640, height: 480 };
    drawDetections(ctx, [det(10, 100, 50, 200), det(300, 5, 400, 50, "car")], size, size);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(ctx.strokeRect).toHaveBeenNthCalledWith(1, 10, 100, 40, 100);
    expect(ctx.fillText).toHaveBeenNthCalledWith(1, "person 88%", 13, 86);
    // Near the top edge the tag moves inside the box.
    expect(ctx.fillText).toHaveBeenNthCalledWith(2, "car 88%", 303, 7);
  });

  test("skips degenerate boxes", () => {
    const ctx = fakeContext();
    const size = { width: 100, height: 100 };
    drawDetections(ctx, [det(50, 50, 50, 80)], size, size);
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
});
