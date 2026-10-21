"""Command line for the benchmark.

Against a service that is already running::

    python -m bench --url ws://localhost:8000/v1/stream --streams 1 4 8

Or let the harness start the service once per configuration and compare them::

    python -m bench --serve batched:BATCH_MAX_SIZE=8 --serve unbatched:BATCH_MAX_SIZE=1 \\
        --streams 1 4 8 --video street.mp4 --markdown results.md --json results.json
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Iterator, Sequence
from contextlib import AbstractContextManager, nullcontext
from pathlib import Path

from bench.client import run
from bench.frames import synthetic_frames, video_frames
from bench.report import LabelledRun, to_json, to_markdown
from bench.server import ServiceConfig, serve


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m bench", description=__doc__.splitlines()[0])
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--url", help="WebSocket URL of a running service")
    target.add_argument(
        "--serve",
        action="append",
        type=ServiceConfig.parse,
        metavar="NAME:KEY=VALUE,...",
        help="start the service with these VISION_* settings (repeatable)",
    )
    parser.add_argument("--streams", type=int, nargs="+", default=[1, 4, 8])
    parser.add_argument("--fps", type=float, default=15.0, help="frames per second per stream")
    parser.add_argument("--seconds", type=float, default=20.0, help="length of each run")
    parser.add_argument(
        "--warmup", type=float, default=3.0, help="unmeasured seconds before each configuration"
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--video", type=Path, help="replay frames from this video file")
    source.add_argument(
        "--synthetic", type=int, default=120, metavar="N", help="use N generated frames"
    )
    parser.add_argument("--width", type=int, default=640, help="frame width in pixels")
    parser.add_argument("--json", type=Path, help="write the full results here")
    parser.add_argument("--markdown", type=Path, help="write a results table here")
    args = parser.parse_args(argv)
    if any(n < 1 for n in args.streams):
        parser.error("--streams values must be >= 1")
    if args.fps <= 0 or args.seconds <= 0 or args.warmup < 0:
        parser.error("--fps and --seconds must be positive, --warmup non-negative")
    return args


def targets(args: argparse.Namespace) -> Iterator[tuple[str, AbstractContextManager[str]]]:
    if args.url:
        yield "external", nullcontext(args.url)
    else:
        for config in args.serve:
            yield config.name, serve(config)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if args.video:
        frames = video_frames(args.video, width=args.width)
    else:
        frames = synthetic_frames(args.synthetic, width=args.width, height=args.width * 3 // 4)

    runs: list[LabelledRun] = []
    for name, service in targets(args):
        with service as url:
            if args.warmup:
                asyncio.run(run(url, frames, streams=1, fps=args.fps, seconds=args.warmup))
            for streams in args.streams:
                summary = asyncio.run(
                    run(url, frames, streams=streams, fps=args.fps, seconds=args.seconds)
                )
                runs.append(LabelledRun(name, summary))
                print(to_markdown(runs[-1:]).splitlines()[-1], file=sys.stderr, flush=True)

    table = to_markdown(runs)
    print(table)
    if args.markdown:
        args.markdown.write_text(table, encoding="utf-8")
    if args.json:
        params = {
            "fps": args.fps,
            "seconds": args.seconds,
            "warmup": args.warmup,
            "source": str(args.video) if args.video else f"synthetic:{args.synthetic}",
            "width": args.width,
            "configs": {c.name: dict(c.env) for c in args.serve or []},
        }
        args.json.write_text(to_json(runs, params) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
