from __future__ import annotations

import json
import logging
import sys
from collections.abc import Iterator

import pytest

from app.logs import JsonFormatter, configure_logging


def _record(msg: str, **extra: object) -> logging.LogRecord:
    record = logging.LogRecord("app.test", logging.WARNING, __file__, 1, msg, None, None)
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_json_line_has_core_fields() -> None:
    line = JsonFormatter().format(_record("hello %s"))
    entry = json.loads(line)
    assert entry["level"] == "warning"
    assert entry["logger"] == "app.test"
    assert entry["msg"] == "hello %s"
    assert entry["ts"].endswith("+00:00")


def test_extra_fields_become_top_level_keys() -> None:
    entry = json.loads(JsonFormatter().format(_record("frame", stream=3, seq=41)))
    assert entry["stream"] == 3
    assert entry["seq"] == 41
    # Internal LogRecord attributes are not leaked.
    assert "lineno" not in entry
    assert "args" not in entry


def test_uvicorn_colour_copy_is_dropped() -> None:
    entry = json.loads(JsonFormatter().format(_record("up", color_message="\x1b[1mup\x1b[0m")))
    assert "color_message" not in entry


def test_unserialisable_extras_fall_back_to_str() -> None:
    entry = json.loads(JsonFormatter().format(_record("x", path=object())))
    assert entry["path"].startswith("<object object")


def test_exception_is_included() -> None:
    try:
        raise ValueError("boom")
    except ValueError:
        record = _record("failed")
        record.exc_info = sys.exc_info()
    entry = json.loads(JsonFormatter().format(record))
    assert "ValueError: boom" in entry["exc"]


@pytest.fixture
def restore_root() -> Iterator[None]:
    root = logging.getLogger()
    handlers, level = root.handlers[:], root.level
    yield
    root.handlers[:] = handlers
    root.setLevel(level)


@pytest.mark.usefixtures("restore_root")
def test_configure_logging_writes_json_to_stdout(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("debug", "json")
    logging.getLogger("app.x").debug("ready", extra={"model": "fake"})
    entry = json.loads(capsys.readouterr().out.strip())
    assert entry == entry | {"level": "debug", "msg": "ready", "model": "fake"}


@pytest.mark.usefixtures("restore_root")
def test_configure_logging_text_mode(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("INFO", "text")
    logging.getLogger("app.x").info("plain")
    logging.getLogger("app.x").debug("hidden")
    out = capsys.readouterr().out
    assert "INFO    app.x: plain" in out
    assert "hidden" not in out
