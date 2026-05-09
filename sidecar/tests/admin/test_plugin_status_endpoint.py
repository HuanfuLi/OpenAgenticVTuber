from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin import plugin as plugin_module


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(plugin_module.router)
    return TestClient(app)


def test_plugin_status_unknown_when_runtime_missing() -> None:
    with _client() as client:
        body = client.get("/admin/plugin/status").json()

    assert body["lifecycleState"] == "unknown/loading"
    assert body["chatAvailable"] is True


def test_plugin_status_uses_supervisor_runtime_status() -> None:
    class _Supervisor:
        def runtime_status(self) -> dict[str, object]:
            return {
                "selectedPlugin": "sample_motion",
                "loadedPlugin": "sample_motion",
                "lifecycleState": "active",
                "summary": "Plugin active.",
                "developerDetails": None,
                "fallbackActive": False,
                "chatAvailable": True,
            }

    with _client() as client:
        client.app.state.plugin_supervisor = _Supervisor()
        body = client.get("/admin/plugin/status").json()

    assert body["selectedPlugin"] == "sample_motion"
    assert body["lifecycleState"] == "active"
    assert body["fallbackActive"] is False


def test_plugin_status_can_report_invalid_manifest_fallback() -> None:
    with _client() as client:
        client.app.state.plugin_runtime_status = {
            "selectedPlugin": "broken",
            "loadedPlugin": None,
            "lifecycleState": "invalid manifest",
            "summary": "Selected plugin 'broken' has no valid manifest; using fallback/null motion.",
            "developerDetails": "plugin.yaml is missing api_version",
            "fallbackActive": True,
            "chatAvailable": True,
        }
        body = client.get("/admin/plugin/status").json()

    assert body["selectedPlugin"] == "broken"
    assert body["lifecycleState"] == "invalid manifest"
    assert body["fallbackActive"] is True
    assert body["chatAvailable"] is True
