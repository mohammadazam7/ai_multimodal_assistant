import type { DetectionResponse, Health } from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // FastAPI errors look like {"detail": "..."}; fall back to the status text.
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // not JSON; keep the status text
    }
    throw new ApiError(response.status, detail || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return parse<Health>(await fetch("/healthz", { signal }));
}

/** Run detection on one still image (an uploaded file or a captured frame). */
export async function detectImage(image: Blob, signal?: AbortSignal): Promise<DetectionResponse> {
  const form = new FormData();
  form.append("file", image, "frame.jpg");
  return parse<DetectionResponse>(await fetch("/v1/detect", { method: "POST", body: form, signal }));
}
