"""Start the service in its own process with a given configuration.

The benchmark client and the service run in separate processes so the client's event
loop never competes with inference for the same interpreter lock.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class ServiceConfig:
    """A named set of ``VISION_*`` settings, e.g. ``unbatched:BATCH_MAX_SIZE=1``."""

    name: str
    env: Mapping[str, str] = field(default_factory=dict)

    @classmethod
    def parse(cls, spec: str) -> ServiceConfig:
        name, _, rest = spec.partition(":")
        if not name:
            raise ValueError(f"config {spec!r} needs a name before ':'")
        env: dict[str, str] = {}
        for pair in filter(None, rest.split(",")):
            key, sep, value = pair.partition("=")
            if not sep or not key:
                raise ValueError(f"expected KEY=VALUE in {spec!r}, got {pair!r}")
            key = key.strip().upper()
            env[key if key.startswith("VISION_") else f"VISION_{key}"] = value.strip()
        return cls(name, env)


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(base_url: str, timeout: float, process: subprocess.Popen[bytes]) -> None:
    """Poll ``/readyz`` until it answers 200; model loading can take a while."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"service exited with code {process.returncode} during startup")
        try:
            with urllib.request.urlopen(f"{base_url}/readyz", timeout=2) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            pass
        time.sleep(0.2)
    raise TimeoutError(f"service at {base_url} not ready after {timeout:.0f}s")


@contextmanager
def serve(config: ServiceConfig, startup_timeout: float = 180.0) -> Iterator[str]:
    """Run the service with ``config`` and yield its ``/v1/stream`` WebSocket URL."""
    port = free_port()
    env = {**os.environ, "VISION_LOG_LEVEL": "WARNING", **config.env}
    command = [
        *(sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)),
        *("--log-level", "warning", "--no-access-log"),
    ]
    # The service's logs go to stderr so stdout carries only the results.
    process = subprocess.Popen(command, cwd=BACKEND, env=env, stdout=sys.stderr)
    try:
        wait_ready(f"http://127.0.0.1:{port}", startup_timeout, process)
        yield f"ws://127.0.0.1:{port}/v1/stream"
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
