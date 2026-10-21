from __future__ import annotations

import json
from pathlib import Path

import pytest

from bench.__main__ import main, parse_args


def test_defaults() -> None:
    args = parse_args(["--url", "ws://x/v1/stream"])
    assert args.streams == [1, 4, 8]
    assert args.synthetic == 120
    assert args.serve is None


def test_serve_is_repeatable() -> None:
    args = parse_args(["--serve", "a:BATCH_MAX_SIZE=8", "--serve", "b:BATCH_MAX_SIZE=1"])
    assert [c.name for c in args.serve] == ["a", "b"]
    assert args.serve[1].env == {"VISION_BATCH_MAX_SIZE": "1"}


@pytest.mark.parametrize(
    "argv",
    [
        [],
        ["--url", "ws://x", "--serve", "a"],
        ["--url", "ws://x", "--streams", "0"],
        ["--url", "ws://x", "--fps", "0"],
        ["--url", "ws://x", "--video", "a.mp4", "--synthetic", "5"],
    ],
)
def test_rejects_bad_arguments(argv: list[str]) -> None:
    with pytest.raises(SystemExit):
        parse_args(argv)


def test_end_to_end_against_the_null_detector(tmp_path: Path) -> None:
    out_json, out_md = tmp_path / "r.json", tmp_path / "r.md"
    code = main(
        [
            "--serve", "null:DETECTOR=null,LOG_FORMAT=text",
            "--streams", "1", "2",
            "--fps", "10", "--seconds", "0.5", "--warmup", "0.2",
            "--synthetic", "4", "--width", "64",
            "--json", str(out_json), "--markdown", str(out_md),
        ]
    )  # fmt: skip
    assert code == 0
    record = json.loads(out_json.read_text())
    assert [r["streams"] for r in record["runs"]] == [1, 2]
    assert record["params"]["configs"] == {
        "null": {"VISION_DETECTOR": "null", "VISION_LOG_FORMAT": "text"}
    }
    assert out_md.read_text().count("| null |") == 2
