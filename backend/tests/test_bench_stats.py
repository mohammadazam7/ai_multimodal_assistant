import io

import numpy as np
import pytest
from PIL import Image

from bench.frames import synthetic_frames
from bench.stats import LatencySummary, RunSummary, percentile


def test_percentile_matches_numpy() -> None:
    values = [12.0, 3.0, 7.5, 40.0, 9.0, 15.0, 2.0]
    for q in (0, 25, 50, 90, 95, 99, 100):
        assert percentile(values, q) == pytest.approx(np.percentile(values, q))


def test_percentile_of_one_value() -> None:
    assert percentile([4.0], 95) == 4.0


@pytest.mark.parametrize(("values", "q"), [([], 50), ([1.0], -1), ([1.0], 101)])
def test_percentile_rejects_bad_input(values: list[float], q: float) -> None:
    with pytest.raises(ValueError):
        percentile(values, q)


def test_latency_summary() -> None:
    summary = LatencySummary.of([float(v) for v in range(1, 101)])
    assert summary.count == 100
    assert summary.mean_ms == pytest.approx(50.5)
    assert summary.p50_ms == pytest.approx(50.5)
    assert summary.p95_ms == pytest.approx(95.05)
    assert summary.max_ms == 100.0


def test_run_summary_throughput() -> None:
    run = RunSummary(
        streams=4,
        seconds=10.0,
        frames_sent=600,
        frames_answered=500,
        frames_dropped=100,
        latency=LatencySummary.of([10.0, 20.0]),
    )
    assert run.throughput_fps == 50.0
    assert run.to_dict()["throughput_fps"] == 50.0
    assert run.to_dict()["latency"]["p50_ms"] == 15.0


def test_synthetic_frames_are_distinct_jpegs() -> None:
    frames = synthetic_frames(3, width=160, height=120)
    assert len(set(frames)) == 3
    image = Image.open(io.BytesIO(frames[0]))
    assert image.format == "JPEG"
    assert image.size == (160, 120)


def test_synthetic_frames_are_reproducible() -> None:
    assert synthetic_frames(2, 160, 120, seed=1) == synthetic_frames(2, 160, 120, seed=1)
