import { isStreamError, type StreamError, type StreamResult } from "./types";

export type StreamState = "connecting" | "open" | "closed";

export interface StreamEvents {
  onResult?: (result: StreamResult, roundTripMs: number) => void;
  onError?: (error: StreamError) => void;
  onStateChange?: (state: StreamState, reason?: string) => void;
}

/** ws:// or wss:// URL for an API path on the page's own origin. */
export function streamUrl(path = "/v1/stream", location: Location = window.location): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}${path}`;
}

/**
 * One camera's connection to `/v1/stream`.
 *
 * The client keeps at most one frame in flight: `send` returns false while the previous
 * frame is still unanswered, and the caller simply skips that capture. The server drops
 * stale frames too, but not sending them at all saves upload bandwidth and keeps the
 * measured round trip honest (it never includes time spent queued behind older frames).
 */
export class DetectionStream {
  private socket: WebSocket | null = null;
  private inFlightSince: number | null = null;
  private state: StreamState = "closed";
  private readonly url: string;
  private readonly events: StreamEvents;
  private readonly now: () => number;

  constructor(url: string, events: StreamEvents, now: () => number = () => performance.now()) {
    this.url = url;
    this.events = events;
    this.now = now;
  }

  get status(): StreamState {
    return this.state;
  }

  get busy(): boolean {
    return this.inFlightSince !== null;
  }

  open(): void {
    if (this.socket) return;
    const socket = new WebSocket(this.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    this.setState("connecting");

    socket.onopen = () => this.setState("open");
    socket.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    socket.onclose = (event: CloseEvent) => {
      this.socket = null;
      this.inFlightSince = null;
      this.setState("closed", event.reason || undefined);
    };
  }

  /** Send one encoded frame. Returns false (and sends nothing) if not ready. */
  send(frame: Blob | ArrayBuffer): boolean {
    if (!this.socket || this.state !== "open" || this.busy) return false;
    this.inFlightSince = this.now();
    this.socket.send(frame);
    return true;
  }

  close(): void {
    this.socket?.close(1000, "client closed");
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;
    const message = JSON.parse(data) as StreamResult | StreamError;
    const roundTrip = this.inFlightSince === null ? 0 : this.now() - this.inFlightSince;
    this.inFlightSince = null;
    if (isStreamError(message)) this.events.onError?.(message);
    else this.events.onResult?.(message, roundTrip);
  }

  private setState(state: StreamState, reason?: string): void {
    this.state = state;
    this.events.onStateChange?.(state, reason);
  }
}
