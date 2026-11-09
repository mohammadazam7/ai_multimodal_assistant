import { z } from "zod";

/**
 * A recorded detection session, as `python -m tools.record_session` writes it.
 * Boxes are normalised to the frame: [x1, y1, x2, y2] in 0..1.
 */
const unit = z.number().min(0).max(1);

export const DetectionSchema = z.object({
  label: z.string().min(1),
  confidence: unit,
  box: z.tuple([unit, unit, unit, unit]).refine(([x1, y1, x2, y2]) => x2 >= x1 && y2 >= y1, {
    message: "box corners are out of order",
  }),
});

export const FrameSchema = z.object({
  t: z.number().min(0),
  inference_ms: z.number().min(0),
  detections: z.array(DetectionSchema),
});

export const CameraSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frames: z.array(FrameSchema).min(1),
});

export const SessionSchema = z.object({
  schema_version: z.literal(1),
  model: z.string(),
  device: z.string(),
  confidence_threshold: unit,
  sample_fps: z.number().positive(),
  hardware: z.string(),
  sources: z.array(z.object({ camera: z.string(), file: z.string(), credit: z.string() })).min(1),
  summary: z.object({
    frames: z.number().int(),
    detections: z.number().int(),
    labels: z.record(z.number().int()),
    latency_ms: z.object({ p50: z.number(), p95: z.number(), mean: z.number() }),
  }),
  cameras: z.record(CameraSchema),
});

export type Detection = z.infer<typeof DetectionSchema>;
export type Frame = z.infer<typeof FrameSchema>;
export type Camera = z.infer<typeof CameraSchema>;
export type Session = z.infer<typeof SessionSchema>;
