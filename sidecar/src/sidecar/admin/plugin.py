"""Runtime body-motion plugin status endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request


router = APIRouter(prefix="/admin")


def _unknown_status() -> dict[str, object]:
    return {
        "selectedPlugin": None,
        "loadedPlugin": None,
        "lifecycleState": "unknown/loading",
        "summary": "Plugin runtime status is not available yet.",
        "developerDetails": None,
        "fallbackActive": False,
        "chatAvailable": True,
    }


@router.get("/plugin/status")
async def get_plugin_status(request: Request) -> dict[str, object]:
    supervisor = getattr(request.app.state, "plugin_supervisor", None)
    if supervisor is not None and hasattr(supervisor, "runtime_status"):
        return supervisor.runtime_status()

    status = getattr(request.app.state, "plugin_runtime_status", None)
    if isinstance(status, dict):
        return status

    return _unknown_status()
