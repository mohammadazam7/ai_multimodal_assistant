from __future__ import annotations

import asyncio

import numpy as np
import pytest
from fastapi.testclient import TestClient
from test_api import FakeDetector, _png
from test_batching import FailingDetector, RecordingDetector

from app.batching import MicroBatcher
from app.config import Settings
from app.main import create_app
from app.metrics import Metrics


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def sample(metrics: Metrics, name: str, labels: dict[str, str] | None = None) -> float:
    value = metrics.registry.get_sample_value(name, labels or {})
    assert value is not None, f"{name} not exported"
    return value


def test_batch_observations_feed_both_histograms() -> None:
    m = Metrics()
    m.observe_batch(3, 0.012)
    m.observe_batch(1, 0.004)

    assert sample(m, "vision_batch_size_count") == 2
    assert sample(m, "vision_batch_size_sum") == 4
    assert sample(m, "vision_inference_seconds_bucket", {"le": "0.005"}) == 1
    assert sample(m, "vision_inference_seconds_bucket", {"le": "0.02"}) == 2


def test_queue_depth_is_read_at_scrape_time() -> None:
    m = Metrics()
    depth = [0]
    m.track_queue_depth(lambda: depth[0])
    depth[0] = 7

    assert sample(m, "vision_batch_queue_depth") == 7


@pytest.mark.anyio
async def test_batcher_reports_each_forward_pass() -> None:
    m = Metrics()
    b = MicroBatcher(RecordingDetector(), max_batch_size=4, max_wait_ms=20, observer=m)
    await b.start()
    try:
        await asyncio.gather(*(b.submit(np.zeros((4, 4, 3), np.uint8)) for _ in range(4)))
    finally:
        await b.stop()

    assert sample(m, "vision_batch_size_count") == 1
    assert sample(m, "vision_batch_size_sum") == 4
    assert sample(m, "vision_inference_seconds_count") == 1


@pytest.mark.anyio
async def test_batcher_counts_failed_passes() -> None:
    m = Metrics()
    b = MicroBatcher(FailingDetector(), max_batch_size=1, max_wait_ms=0, observer=m)
    await b.start()
    try:
        with pytest.raises(RuntimeError):
            await b.submit(np.zeros((4, 4, 3), np.uint8))
    finally:
        await b.stop()

    assert sample(m, "vision_batch_failures_total") == 1
    assert sample(m, "vision_batch_size_count") == 0


def test_metrics_endpoint_exposes_prometheus_text() -> None:
    app = create_app(Settings(detector="null"), detector=FakeDetector())
    with TestClient(app) as client:
        client.post("/v1/detect", files={"file": ("f.png", _png(), "image/png")})
        resp = client.get("/metrics")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")
    assert "vision_batch_size_count 1.0" in resp.text
    assert "vision_batch_queue_depth 0.0" in resp.text
