"""Runs the benchmark client against a real server on a local port."""

from __future__ import annotations

import socket
import threading
import time
from collections.abc import Iterator

import pytest
import uvicorn

from app.config import Settings
from app.detector import Frame
from app.main import create_app
from app.schemas import Detection
from bench.client import replay_stream, run
from bench.frames import synthetic_frames

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class SlowDetector:
    """Takes a fixed time per forward pass, however many frames are in it."""

    name = "slow"
    device = "cpu"

    def __init__(self, seconds: float) -> None:
        self.seconds = seconds

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        time.sleep(self.seconds)
        return [[] for _ in frames]


def _serve(detector: SlowDetector) -> Iterator[str]:
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    app = create_app(Settings(detector="null", log_format="text"), detector=detector)
    server = uvicorn.Server(uvicorn.Config(app, log_level="warning", lifespan="on"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if time.monotonic() > deadline:
            raise RuntimeError("server did not start")
        time.sleep(0.01)
    try:
        yield f"ws://127.0.0.1:{port}/v1/stream"
    finally:
        server.should_exit = True
        thread.join(timeout=10)


@pytest.fixture
def fast_url() -> Iterator[str]:
    yield from _serve(SlowDetector(0.0))


@pytest.fixture
def slow_url() -> Iterator[str]:
    yield from _serve(SlowDetector(0.2))


FRAMES = synthetic_frames(8, width=64, height=48)


async def test_every_frame_is_answered_when_the_model_keeps_up(fast_url: str) -> None:
    outcome = await replay_stream(fast_url, FRAMES, fps=20, seconds=0.5)
    assert outcome.sent >= 9
    assert outcome.answered == outcome.sent
    assert outcome.dropped == 0
    assert len(outcome.latencies_ms) == outcome.answered
    assert all(ms > 0 for ms in outcome.latencies_ms)


async def test_stale_frames_are_counted_as_dropped(slow_url: str) -> None:
    # 50 fps against a model that takes 200 ms: most frames must be skipped.
    outcome = await replay_stream(slow_url, FRAMES, fps=50, seconds=0.6)
    assert outcome.dropped > 0
    assert outcome.answered + outcome.dropped == outcome.sent
    # Latency covers only answered frames and includes at least one forward pass.
    assert min(outcome.latencies_ms) >= 200


async def test_run_summarises_all_streams(fast_url: str) -> None:
    summary = await run(fast_url, FRAMES, streams=3, fps=20, seconds=0.5)
    assert summary.streams == 3
    assert summary.frames_answered == summary.frames_sent
    assert summary.latency.count == summary.frames_answered
    assert summary.throughput_fps > 0


async def test_rejects_a_non_positive_rate(fast_url: str) -> None:
    with pytest.raises(ValueError):
        await replay_stream(fast_url, FRAMES, fps=0, seconds=1)
