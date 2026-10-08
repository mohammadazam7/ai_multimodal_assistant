from __future__ import annotations

import base64
import io
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.detector import Frame, NullDetector, _resolve_device
from app.main import create_app
from app.schemas import Box, Detection


class FakeDetector:
    name = "fake"
    device = "cpu"

    def __init__(self) -> None:
        self.seen: list[tuple[int, ...]] = []

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        self.seen.extend(f.shape for f in frames)
        return [
            [Detection(label="person", confidence=0.91, box=Box(x1=1, y1=2, x2=30, y2=40))]
            for _ in frames
        ]


def _png(width: int = 64, height: int = 48) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.zeros((height, width, 3), dtype=np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def detector() -> FakeDetector:
    return FakeDetector()


@pytest.fixture
def client(detector: FakeDetector) -> Iterator[TestClient]:
    app = create_app(Settings(detector="null", max_image_bytes=50_000), detector=detector)
    with TestClient(app) as c:
        yield c


def test_healthz(client: TestClient) -> None:
    body = client.get("/healthz").json()
    assert body == {"status": "ok", "model": "fake", "device": "cpu", "ready": True}


def test_detect_multipart(client: TestClient, detector: FakeDetector) -> None:
    resp = client.post("/v1/detect", files={"file": ("f.png", _png(), "image/png")})
    assert resp.status_code == 200
    body = resp.json()
    assert (body["width"], body["height"]) == (64, 48)
    assert body["detections"][0]["label"] == "person"
    assert body["inference_ms"] >= 0 and body["total_ms"] >= body["inference_ms"]
    assert detector.seen == [(48, 64, 3)]


def test_detect_base64_accepts_data_url(client: TestClient) -> None:
    payload = "data:image/png;base64," + base64.b64encode(_png()).decode()
    resp = client.post("/v1/detect/base64", json={"image": payload})
    assert resp.status_code == 200
    assert len(resp.json()["detections"]) == 1


def test_rejects_non_image(client: TestClient) -> None:
    resp = client.post("/v1/detect", files={"file": ("x.txt", b"not an image", "text/plain")})
    assert resp.status_code == 415


def test_rejects_bad_base64(client: TestClient) -> None:
    assert client.post("/v1/detect/base64", json={"image": "%%%"}).status_code == 422


def test_rejects_oversized_image(client: TestClient) -> None:
    noisy = io.BytesIO()
    Image.fromarray(np.random.default_rng(0).integers(0, 255, (400, 400, 3), np.uint8)).save(
        noisy, format="PNG"
    )
    assert len(noisy.getvalue()) > 50_000  # noise doesn't compress
    resp = client.post("/v1/detect", files={"file": ("n.png", noisy.getvalue(), "image/png")})
    assert resp.status_code == 413


def test_null_detector_returns_empty_lists() -> None:
    assert NullDetector().predict([np.zeros((2, 2, 3), np.uint8)] * 3) == [[], [], []]


@pytest.mark.parametrize(
    ("requested", "cuda", "expected"),
    [
        ("auto", True, "cuda:0"),
        ("auto", False, "cpu"),
        ("cuda:1", False, "cpu"),
        ("cpu", True, "cpu"),
    ],
)
def test_resolve_device(requested: str, cuda: bool, expected: str) -> None:
    assert _resolve_device(requested, cuda) == expected


def test_concurrent_requests_are_batched() -> None:
    detector = FakeDetector()
    settings = Settings(detector="null", batch_max_size=4, batch_max_wait_ms=200)
    app = create_app(settings, detector=detector)
    calls: list[int] = []
    original = detector.predict

    def counting_predict(frames: list[Frame]) -> list[list[Detection]]:
        calls.append(len(frames))
        return original(frames)

    detector.predict = counting_predict  # type: ignore[method-assign]
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=4) as pool:
        files = {"file": ("f.png", _png(), "image/png")}
        responses = list(pool.map(lambda _: client.post("/v1/detect", files=files), range(4)))

    assert all(r.status_code == 200 for r in responses)
    assert sum(calls) == 4
    assert len(calls) < 4  # at least two requests shared a forward pass
