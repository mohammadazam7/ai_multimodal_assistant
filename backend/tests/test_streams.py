from __future__ import annotations

import asyncio

import pytest

from app.streams import LatestFrameSlot, SlotClosedError

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_get_returns_newest_and_counts_dropped() -> None:
    slot: LatestFrameSlot[int] = LatestFrameSlot()
    for i in range(5):
        slot.put(i)
    assert await slot.get() == 4
    assert slot.dropped == 4


async def test_get_waits_for_a_frame() -> None:
    slot: LatestFrameSlot[str] = LatestFrameSlot()
    waiter = asyncio.create_task(slot.get())
    await asyncio.sleep(0.01)
    assert not waiter.done()
    slot.put("frame")
    assert await asyncio.wait_for(waiter, 1) == "frame"
    assert slot.dropped == 0


async def test_taken_frame_is_not_returned_twice() -> None:
    slot: LatestFrameSlot[int] = LatestFrameSlot()
    slot.put(1)
    assert await slot.get() == 1
    with pytest.raises(TimeoutError):
        await asyncio.wait_for(slot.get(), 0.02)


async def test_close_wakes_waiter() -> None:
    slot: LatestFrameSlot[int] = LatestFrameSlot()
    waiter = asyncio.create_task(slot.get())
    await asyncio.sleep(0.01)
    slot.close()
    with pytest.raises(SlotClosedError):
        await asyncio.wait_for(waiter, 1)


async def test_frame_stored_before_close_can_still_be_taken() -> None:
    slot: LatestFrameSlot[int] = LatestFrameSlot()
    slot.put(9)
    slot.close()
    assert await slot.get() == 9
    with pytest.raises(SlotClosedError):
        await slot.get()
    with pytest.raises(SlotClosedError):
        slot.put(10)
