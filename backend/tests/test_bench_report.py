from __future__ import annotations

import json

from bench.report import LabelledRun, machine, to_json, to_markdown
from bench.stats import LatencySummary, RunSummary


def _run(config: str, streams: int) -> LabelledRun:
    summary = RunSummary(
        streams=streams,
        seconds=10.0,
        frames_sent=300,
        frames_answered=250,
        frames_dropped=50,
        latency=LatencySummary.of([10.0, 20.0, 30.0, 40.0]),
    )
    return LabelledRun(config, summary)


def test_markdown_has_one_row_per_run() -> None:
    table = to_markdown([_run("batched", 1), _run("unbatched", 4)])
    lines = table.strip().splitlines()
    assert len(lines) == 4
    assert lines[2].startswith("| batched | 1 | 300 | 250 | 50 | 25.0 | 25.0 |")
    assert lines[3].startswith("| unbatched | 4 |")


def test_json_records_machine_params_and_runs() -> None:
    record = json.loads(to_json([_run("batched", 2)], {"fps": 15}))
    assert record["params"] == {"fps": 15}
    assert record["machine"]["cpus"] >= 1
    (run,) = record["runs"]
    assert run["config"] == "batched"
    assert run["throughput_fps"] == 25.0
    assert run["latency"]["p50_ms"] == 25.0


def test_machine_names_the_processor() -> None:
    assert machine()["processor"]
