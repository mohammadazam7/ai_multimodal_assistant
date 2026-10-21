from __future__ import annotations

import asyncio

import pytest

from bench.client import replay_stream
from bench.frames import synthetic_frames
from bench.server import ServiceConfig, serve


def test_parse_prefixes_settings() -> None:
    config = ServiceConfig.parse("unbatched:batch_max_size=1, VISION_DEVICE=cpu")
    assert config.name == "unbatched"
    assert config.env == {"VISION_BATCH_MAX_SIZE": "1", "VISION_DEVICE": "cpu"}


def test_parse_accepts_a_bare_name() -> None:
    assert ServiceConfig.parse("default") == ServiceConfig("default", {})


@pytest.mark.parametrize("spec", [":BATCH_MAX_SIZE=1", "x:BATCH_MAX_SIZE", "x:=1"])
def test_parse_rejects_malformed_specs(spec: str) -> None:
    with pytest.raises(ValueError):
        ServiceConfig.parse(spec)


def test_serve_runs_the_service_in_a_subprocess() -> None:
    config = ServiceConfig.parse("null:DETECTOR=null,LOG_FORMAT=text")
    frames = synthetic_frames(4, width=64, height=48)
    with serve(config, startup_timeout=60) as url:
        outcome = asyncio.run(replay_stream(url, frames, fps=20, seconds=0.3))
    assert outcome.answered == outcome.sent > 0


def test_serve_reports_a_service_that_fails_to_start() -> None:
    config = ServiceConfig.parse("broken:DETECTOR=nonsense")
    with pytest.raises(RuntimeError, match="exited"), serve(config, startup_timeout=60):
        pass
