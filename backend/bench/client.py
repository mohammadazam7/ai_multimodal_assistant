"""Replay frames over the service's ``/v1/stream`` WebSocket and time each answer.

Each simulated camera sends frames at a fixed rate whether or not earlier ones have
been answered (an open loop, like a real camera). The service numbers frames per
connection in the order they arrive, so a result's ``seq`` identifies the frame it
answers; latency is the time from sending that frame to receiving its result.
Frames the service skipped as stale never get an answer and count as dropped.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from collections.abc import Sequence
from dataclasses import dataclass, field

from websockets.asyncio.client import connect

from bench.stats import LatencySummary, RunSummary


@dataclass
class StreamOutcome:
    sent: int = 0
    answered: int = 0
    dropped: int = 0
    errors: int = 0
    latencies_ms: list[float] = field(default_factory=list)


async def replay_stream(
    url: str,
    frames: Sequence[bytes],
    *,
    fps: float,
    seconds: float,
    offset: int = 0,
    drain_timeout: float = 5.0,
) -> StreamOutcome:
    """Send ``frames`` (looping, starting at ``offset``) at ``fps`` for ``seconds``."""
    if fps <= 0 or seconds <= 0:
        raise ValueError("fps and seconds must be positive")
    if not frames:
        raise ValueError("no frames to send")
    outcome = StreamOutcome()
    sent_at: dict[int, float] = {}
    last_answered = 0
    answered_all = asyncio.Event()
    done_sending = False

    async with connect(url, max_size=None, compression=None) as ws:

        async def receive() -> None:
            nonlocal last_answered
            async for message in ws:
                now = time.perf_counter()
                result = json.loads(message)
                seq = int(result["seq"])
                if "error" in result:
                    outcome.errors += 1
                else:
                    outcome.answered += 1
                    outcome.dropped = int(result["dropped"])
                    outcome.latencies_ms.append((now - sent_at[seq]) * 1000)
                # Anything older than this frame was skipped or already answered.
                for old in [s for s in sent_at if s <= seq]:
                    del sent_at[old]
                last_answered = seq
                if done_sending and last_answered == outcome.sent:
                    answered_all.set()

        receiver = asyncio.create_task(receive())
        start = time.perf_counter()
        interval = 1 / fps
        try:
            while time.perf_counter() - start < seconds:
                frame = frames[(offset + outcome.sent) % len(frames)]
                outcome.sent += 1
                sent_at[outcome.sent] = time.perf_counter()
                await ws.send(frame)
                # Pace against the start time so slow sends don't lower the rate.
                delay = start + outcome.sent * interval - time.perf_counter()
                if delay > 0:
                    await asyncio.sleep(delay)
            done_sending = True
            # The newest frame is never skipped, so its answer means the stream is done.
            # If it never comes, the frames still in flight count as unanswered.
            if last_answered < outcome.sent:
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(answered_all.wait(), drain_timeout)
        finally:
            receiver.cancel()
            await asyncio.gather(receiver, return_exceptions=True)
    return outcome


async def run(
    url: str,
    frames: Sequence[bytes],
    *,
    streams: int,
    fps: float,
    seconds: float,
) -> RunSummary:
    """Run ``streams`` cameras at once and summarise them together."""
    if streams < 1:
        raise ValueError("streams must be >= 1")
    start = time.perf_counter()
    # Start each camera at a different point in the clip so frames differ across streams.
    outcomes = await asyncio.gather(
        *(
            replay_stream(url, frames, fps=fps, seconds=seconds, offset=i * len(frames) // streams)
            for i in range(streams)
        )
    )
    elapsed = time.perf_counter() - start
    latencies = [ms for o in outcomes for ms in o.latencies_ms]
    return RunSummary(
        streams=streams,
        seconds=elapsed,
        frames_sent=sum(o.sent for o in outcomes),
        frames_answered=sum(o.answered for o in outcomes),
        frames_dropped=sum(o.dropped for o in outcomes),
        latency=LatencySummary.of(latencies),
    )
