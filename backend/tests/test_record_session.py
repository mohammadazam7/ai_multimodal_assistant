import argparse
from pathlib import Path

import numpy as np
import pytest

from app.schemas import Box, Detection
from tools.record_session import (
    Camera,
    SampledFrame,
    _parse_camera,
    build_session,
    record_camera,
    summarise,
)


class _Fixed:
    name = "fixed"
    device = "cpu"

    def __init__(self, labels: list[str]) -> None:
        self.labels = labels

    def predict(self, frames: list[np.ndarray]) -> list[list[Detection]]:
        return [
            [
                Detection(label=lbl, confidence=0.9, box=Box(x1=10, y1=20, x2=330, y2=260))
                for lbl in self.labels
            ]
            for _ in frames
        ]


def _frames(n: int) -> list[SampledFrame]:
    return [SampledFrame(i * 0.25, np.zeros((240, 320, 3), dtype=np.uint8)) for i in range(n)]


def test_boxes_are_normalised_and_clipped() -> None:
    cam = record_camera(_Fixed(["person"]), _frames(2))
    assert (cam["width"], cam["height"]) == (320, 240)
    box = cam["frames"][0]["detections"][0]["box"]
    assert box == [pytest.approx(0.0312, abs=1e-3), pytest.approx(0.0833, abs=1e-3), 1.0, 1.0]
    assert all(f["inference_ms"] >= 0 for f in cam["frames"])


def test_summary_counts_labels_and_latency() -> None:
    cams = {
        "a": record_camera(_Fixed(["person", "car"]), _frames(3)),
        "b": record_camera(_Fixed(["person"]), _frames(2)),
    }
    s = summarise(cams)
    assert s["frames"] == 5
    assert s["labels"] == {"person": 5, "car": 3}
    assert s["detections"] == 8
    assert set(s["latency_ms"]) == {"p50", "p95", "mean"}


def test_empty_summary() -> None:
    assert summarise({"a": {"frames": []}})["frames"] == 0


def test_build_session_records_provenance(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("tools.record_session.sample_frames", lambda *a, **k: iter(_frames(2)))
    session = build_session(
        _Fixed(["person"]), [Camera("street", Path("vtest.avi"), "OpenCV")], 4.0, 0.65
    )
    assert session["sources"] == [{"camera": "street", "file": "vtest.avi", "credit": "OpenCV"}]
    assert session["confidence_threshold"] == 0.65
    assert session["summary"]["frames"] == 2


def test_parse_camera() -> None:
    cam = _parse_camera("street=clips/vtest.avi|OpenCV sample")
    assert cam == Camera("street", Path("clips/vtest.avi"), "OpenCV sample")
    with pytest.raises(argparse.ArgumentTypeError):
        _parse_camera("nopath")
