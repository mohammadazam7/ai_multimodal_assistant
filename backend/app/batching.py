"""Async micro-batching in front of a :class:`~app.detector.Detector`.

Callers ``await batcher.submit(frame)`` one frame at a time. A single worker task
collects frames until either ``max_batch_size`` frames are waiting or ``max_wait_ms``
has passed since the first one arrived, then runs one ``predict`` call for the whole
batch in a worker thread and hands each caller its own result.

On a GPU this turns many small forward passes into a few larger ones, which is where
most of the throughput gain comes from. ``max_wait_ms`` bounds the latency cost: no
frame waits longer than that before its batch starts.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass, field

from app.detector import Detector, Frame
from app.schemas import Detection

log = logging.getLogger(__name__)


class BatcherClosedError(RuntimeError):
    """Raised when a frame is submitted to a batcher that is not running."""


@dataclass
class _Pending:
    frame: Frame
    future: asyncio.Future[list[Detection]]


@dataclass
class BatchStats:
    batches: int = 0
    frames: int = 0
    last_batch_size: int = 0
    sizes: dict[int, int] = field(default_factory=dict)

    def record(self, size: int) -> None:
        self.batches += 1
        self.frames += size
        self.last_batch_size = size
        self.sizes[size] = self.sizes.get(size, 0) + 1


class MicroBatcher:
    def __init__(
        self,
        detector: Detector,
        *,
        max_batch_size: int = 8,
        max_wait_ms: float = 5.0,
    ) -> None:
        if max_batch_size < 1:
            raise ValueError("max_batch_size must be >= 1")
        if max_wait_ms < 0:
            raise ValueError("max_wait_ms must be >= 0")
        self.detector = detector
        self.max_batch_size = max_batch_size
        self.max_wait = max_wait_ms / 1000
        self.stats = BatchStats()
        self._queue: asyncio.Queue[_Pending] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._current: list[_Pending] = []

    @property
    def running(self) -> bool:
        return self._worker is not None and not self._worker.done()

    @property
    def queue_depth(self) -> int:
        return self._queue.qsize()

    async def start(self) -> None:
        if not self.running:
            self._worker = asyncio.create_task(self._run(), name="micro-batcher")

    async def stop(self) -> None:
        if self._worker is None:
            return
        self._worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._worker
        self._worker = None
        # Fail the batch being built and anything still queued so no caller waits forever.
        leftovers = self._current
        self._current = []
        while not self._queue.empty():
            leftovers.append(self._queue.get_nowait())
        for pending in leftovers:
            if not pending.future.done():
                pending.future.set_exception(BatcherClosedError("batcher stopped"))

    async def submit(self, frame: Frame) -> list[Detection]:
        if not self.running:
            raise BatcherClosedError("batcher is not running")
        future: asyncio.Future[list[Detection]] = asyncio.get_running_loop().create_future()
        await self._queue.put(_Pending(frame, future))
        return await future

    async def _collect(self) -> list[_Pending]:
        batch = self._current = [await self._queue.get()]
        deadline = time.monotonic() + self.max_wait
        while len(batch) < self.max_batch_size:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                # Still take whatever is already queued; it costs nothing to include.
                while len(batch) < self.max_batch_size and not self._queue.empty():
                    batch.append(self._queue.get_nowait())
                break
            try:
                batch.append(await asyncio.wait_for(self._queue.get(), remaining))
            except TimeoutError:
                break
        # Callers that gave up (e.g. a closed WebSocket) don't need inference.
        return [p for p in batch if not p.future.cancelled()]

    async def _run(self) -> None:
        while True:
            batch = await self._collect()
            if not batch:
                self._current = []
                continue
            try:
                results = await asyncio.to_thread(self.detector.predict, [p.frame for p in batch])
                if len(results) != len(batch):
                    raise RuntimeError(
                        f"detector returned {len(results)} results for {len(batch)} frames"
                    )
            except Exception as exc:
                log.exception("batch of %d frames failed", len(batch))
                for p in batch:
                    if not p.future.done():
                        p.future.set_exception(exc)
            else:
                self.stats.record(len(batch))
                for p, result in zip(batch, results, strict=True):
                    if not p.future.done():
                        p.future.set_result(result)
            self._current = []
