from __future__ import annotations

import io
import threading
import time
from collections.abc import Iterator

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from starlette.websockets import WebSocketDisconnect

from app.config import Settings
from app.detector import Frame
from app.main import create_app
from app.schemas import Box, Detection


class GatedDetector:
    """Fake detector whose forward pass can be held open to simulate a slow model."""

    name = "gated"
    device = "cpu"

    def __init__(self) -> None:
        self.gate = threading.Event()
        self.gate.set()
        self.entered = threading.Event()
        self.batches: list[int] = []

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        self.entered.set()
        self.gate.wait(timeout=5)
        self.batches.append(len(frames))
        return [
            [Detection(label="car", confidence=0.8, box=Box(x1=0, y1=0, x2=5, y2=5))]
            for _ in frames
        ]


def _png(width: int = 32, height: int = 24) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.zeros((height, width, 3), dtype=np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def detector() -> GatedDetector:
    return GatedDetector()


@pytest.fixture
def client(detector: GatedDetector) -> Iterator[TestClient]:
    settings = Settings(detector="null", max_image_bytes=10_000, batch_max_wait_ms=0)
    with TestClient(create_app(settings, detector=detector)) as c:
        yield c


def test_each_frame_gets_a_result(client: TestClient) -> None:
    with client.websocket_connect("/v1/stream") as ws:
        for seq in (1, 2):
            ws.send_bytes(_png())
            body = ws.receive_json()
            assert body["seq"] == seq
            assert body["dropped"] == 0
            assert (body["width"], body["height"]) == (32, 24)
            assert body["detections"][0]["label"] == "car"
            assert body["model"] == "gated"


def test_stale_frames_are_dropped_while_model_is_busy(
    client: TestClient, detector: GatedDetector
) -> None:
    detector.gate.clear()
    with client.websocket_connect("/v1/stream") as ws:
        ws.send_bytes(_png())
        assert detector.entered.wait(timeout=5)  # frame 1 is now inside the model
        for _ in range(3):
            ws.send_bytes(_png())  # frames 2-4 arrive while the model is busy
        time.sleep(0.2)  # let the server read them into the slot
        detector.gate.set()

        first, second = ws.receive_json(), ws.receive_json()

    assert first["seq"] == 1
    assert second["seq"] == 4  # only the newest waiting frame is processed
    assert second["dropped"] == 2
    assert detector.batches == [1, 1]


def test_undecodable_frame_reports_error_and_stream_continues(client: TestClient) -> None:
    with client.websocket_connect("/v1/stream") as ws:
        ws.send_bytes(b"definitely not an image")
        error = ws.receive_json()
        assert error["seq"] == 1
        assert "error" in error

        ws.send_bytes(_png())
        assert ws.receive_json()["seq"] == 2


def test_text_message_closes_with_unsupported_data(client: TestClient) -> None:
    with client.websocket_connect("/v1/stream") as ws:
        ws.send_text("hello")
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 1003


def test_oversized_frame_closes_with_message_too_big(client: TestClient) -> None:
    with client.websocket_connect("/v1/stream") as ws:
        ws.send_bytes(b"\0" * 10_001)
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 1009


def test_model_failure_closes_with_internal_error() -> None:
    class BrokenDetector:
        name = "broken"
        device = "cpu"

        def predict(self, frames: list[Frame]) -> list[list[Detection]]:
            raise RuntimeError("CUDA out of memory")

    app = create_app(Settings(detector="null"), detector=BrokenDetector())
    with TestClient(app) as c, c.websocket_connect("/v1/stream") as ws:
        ws.send_bytes(_png())
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 1011
