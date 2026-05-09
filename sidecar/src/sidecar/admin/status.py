"""Runtime status endpoints for renderer chrome."""

from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Request

from sidecar.vts.window_detect import find_vts_hwnd


VtsState = Literal[
    "authenticated",
    "auth_pending",
    "not_authenticated",
    "sidecar_unconfigured",
    "vts_window_not_found",
    "unavailable",
]

router = APIRouter(prefix="/admin")


def _window_detected() -> bool:
    return find_vts_hwnd(force_reprobe=True) is not None


def _payload(
    state: VtsState,
    detail: str,
    *,
    authenticated: bool,
    window_detected: bool,
) -> dict[str, object]:
    return {
        "state": state,
        "detail": detail,
        "authenticated": authenticated,
        "windowDetected": window_detected,
    }


@router.get("/vts-status")
async def get_vts_status(request: Request) -> dict[str, object]:
    """Report VTS state from existing sidecar app.state only."""
    window_detected = _window_detected()
    startup_error = getattr(request.app.state, "startup_error_message", None)
    writer = getattr(request.app.state, "writer", None)
    handshake_task: asyncio.Task | None = getattr(request.app.state, "handshake_task", None)

    if writer is None:
        detail = startup_error or "VTS writer is not configured yet."
        return _payload(
            "sidecar_unconfigured",
            detail,
            authenticated=False,
            window_detected=window_detected,
        )

    if handshake_task is None:
        return _payload(
            "not_authenticated",
            "VTS handshake has not started.",
            authenticated=False,
            window_detected=window_detected,
        )

    if not handshake_task.done():
        return _payload(
            "auth_pending",
            "VTS authentication is still pending.",
            authenticated=False,
            window_detected=window_detected,
        )

    if handshake_task.cancelled():
        return _payload(
            "not_authenticated",
            "VTS authentication was cancelled.",
            authenticated=False,
            window_detected=window_detected,
        )

    exc = handshake_task.exception()
    if exc is not None:
        detail = "VTube Studio window not found." if not window_detected else f"VTS authentication failed: {exc}"
        state: VtsState = "vts_window_not_found" if not window_detected else "not_authenticated"
        return _payload(state, detail, authenticated=False, window_detected=window_detected)

    if not window_detected:
        return _payload(
            "vts_window_not_found",
            "VTube Studio window not found.",
            authenticated=True,
            window_detected=False,
        )

    return _payload(
        "authenticated",
        "VTS authenticated and window detected.",
        authenticated=True,
        window_detected=True,
    )
