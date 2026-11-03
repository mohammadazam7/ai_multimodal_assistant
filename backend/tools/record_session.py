"""Record a detection session from video files for the Vision Control Room.

Runs a :class:`~app.detector.Detector` over one or more video files, each treated as a
camera, sampling frames at a fixed rate. For every sampled frame it keeps the detections
(label, confidence and a box normalised to the frame size) and the measured inference
time, then writes one JSON document that the web app renders.

Nothing in the output is simulated: every detection and every latency figure comes from
running the model on the frames named in ``sources``.

Usage (from backend/)::

    python -m tools.record_session --model yolov8s.pt --confidence 0.65 \\
        --camera street=path/to/vtest.avi --camera classroom=path/to/classroom.mp4 \\
        --fps 4 --out ../web/public/data/session.json
"""

from __future__ import annotations

import argparse
import json
import platform
import statistics
import time
from collections import Counter
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.detector import Detector, Frame
from app.schemas import Detection

SCHEMA_VERSION = 1


@dataclass(frozen=True, slots=True)
class Camera:
    name: str
    path: Path
    credit: str = ""


@dataclass(frozen=True, slots=True)
class SampledFrame:
    t: float  # seconds from the start of the video
    image: Frame


def sample_frames(
    path: Path, fps: float, max_seconds: float | None = None
) -> Iterator[SampledFrame]:
    """Yield RGB frames from ``path`` at roughly ``fps`` frames per second."""
    import cv2

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"cannot open video {path}")
    native = cap.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, round(native / fps))
    index = 0
    try:
        while True:
            ok, bgr = cap.read()
            if not ok:
                return
            t = index / native
            if max_seconds is not None and t > max_seconds:
                return
            if index % step == 0:
                rgb = np.asarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), dtype=np.uint8)
                yield SampledFrame(round(t, 3), rgb)
            index += 1
    finally:
        cap.release()


def _normalise(d: Detection, width: int, height: int) -> dict[str, Any]:
    b = d.box
    return {
        "label": d.label,
        "confidence": round(d.confidence, 3),
        "box": [
            round(max(0.0, b.x1 / width), 4),
            round(max(0.0, b.y1 / height), 4),
            round(min(1.0, b.x2 / width), 4),
            round(min(1.0, b.y2 / height), 4),
        ],
    }


def record_camera(detector: Detector, frames: Iterable[SampledFrame]) -> dict[str, Any]:
    """Run ``detector`` frame by frame and collect detections and per-frame latency."""
    out_frames: list[dict[str, Any]] = []
    width = height = 0
    for frame in frames:
        height, width = frame.image.shape[:2]
        start = time.perf_counter()
        (detections,) = detector.predict([frame.image])
        ms = (time.perf_counter() - start) * 1000
        out_frames.append(
            {
                "t": frame.t,
                "inference_ms": round(ms, 1),
                "detections": [_normalise(d, width, height) for d in detections],
            }
        )
    return {"width": width, "height": height, "frames": out_frames}


def summarise(cameras: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Counts by label and latency percentiles across every recorded frame."""
    labels: Counter[str] = Counter()
    latencies: list[float] = []
    frames = 0
    for cam in cameras.values():
        for f in cam["frames"]:
            frames += 1
            latencies.append(f["inference_ms"])
            labels.update(d["label"] for d in f["detections"])
    if not latencies:
        return {"frames": 0, "detections": 0, "labels": {}, "latency_ms": {}}
    arr = np.asarray(latencies)
    return {
        "frames": frames,
        "detections": sum(labels.values()),
        "labels": dict(labels.most_common()),
        "latency_ms": {
            "p50": round(float(np.percentile(arr, 50)), 1),
            "p95": round(float(np.percentile(arr, 95)), 1),
            "mean": round(statistics.fmean(latencies), 1),
        },
    }


def build_session(
    detector: Detector,
    cameras: Sequence[Camera],
    fps: float,
    confidence: float,
    max_seconds: float | None = None,
) -> dict[str, Any]:
    recorded = {
        cam.name: record_camera(detector, sample_frames(cam.path, fps, max_seconds))
        for cam in cameras
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "model": detector.name,
        "device": detector.device,
        "confidence_threshold": confidence,
        "sample_fps": fps,
        "hardware": f"{platform.processor() or platform.machine()} ({platform.system()})",
        "sources": [{"camera": c.name, "file": c.path.name, "credit": c.credit} for c in cameras],
        "summary": summarise(recorded),
        "cameras": recorded,
    }


def _parse_camera(spec: str) -> Camera:
    name, _, rest = spec.partition("=")
    path, _, credit = rest.partition("|")
    if not name or not path:
        raise argparse.ArgumentTypeError("use NAME=PATH or NAME=PATH|CREDIT")
    return Camera(name, Path(path), credit)


def main(argv: Sequence[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--camera", type=_parse_camera, action="append", required=True)
    p.add_argument("--model", default="yolov8s.pt")
    p.add_argument("--device", default="cpu")
    p.add_argument("--confidence", type=float, default=0.65)
    p.add_argument("--fps", type=float, default=4.0)
    p.add_argument("--max-seconds", type=float, default=None)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)

    from app.detector import YoloDetector

    detector = YoloDetector(args.model, args.device, half=False, confidence=args.confidence)
    session = build_session(detector, args.camera, args.fps, args.confidence, args.max_seconds)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(session, separators=(",", ":")) + "\n")
    s = session["summary"]
    print(f"{s['frames']} frames, {s['detections']} detections, latency {s['latency_ms']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
