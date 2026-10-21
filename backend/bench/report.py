"""Turn benchmark runs into a JSON record and a Markdown table."""

from __future__ import annotations

import json
import os
import platform
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from bench.stats import RunSummary


@dataclass(frozen=True)
class LabelledRun:
    """One run, tagged with the service configuration it was measured against."""

    config: str
    summary: RunSummary


def machine() -> dict[str, Any]:
    """What the client ran on. Results mean little without it."""
    return {
        "platform": platform.platform(),
        "processor": _cpu_model() or platform.processor() or platform.machine(),
        "cpus": os.cpu_count(),
        "python": platform.python_version(),
    }


def _cpu_model() -> str | None:
    try:
        with open("/proc/cpuinfo", encoding="utf-8") as cpuinfo:
            for line in cpuinfo:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        return None
    return None


def to_json(runs: Sequence[LabelledRun], params: dict[str, Any]) -> str:
    record = {
        "machine": machine(),
        "params": params,
        "runs": [{"config": r.config, **r.summary.to_dict()} for r in runs],
    }
    return json.dumps(record, indent=2)


def to_markdown(runs: Sequence[LabelledRun]) -> str:
    header = (
        "| config | streams | sent | answered | dropped | throughput (fps) "
        "| p50 (ms) | p95 (ms) | p99 (ms) |\n"
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|\n"
    )
    rows = []
    for r in runs:
        s, lat = r.summary, r.summary.latency
        rows.append(
            f"| {r.config} | {s.streams} | {s.frames_sent} | {s.frames_answered} "
            f"| {s.frames_dropped} | {s.throughput_fps:.1f} "
            f"| {lat.p50_ms:.1f} | {lat.p95_ms:.1f} | {lat.p99_ms:.1f} |"
        )
    return header + "\n".join(rows) + "\n"
