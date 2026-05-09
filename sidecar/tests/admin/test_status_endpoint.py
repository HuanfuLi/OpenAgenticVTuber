"""GET /admin/vts-status tests -- Phase 11 status reality."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin import status as status_module


class _Task:
    def __init__(self, *, done: bool, exc: Exception | None = None, cancelled: bool = False) -> None:
        self._done = done
        self._exc = exc
        self._cancelled = cancelled

    def done(self) -> bool:
        return self._done

    def cancelled(self) -> bool:
        return self._cancelled

    def exception(self) -> Exception | None:
        return self._exc


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(status_module.router)
    return TestClient(app)


def test_vts_status_authenticated(monkeypatch) -> None:
    monkeypatch.setattr(status_module, "find_vts_hwnd", lambda force_reprobe: 1234)
    with _client() as client:
        client.app.state.writer = object()
        client.app.state.handshake_task = _Task(done=True)
        resp = client.get("/admin/vts-status")

    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "authenticated"
    assert body["authenticated"] is True
    assert body["windowDetected"] is True


def test_vts_status_pending(monkeypatch) -> None:
    monkeypatch.setattr(status_module, "find_vts_hwnd", lambda force_reprobe: 1234)
    with _client() as client:
        client.app.state.writer = object()
        client.app.state.handshake_task = _Task(done=False)
        body = client.get("/admin/vts-status").json()

    assert body["state"] == "auth_pending"
    assert body["authenticated"] is False


def test_vts_status_unavailable_when_writer_missing(monkeypatch) -> None:
    monkeypatch.setattr(status_module, "find_vts_hwnd", lambda force_reprobe: None)
    with _client() as client:
        client.app.state.startup_error_message = "Sidecar started without LLM configuration."
        body = client.get("/admin/vts-status").json()

    assert body["state"] == "sidecar_unconfigured"
    assert "without LLM configuration" in body["detail"]
    assert body["authenticated"] is False
    assert body["windowDetected"] is False


def test_vts_status_reports_missing_window(monkeypatch) -> None:
    monkeypatch.setattr(status_module, "find_vts_hwnd", lambda force_reprobe: None)
    with _client() as client:
        client.app.state.writer = object()
        client.app.state.handshake_task = _Task(done=True)
        body = client.get("/admin/vts-status").json()

    assert body["state"] == "vts_window_not_found"
    assert body["authenticated"] is True
    assert body["windowDetected"] is False
    assert "window not found" in body["detail"]
