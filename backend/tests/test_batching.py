from __future__ import annotations

import asyncio
import threading
from collections.abc import AsyncIterator

import numpy as np
import pytest

from app.batching import BatcherClosedError, MicroBatcher
from app.detector import Frame
from app.schemas import Box, Detection

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class RecordingDetector:
    """Labels each detection with the frame's fill value so results can be matched up."""

    name = "recording"
    device = "cpu"

    def __init__(self, gate: threading.Event | None = None) -> None:
        self.batches: list[int] = []
        self.gate = gate

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        if self.gate is not None:
            self.gate.wait(timeout=5)
        self.batches.append(len(frames))
        return [
            [Detection(label=str(int(f[0, 0, 0])), confidence=1.0, box=Box(x1=0, y1=0, x2=1, y2=1))]
            for f in frames
        ]


class FailingDetector:
    name = "failing"
    device = "cpu"

    def predict(self, frames: list[Frame]) -> list[list[Detection]]:
        raise RuntimeError("boom")


def frame(value: int) -> Frame:
    return np.full((4, 4, 3), value, dtype=np.uint8)


@pytest.fixture
async def batcher() -> AsyncIterator[MicroBatcher]:
    b = MicroBatcher(RecordingDetector(), max_batch_size=4, max_wait_ms=20)
    await b.start()
    yield b
    await b.stop()


async def test_concurrent_frames_share_one_forward_pass(batcher: MicroBatcher) -> None:
    results = await asyncio.gather(*(batcher.submit(frame(i)) for i in range(4)))

    assert [r[0].label for r in results] == ["0", "1", "2", "3"]
    assert batcher.detector.batches == [4]  # type: ignore[attr-defined]
    assert batcher.stats.batches == 1
    assert batcher.stats.frames == 4


async def test_batches_never_exceed_max_size(batcher: MicroBatcher) -> None:
    results = await asyncio.gather(*(batcher.submit(frame(i)) for i in range(10)))

    assert [r[0].label for r in results] == [str(i) for i in range(10)]
    batches: list[int] = batcher.detector.batches  # type: ignore[attr-defined]
    assert sum(batches) == 10
    assert max(batches) <= 4


async def test_lone_frame_is_not_held_past_max_wait() -> None:
    b = MicroBatcher(RecordingDetector(), max_batch_size=8, max_wait_ms=10)
    await b.start()
    try:
        result = await asyncio.wait_for(b.submit(frame(7)), timeout=1)
    finally:
        await b.stop()
    assert result[0].label == "7"
    assert b.stats.last_batch_size == 1


async def test_detector_error_reaches_every_caller_and_batcher_keeps_running() -> None:
    b = MicroBatcher(FailingDetector(), max_batch_size=4, max_wait_ms=5)
    await b.start()
    try:
        outcomes = await asyncio.gather(
            *(b.submit(frame(i)) for i in range(3)), return_exceptions=True
        )
        assert all(isinstance(o, RuntimeError) for o in outcomes)
        assert b.running
        b.detector = RecordingDetector()
        assert (await b.submit(frame(1)))[0].label == "1"
    finally:
        await b.stop()


async def test_cancelled_caller_is_skipped() -> None:
    gate = threading.Event()
    detector = RecordingDetector(gate)
    b = MicroBatcher(detector, max_batch_size=1, max_wait_ms=0)
    await b.start()
    try:
        first = asyncio.create_task(b.submit(frame(1)))  # occupies the worker
        await asyncio.sleep(0.01)
        abandoned = asyncio.create_task(b.submit(frame(2)))
        await asyncio.sleep(0.01)
        abandoned.cancel()
        gate.set()
        await first
        assert (await b.submit(frame(3)))[0].label == "3"
    finally:
        await b.stop()
    assert detector.batches == [1, 1]


async def test_submit_requires_running_batcher() -> None:
    b = MicroBatcher(RecordingDetector())
    with pytest.raises(BatcherClosedError):
        await b.submit(frame(0))


async def test_stop_fails_pending_callers() -> None:
    gate = threading.Event()
    b = MicroBatcher(RecordingDetector(gate), max_batch_size=1, max_wait_ms=0)
    await b.start()
    first = asyncio.create_task(b.submit(frame(1)))
    await asyncio.sleep(0.01)
    queued = asyncio.create_task(b.submit(frame(2)))
    await asyncio.sleep(0.01)

    stopping = asyncio.create_task(b.stop())
    await asyncio.sleep(0.01)
    gate.set()
    await stopping

    with pytest.raises(BatcherClosedError):
        await queued
    with pytest.raises(BatcherClosedError):
        await first
    assert not b.running


@pytest.mark.parametrize(("size", "wait"), [(0, 1.0), (4, -1.0)])
def test_rejects_bad_limits(size: int, wait: float) -> None:
    with pytest.raises(ValueError):
        MicroBatcher(RecordingDetector(), max_batch_size=size, max_wait_ms=wait)
