export interface CameraInfo {
  deviceId: string;
  label: string;
}

/**
 * Video inputs the browser exposes.
 *
 * Labels are empty until the page has been granted camera access once, so unnamed
 * devices get a numbered fallback instead of a blank entry in the picker.
 */
export async function listCameras(
  media: Pick<MediaDevices, "enumerateDevices"> = navigator.mediaDevices,
): Promise<CameraInfo[]> {
  const devices = await media.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

/** Open one camera at a modest resolution; detection does not need more than 720p. */
export function openCamera(
  deviceId: string | undefined,
  media: Pick<MediaDevices, "getUserMedia"> = navigator.mediaDevices,
): Promise<MediaStream> {
  return media.getUserMedia({
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Fit `width` x `height` inside `maxWidth`, keeping the aspect ratio. Never upscales. */
export function encodeSize(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (width <= maxWidth || width === 0) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * scale) };
}

type Source = CanvasImageSource & { videoWidth: number; videoHeight: number };

/**
 * Grabs JPEG frames from a <video> element through a reusable canvas.
 *
 * Frames are downscaled to `maxWidth` before encoding: a 640 px JPEG is a few tens of
 * kilobytes, which keeps upload time small next to inference time, and the server
 * reports boxes in the encoded frame's pixel space, which the overlay rescales anyway.
 */
export class FrameEncoder {
  private readonly canvas: HTMLCanvasElement;
  private readonly maxWidth: number;
  private readonly quality: number;

  constructor(
    maxWidth = 640,
    quality = 0.8,
    canvas: HTMLCanvasElement = document.createElement("canvas"),
  ) {
    this.canvas = canvas;
    this.maxWidth = maxWidth;
    this.quality = quality;
  }

  /** Encode the current video frame, or resolve to null if no frame is available yet. */
  encode(video: Source): Promise<Blob | null> {
    const { width, height } = encodeSize(video.videoWidth, video.videoHeight, this.maxWidth);
    if (width === 0 || height === 0) return Promise.resolve(null);
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, width, height);
    return new Promise((resolve) => this.canvas.toBlob(resolve, "image/jpeg", this.quality));
  }
}
