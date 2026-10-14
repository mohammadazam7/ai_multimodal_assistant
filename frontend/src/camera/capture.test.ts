import { encodeSize, FrameEncoder, listCameras, openCamera, stopCamera } from "./capture";

function device(kind: MediaDeviceKind, deviceId: string, label = ""): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: "g", toJSON: () => ({}) };
}

test("listCameras keeps video inputs and names unlabelled ones", async () => {
  const media = {
    enumerateDevices: vi
      .fn()
      .mockResolvedValue([
        device("audioinput", "mic"),
        device("videoinput", "a", "Front camera"),
        device("videoinput", "b"),
      ]),
  };
  expect(await listCameras(media)).toEqual([
    { deviceId: "a", label: "Front camera" },
    { deviceId: "b", label: "Camera 2" },
  ]);
});

test("openCamera asks for the exact device and no audio", async () => {
  const getUserMedia = vi.fn().mockResolvedValue({});
  await openCamera("cam-1", { getUserMedia });
  const constraints = getUserMedia.mock.calls[0]?.[0] as MediaStreamConstraints;
  expect(constraints.audio).toBe(false);
  expect((constraints.video as MediaTrackConstraints).deviceId).toEqual({ exact: "cam-1" });
});

test("stopCamera stops every track", () => {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  stopCamera({ getTracks: () => tracks } as unknown as MediaStream);
  tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  expect(() => stopCamera(null)).not.toThrow();
});

test("encodeSize downscales to the max width and never upscales", () => {
  expect(encodeSize(1280, 720, 640)).toEqual({ width: 640, height: 360 });
  expect(encodeSize(320, 240, 640)).toEqual({ width: 320, height: 240 });
  expect(encodeSize(0, 0, 640)).toEqual({ width: 0, height: 0 });
});

function fakeCanvas() {
  const ctx = { drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(ctx),
    toBlob: vi.fn((cb: (b: Blob | null) => void, type: string) => cb(new Blob(["x"], { type }))),
  };
  return { canvas, ctx };
}

test("FrameEncoder draws the scaled frame and encodes JPEG", async () => {
  const { canvas, ctx } = fakeCanvas();
  const encoder = new FrameEncoder(640, 0.7, canvas as unknown as HTMLCanvasElement);
  const video = { videoWidth: 1920, videoHeight: 1080 } as unknown as HTMLVideoElement;

  const blob = await encoder.encode(video);

  expect(blob?.type).toBe("image/jpeg");
  expect(canvas.width).toBe(640);
  expect(canvas.height).toBe(360);
  expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360);
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.7);
});

test("FrameEncoder returns null before the video has a frame", async () => {
  const { canvas } = fakeCanvas();
  const encoder = new FrameEncoder(640, 0.8, canvas as unknown as HTMLCanvasElement);
  const video = { videoWidth: 0, videoHeight: 0 } as unknown as HTMLVideoElement;
  expect(await encoder.encode(video)).toBeNull();
  expect(canvas.getContext).not.toHaveBeenCalled();
});
