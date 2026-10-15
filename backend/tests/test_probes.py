from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from test_api import FakeDetector

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(Settings(detector="null"), detector=FakeDetector())
    with TestClient(app) as c:
        yield c


def test_readyz_ok_once_started(client: TestClient) -> None:
    resp = client.get("/readyz")
    assert resp.status_code == 200
    assert resp.json() == {
        "ready": True,
        "checks": {"model_loaded": True, "batcher_running": True, "not_draining": True},
    }


def test_stopped_batcher_fails_readiness_but_not_liveness(client: TestClient) -> None:
    batcher = client.app.state.batcher  # type: ignore[attr-defined]
    client.portal.call(batcher.stop)  # type: ignore[union-attr]

    ready = client.get("/readyz")
    assert ready.status_code == 503
    assert ready.json()["checks"]["batcher_running"] is False

    live = client.get("/healthz")
    assert live.status_code == 200
    assert live.json()["ready"] is False


def test_draining_fails_readiness(client: TestClient) -> None:
    client.app.state.draining = True  # type: ignore[attr-defined]
    resp = client.get("/readyz")
    assert resp.status_code == 503
    assert resp.json()["checks"] == {
        "model_loaded": True,
        "batcher_running": True,
        "not_draining": False,
    }


def test_shutdown_marks_the_app_draining() -> None:
    app = create_app(Settings(detector="null"), detector=FakeDetector())
    with TestClient(app):
        assert app.state.draining is False
    assert app.state.draining is True
    assert not app.state.batcher.running


def test_readyz_is_documented_with_its_503(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    assert set(spec["paths"]["/readyz"]["get"]["responses"]) >= {"200", "503"}
