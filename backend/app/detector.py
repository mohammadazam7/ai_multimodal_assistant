"""Detector backends behind one batch-oriented interface.

The API depends only on :class:`Detector`. ``predict`` takes a *list* of frames so the
multi-stream batcher (see docs/ROADMAP.md) can feed several cameras through one forward
pass without changing this contract.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol

import numpy as np
from numpy.typing import NDArray

from app.config import Settings
from app.schemas import Box, Detection

log = logging.getLogger(__name__)

Frame = NDArray[np.uint8]  # H x W x 3, RGB


class Detector(Protocol):
    name: str
    device: str

    def predict(self, frames: list[Frame]) -> list[list[Detection]]: ...


class NullDetector:
    """Returns no detections. Lets the API run without torch installed."""

    name = "null"
    device = "cpu"

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        return [[] for _ in frames]


class YoloDetector:
    """Ultralytics YOLO model, FP16 on CUDA when enabled."""

    def __init__(self, model_path: str, device: str, half: bool, confidence: float) -> None:
        import torch
        from ultralytics import YOLO

        self.device = _resolve_device(device, torch.cuda.is_available())
        self.half = half and self.device.startswith("cuda")
        self.confidence = confidence
        self.model: Any = YOLO(model_path)
        self.model.to(self.device)
        self.name = f"{model_path}{' (fp16)' if self.half else ''}"
        log.info("loaded %s on %s", self.name, self.device)

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        if not frames:
            return []
        results = self.model.predict(
            frames, conf=self.confidence, half=self.half, device=self.device, verbose=False
        )
        names: dict[int, str] = self.model.names
        out: list[list[Detection]] = []
        for result in results:
            boxes = result.boxes
            xyxy = boxes.xyxy.cpu().numpy()
            conf = boxes.conf.cpu().numpy()
            cls = boxes.cls.cpu().numpy().astype(int)
            out.append(
                [
                    Detection(
                        label=names[int(c)],
                        confidence=round(float(p), 4),
                        box=Box(x1=float(b[0]), y1=float(b[1]), x2=float(b[2]), y2=float(b[3])),
                    )
                    for b, p, c in zip(xyxy, conf, cls, strict=True)
                ]
            )
        return out


def _resolve_device(requested: str, cuda_available: bool) -> str:
    if requested == "auto":
        return "cuda:0" if cuda_available else "cpu"
    if requested.startswith("cuda") and not cuda_available:
        log.warning("CUDA requested but unavailable, falling back to CPU")
        return "cpu"
    return requested


def build_detector(settings: Settings) -> Detector:
    if settings.detector == "null":
        return NullDetector()
    return YoloDetector(
        settings.model_path, settings.device, settings.half_precision, settings.confidence
    )
