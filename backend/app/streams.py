"""Per-stream back-pressure.

A live camera produces frames faster than a busy model can consume them. Queueing them
would make latency grow without bound, so each stream keeps only its newest frame:
:class:`LatestFrameSlot` overwrites the waiting frame on ``put`` and counts the ones it
dropped. The consumer always works on the most recent picture of the scene.
"""

from __future__ import annotations

import asyncio
from typing import Generic, TypeVar

T = TypeVar("T")


class SlotClosedError(Exception):
    """Raised by :meth:`LatestFrameSlot.get` once the slot is closed and empty."""


class LatestFrameSlot(Generic[T]):
    def __init__(self) -> None:
        self._item: T | None = None
        self._ready = asyncio.Event()
        self._closed = False
        self.dropped = 0

    @property
    def closed(self) -> bool:
        return self._closed

    def put(self, item: T) -> None:
        """Store ``item``, replacing (and counting) any frame not yet taken."""
        if self._closed:
            raise SlotClosedError("slot is closed")
        if self._item is not None:
            self.dropped += 1
        self._item = item
        self._ready.set()

    async def get(self) -> T:
        """Wait for and take the newest frame."""
        while True:
            if self._item is not None:
                item, self._item = self._item, None
                self._ready.clear()
                return item
            if self._closed:
                raise SlotClosedError("slot is closed")
            await self._ready.wait()

    def close(self) -> None:
        """Wake any waiting consumer. A frame already stored can still be taken."""
        self._closed = True
        self._ready.set()
