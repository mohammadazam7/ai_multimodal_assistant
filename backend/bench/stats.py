"""Latency percentiles and per-run summaries."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from typing import Any


def percentile(values: Sequence[float], q: float) -> float:
    """The ``q``-th percentile (0-100) with linear interpolation between ranks.

    Matches ``numpy.percentile``'s default method, so numbers compare with other tools.
    """
    if not values:
        raise ValueError("percentile of an empty sequence")
    if not 0 <= q <= 100:
        raise ValueError("q must be between 0 and 100")
    ordered = sorted(values)
    rank = (len(ordered) - 1) * q / 100
    lo, hi = math.floor(rank), math.ceil(rank)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (rank - lo)


@dataclass(frozen=True)
class LatencySummary:
    count: int
    mean_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    max_ms: float

    @classmethod
    def of(cls, latencies_ms: Sequence[float]) -> LatencySummary:
        if not latencies_ms:
            raise ValueError("no latencies to summarise")
        return cls(
            count=len(latencies_ms),
            mean_ms=sum(latencies_ms) / len(latencies_ms),
            p50_ms=percentile(latencies_ms, 50),
            p95_ms=percentile(latencies_ms, 95),
            p99_ms=percentile(latencies_ms, 99),
            max_ms=max(latencies_ms),
        )


@dataclass(frozen=True)
class RunSummary:
    """What one benchmark run measured, across all of its streams."""

    streams: int
    seconds: float
    frames_sent: int
    frames_answered: int
    frames_dropped: int
    latency: LatencySummary

    @property
    def throughput_fps(self) -> float:
        """Frames the service answered per second, over all streams."""
        return self.frames_answered / self.seconds if self.seconds > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "throughput_fps": self.throughput_fps}
