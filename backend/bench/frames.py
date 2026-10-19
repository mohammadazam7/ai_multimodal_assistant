"""Frames to replay, encoded once up front so encoding cost stays out of the measurement."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
from PIL import Image


def encode_jpeg(rgb: np.ndarray, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def synthetic_frames(count: int, width: int = 640, height: int = 480, seed: int = 0) -> list[bytes]:
    """``count`` distinct JPEG frames of moving shapes on a gradient.

    Not a substitute for real video when measuring a detector, but enough to exercise
    the transport, decoding and batching paths with realistically sized payloads.
    """
    if count < 1:
        raise ValueError("count must be >= 1")
    rng = np.random.default_rng(seed)
    base = np.zeros((height, width, 3), dtype=np.uint8)
    base[..., 0] = np.linspace(0, 255, width, dtype=np.uint8)[None, :]
    base[..., 2] = np.linspace(0, 255, height, dtype=np.uint8)[:, None]
    side = max(1, min(80, width // 4, height // 4))
    boxes = rng.integers(0, [width - side, height - side], size=(4, 2))
    velocity = rng.integers(-6, 7, size=(4, 2))
    frames = []
    for i in range(count):
        frame = base.copy()
        for (x, y), (dx, dy) in zip(boxes, velocity, strict=True):
            cx = int((x + dx * i) % (width - side))
            cy = int((y + dy * i) % (height - side))
            frame[cy : cy + side, cx : cx + side] = (240, 240, 240)
        frames.append(encode_jpeg(frame))
    return frames


def video_frames(path: Path, max_frames: int = 300, width: int | None = 640) -> list[bytes]:
    """Decode up to ``max_frames`` from a video file and re-encode them as JPEG.

    Frames are resized to ``width`` (keeping the aspect ratio) so different clips put
    the same load on the service. Needs OpenCV, from the ``inference`` extra.
    """
    import cv2

    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError(f"cannot open video {path}")
    frames: list[bytes] = []
    try:
        while len(frames) < max_frames:
            ok, bgr = capture.read()
            if not ok:
                break
            if width is not None and bgr.shape[1] != width:
                height = round(bgr.shape[0] * width / bgr.shape[1])
                bgr = cv2.resize(bgr, (width, height), interpolation=cv2.INTER_AREA)
            frames.append(encode_jpeg(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)))
    finally:
        capture.release()
    if not frames:
        raise ValueError(f"no frames decoded from {path}")
    return frames
