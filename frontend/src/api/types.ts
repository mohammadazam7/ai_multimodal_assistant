// Mirrors backend/app/schemas.py. Keep the two in step when the API changes.

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  label: string;
  confidence: number;
  box: Box;
}

export interface DetectionResponse {
  detections: Detection[];
  /** Size of the image the boxes refer to, in pixels. */
  width: number;
  height: number;
  model: string;
  /** Batch wait + model forward pass. */
  inference_ms: number;
  /** Decode + batch wait + inference + post-processing, measured on the server. */
  total_ms: number;
}

export interface StreamResult extends DetectionResponse {
  /** 1-based number of the frame on this connection. */
  seq: number;
  /** Frames on this connection the server skipped as stale so far. */
  dropped: number;
}

export interface StreamError {
  seq: number;
  error: string;
}

export interface Health {
  status: string;
  model: string;
  device: string;
  ready: boolean;
}

export function isStreamError(message: StreamResult | StreamError): message is StreamError {
  return "error" in message;
}
