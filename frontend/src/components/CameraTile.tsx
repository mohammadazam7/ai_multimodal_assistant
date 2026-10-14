import { useEffect, useRef, useState } from "react";

import { DetectionStream, streamUrl, type StreamState } from "../api/stream";
import { FrameEncoder, openCamera, stopCamera } from "../camera/capture";
import { RollingStats, type StreamStats } from "../metrics/rolling";
import { drawDetections } from "../overlay/draw";

export interface CameraTileProps {
  /** Undefined means "the browser's default camera". */
  deviceId: string | undefined;
  label: string;
  onRemove: () => void;
}

type TileStatus = StreamState | "starting" | "error";

const EMPTY_STATS: StreamStats = { fps: 0, p50Ms: 0, p95Ms: 0, serverP50Ms: 0, samples: 0 };

/**
 * One camera: live video, a canvas overlay with the latest boxes, and its own
 * WebSocket to the server.
 *
 * Capture is paced by the server rather than by a timer: a new frame is encoded only
 * when the previous one has been answered, so a slow server lowers the frame rate
 * instead of building up a queue.
 */
export function CameraTile({ deviceId, label, onRemove }: CameraTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<TileStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats>(EMPTY_STATS);
  const [dropped, setDropped] = useState(0);

  useEffect(() => {
    let media: MediaStream | null = null;
    let frame = 0;
    let encoding = false;
    let cancelled = false;
    const rolling = new RollingStats();
    const encoder = new FrameEncoder();

    const stream = new DetectionStream(streamUrl(), {
      onStateChange: (state, reason) => {
        if (cancelled) return;
        setStatus(state);
        if (state === "closed" && reason) setError(reason);
      },
      onError: (message) => setError(message.error),
      onResult: (result, roundTripMs) => {
        rolling.add(performance.now(), roundTripMs, result.total_ms);
        setDropped(result.dropped);
        const canvas = overlayRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        drawDetections(ctx, result.detections, result, canvas);
      },
    });

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && !encoding && stream.status === "open" && !stream.busy) {
        encoding = true;
        void encoder.encode(video).then((blob) => {
          encoding = false;
          if (blob && !cancelled) stream.send(blob);
        });
      }
      frame = requestAnimationFrame(tick);
    };

    openCamera(deviceId)
      .then(async (opened) => {
        if (cancelled) return stopCamera(opened);
        media = opened;
        const video = videoRef.current;
        if (video) {
          video.srcObject = opened;
          await video.play();
        }
        stream.open();
        frame = requestAnimationFrame(tick);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      });

    const readout = setInterval(() => setStats(rolling.snapshot(performance.now())), 500);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearInterval(readout);
      stream.close();
      stopCamera(media);
    };
  }, [deviceId]);

  return (
    <figure className="tile">
      <div className="tile-view">
        <video ref={videoRef} muted playsInline />
        <canvas ref={overlayRef} className="tile-overlay" />
      </div>
      <figcaption className="tile-bar">
        <span className="tile-label" title={label}>
          {label}
        </span>
        <span className={`tile-status tile-status-${status}`}>{status}</span>
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
          Remove
        </button>
      </figcaption>
      <dl className="tile-stats">
        <dt>FPS</dt>
        <dd>{stats.fps.toFixed(1)}</dd>
        <dt>p50</dt>
        <dd>{Math.round(stats.p50Ms)} ms</dd>
        <dt>p95</dt>
        <dd>{Math.round(stats.p95Ms)} ms</dd>
        <dt>server</dt>
        <dd>{Math.round(stats.serverP50Ms)} ms</dd>
        <dt>dropped</dt>
        <dd>{dropped}</dd>
      </dl>
      {error && (
        <p className="tile-error" role="alert">
          {error}
        </p>
      )}
    </figure>
  );
}
