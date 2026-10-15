from __future__ import annotations

import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from test_api import FakeDetector, _png

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(Settings(detector="null"), detector=FakeDetector())
    with TestClient(app) as c:
        yield c


def _access_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "app.access"]


def test_request_is_logged_with_id_status_and_duration(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="app.access")
    resp = client.post("/v1/detect", files={"file": ("f.png", _png(), "image/png")})

    (record,) = _access_records(caplog)
    assert record.levelno == logging.INFO
    assert record.getMessage() == "POST /v1/detect 200"
    assert record.status == 200  # type: ignore[attr-defined]
    assert record.duration_ms >= 0  # type: ignore[attr-defined]
    assert resp.headers["x-request-id"] == record.request_id  # type: ignore[attr-defined]
    assert len(record.request_id) == 32  # type: ignore[attr-defined]


def test_upstream_request_id_is_kept(client: TestClient) -> None:
    resp = client.get("/healthz", headers={"X-Request-ID": "lb-7f3a.2"})
    assert resp.headers["x-request-id"] == "lb-7f3a.2"


def test_malformed_upstream_id_is_replaced(client: TestClient) -> None:
    resp = client.get("/healthz", headers={"X-Request-ID": "bad id\twith spaces"})
    assert resp.headers["x-request-id"] != "bad id\twith spaces"
    assert len(resp.headers["x-request-id"]) == 32


def test_probes_and_scrapes_log_at_debug(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG, logger="app.access")
    client.get("/healthz")
    client.get("/metrics")
    assert [r.levelno for r in _access_records(caplog)] == [logging.DEBUG, logging.DEBUG]


def test_client_errors_are_logged_at_info(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="app.access")
    client.post("/v1/detect", files={"file": ("f.png", b"not an image", "image/png")})
    (record,) = _access_records(caplog)
    assert record.status == 415  # type: ignore[attr-defined]


def test_streams_log_open_and_close(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="app.main")
    with client.websocket_connect("/v1/stream") as ws:
        ws.send_bytes(_png())
        assert ws.receive_json()["seq"] == 1

    messages = [r.getMessage() for r in caplog.records if r.name == "app.main"]
    assert messages[0] == "stream opened"
    # Leaving the context waits for the server side of the stream to finish.
    closed = [r for r in caplog.records if r.getMessage() == "stream closed"]
    assert closed and closed[0].dropped == 0  # type: ignore[attr-defined]
