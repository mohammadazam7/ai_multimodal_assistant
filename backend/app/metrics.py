"""Prometheus metrics for the service.

Each app gets its own :class:`~prometheus_client.CollectorRegistry` rather than the
process-wide default. Tests build many apps in one process, and the default registry
refuses to register the same metric name twice.

Latency buckets are in seconds and skewed towards the 5-200 ms range a live overlay
cares about; the top buckets are there so a stalled model still shows up as a tail
rather than vanishing into ``+Inf``.
"""

from __future__ import annotations

from collections.abc import Callable

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

LATENCY_BUCKETS = (0.005, 0.01, 0.02, 0.035, 0.05, 0.075, 0.1, 0.15, 0.2, 0.35, 0.5, 1, 2.5)
BATCH_SIZE_BUCKETS = (1, 2, 3, 4, 6, 8, 12, 16, 24, 32)


class Metrics:
    content_type = CONTENT_TYPE_LATEST

    def __init__(self) -> None:
        self.registry = CollectorRegistry()
        r = self.registry
        self.batch_size = Histogram(
            "vision_batch_size",
            "Frames per forward pass.",
            buckets=BATCH_SIZE_BUCKETS,
            registry=r,
        )
        self.inference_seconds = Histogram(
            "vision_inference_seconds",
            "Wall time of one forward pass over a batch.",
            buckets=LATENCY_BUCKETS,
            registry=r,
        )
        self.batch_failures = Counter(
            "vision_batch_failures",
            "Forward passes that raised.",
            registry=r,
        )
        self.queue_depth = Gauge(
            "vision_batch_queue_depth",
            "Frames waiting for the batcher to pick them up.",
            registry=r,
        )

        self.detect_seconds = Histogram(
            "vision_detect_seconds",
            "Time from receiving a frame to having its detections, decode included.",
            ["source"],
            buckets=LATENCY_BUCKETS,
            registry=r,
        )
        self.frames = Counter(
            "vision_frames",
            "Frames handled, by source (http, stream) and outcome (ok, invalid).",
            ["source", "outcome"],
            registry=r,
        )
        self.frames_dropped = Counter(
            "vision_stream_frames_dropped",
            "Stream frames replaced by a newer one before the model got to them.",
            registry=r,
        )
        self.streams_in_flight = Gauge(
            "vision_streams_in_flight",
            "Open WebSocket streams.",
            registry=r,
        )

    def observe_frame(self, source: str, seconds: float) -> None:
        self.frames.labels(source, "ok").inc()
        self.detect_seconds.labels(source).observe(seconds)

    def invalid_frame(self, source: str) -> None:
        self.frames.labels(source, "invalid").inc()

    def observe_batch(self, size: int, seconds: float) -> None:
        self.batch_size.observe(size)
        self.inference_seconds.observe(seconds)

    def batch_failed(self) -> None:
        self.batch_failures.inc()

    def track_queue_depth(self, depth: Callable[[], float]) -> None:
        """Read the queue depth at scrape time instead of updating it on every frame."""
        self.queue_depth.set_function(depth)

    def render(self) -> bytes:
        return generate_latest(self.registry)
