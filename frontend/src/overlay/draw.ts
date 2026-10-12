import type { Detection } from "../api/types";

export interface Size {
  width: number;
  height: number;
}

export interface ScaledBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Map a box from the image the server saw onto the canvas it is drawn on.
 *
 * The server reports boxes in the pixel space of the frame it decoded, which is usually
 * the capture resolution, while the canvas is sized to whatever the layout gives it.
 * Boxes are clamped to the canvas so a slightly out-of-frame prediction still draws.
 */
export function scaleBox(detection: Detection, source: Size, target: Size): ScaledBox {
  const sx = source.width > 0 ? target.width / source.width : 0;
  const sy = source.height > 0 ? target.height / source.height : 0;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  const x1 = clamp(detection.box.x1 * sx, target.width);
  const y1 = clamp(detection.box.y1 * sy, target.height);
  const x2 = clamp(detection.box.x2 * sx, target.width);
  const y2 = clamp(detection.box.y2 * sy, target.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** A stable colour per label, so "person" is the same colour in every tile. */
export function labelColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 85% 55%)`;
}

export function formatLabel(detection: Detection): string {
  return `${detection.label} ${Math.round(detection.confidence * 100)}%`;
}

type Ctx = Pick<
  CanvasRenderingContext2D,
  | "clearRect"
  | "strokeRect"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "strokeStyle"
  | "fillStyle"
  | "lineWidth"
  | "font"
  | "textBaseline"
>;

/** Clear the overlay and draw one labelled rectangle per detection. */
export function drawDetections(
  ctx: Ctx,
  detections: readonly Detection[],
  source: Size,
  target: Size,
): void {
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.lineWidth = 2;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "top";
  for (const detection of detections) {
    const box = scaleBox(detection, source, target);
    if (box.width <= 0 || box.height <= 0) continue;
    const color = labelColor(detection.label);
    ctx.strokeStyle = color;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    const text = formatLabel(detection);
    const textWidth = ctx.measureText(text).width + 6;
    // Put the tag above the box unless that would push it off the top edge.
    const tagY = box.y >= 16 ? box.y - 16 : box.y;
    ctx.fillStyle = color;
    ctx.fillRect(box.x, tagY, textWidth, 16);
    ctx.fillStyle = "#000";
    ctx.fillText(text, box.x + 3, tagY + 2);
  }
}
