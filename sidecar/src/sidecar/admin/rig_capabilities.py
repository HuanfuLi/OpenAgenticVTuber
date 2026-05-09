"""GET /admin/rig-capabilities -- HUD's first-open population endpoint per HUD-08."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from contracts.rig_capabilities import RigCapabilities
from sidecar.compositor.lock_filter import hud_excluded_param_ids


router = APIRouter(prefix="/admin")


@router.get("/rig-capabilities")
async def get_rig_capabilities(request: Request) -> dict[str, Any]:
    """Return the active rig's RigCapabilities plus derived HUD exclusions."""
    compositor = getattr(request.app.state, "compositor", None)
    if compositor is None:
        empty = RigCapabilities()
        return {
            **empty.model_dump(mode="json"),
            "hud_excluded_param_ids": [],
        }

    caps: RigCapabilities = compositor._capabilities
    excluded = sorted(hud_excluded_param_ids(caps.writable_param_ids))
    return {
        **caps.model_dump(mode="json"),
        "hud_excluded_param_ids": excluded,
    }
