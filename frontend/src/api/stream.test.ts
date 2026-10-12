import { DetectionStream, streamUrl, type StreamState } from "./stream";
import type { StreamResult } from "./types";

class FakeSocket {
  static last: FakeSocket | null = null;
  binaryType = "blob";
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { reason: string }) => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.last = this;
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close(_code?: number, reason = "") {
    this.onclose?.({ reason });
  }

  serverSends(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const result: StreamResult = {
  seq: 1,
  dropped: 0,
  detections: [],
  width: 640,
  height: 480,
  model: "null",
  inference_ms: 3,
  total_ms: 5,
};

let clock = 0;

beforeEach(() => {
  clock = 0;
  FakeSocket.last = null;
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openStream(events = {}) {
  const stream = new DetectionStream("ws://test/v1/stream", events, () => clock);
  stream.open();
  const socket = FakeSocket.last!;
  socket.onopen?.();
  return { stream, socket };
}

test("streamUrl follows the page scheme", () => {
  expect(streamUrl("/v1/stream", { protocol: "http:", host: "a:5173" } as Location)).toBe(
    "ws://a:5173/v1/stream",
  );
  expect(streamUrl("/v1/stream", { protocol: "https:", host: "b.example" } as Location)).toBe(
    "wss://b.example/v1/stream",
  );
});

test("reports state changes and receives binary as arraybuffer", () => {
  const states: StreamState[] = [];
  const { stream, socket } = openStream({ onStateChange: (s: StreamState) => states.push(s) });
  expect(socket.binaryType).toBe("arraybuffer");
  stream.close();
  expect(states).toEqual(["connecting", "open", "closed"]);
});

test("keeps at most one frame in flight", () => {
  const { stream, socket } = openStream();
  expect(stream.send(new ArrayBuffer(4))).toBe(true);
  expect(stream.send(new ArrayBuffer(4))).toBe(false);
  expect(socket.sent).toHaveLength(1);

  socket.serverSends(result);
  expect(stream.send(new ArrayBuffer(4))).toBe(true);
  expect(socket.sent).toHaveLength(2);
});

test("measures round trip from send to result", () => {
  const onResult = vi.fn();
  const { stream, socket } = openStream({ onResult });
  clock = 100;
  stream.send(new ArrayBuffer(1));
  clock = 142;
  socket.serverSends(result);
  expect(onResult).toHaveBeenCalledWith(result, 42);
});

test("routes server errors to onError and frees the slot", () => {
  const onError = vi.fn();
  const onResult = vi.fn();
  const { stream, socket } = openStream({ onError, onResult });
  stream.send(new ArrayBuffer(1));
  socket.serverSends({ seq: 1, error: "not an image" });
  expect(onError).toHaveBeenCalledWith({ seq: 1, error: "not an image" });
  expect(onResult).not.toHaveBeenCalled();
  expect(stream.busy).toBe(false);
});

test("does not send before the socket opens or after it closes", () => {
  const stream = new DetectionStream("ws://test/v1/stream", {}, () => clock);
  expect(stream.send(new ArrayBuffer(1))).toBe(false);
  stream.open();
  expect(stream.send(new ArrayBuffer(1))).toBe(false);
  FakeSocket.last!.onopen?.();
  stream.close();
  expect(stream.send(new ArrayBuffer(1))).toBe(false);
});
