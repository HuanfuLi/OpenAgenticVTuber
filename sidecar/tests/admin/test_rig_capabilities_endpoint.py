"""GET /admin/rig-capabilities integration tests -- HUD-08."""

from __future__ import annotations

from fastapi.testclient import TestClient

from contracts.rig_capabilities import RigCapabilities
from sidecar.ws.server import app


def _caps_with_mouth() -> RigCapabilities:
    return RigCapabilities(
        writable_param_ids=[
            "ParamAngleX",
            "ParamAngleY",
            "ParamMouthOpenY",
            "MouthOpen",
            "ParamBHandIN",
            "ParamJoy",
        ],
        param_ranges={
            "ParamAngleX": (-30.0, 30.0),
            "ParamAngleY": (-30.0, 30.0),
            "ParamMouthOpenY": (0.0, 1.0),
            "MouthOpen": (0.0, 1.0),
            "ParamBHandIN": (0.0, 1.0),
            "ParamJoy": (0.0, 1.0),
        },
        cdi3_display_names={"ParamAngleX": "Angle X", "ParamJoy": "Joy"},
    )


def test_get_returns_payload_with_excluded_ids() -> None:
    caps = _caps_with_mouth()

    class _StubCompositor:
        _capabilities = caps

    original = getattr(app.state, "compositor", None)
    app.state.compositor = _StubCompositor()
    try:
        with TestClient(app) as client:
            resp = client.get("/admin/rig-capabilities")
        assert resp.status_code == 200
        body = resp.json()
        assert "writable_param_ids" in body
        assert "param_ranges" in body
        assert "cdi3_display_names" in body
        assert "hud_excluded_param_ids" in body
        assert "hud_visible_param_ids" in body
        assert sorted(body["hud_excluded_param_ids"]) == ["MouthOpen", "ParamMouthOpenY"]
        assert "ParamAngleX" not in body["hud_excluded_param_ids"]
        assert "ParamJoy" not in body["hud_excluded_param_ids"]
        assert body["hud_visible_param_ids"] == [
            "ParamAngleX",
            "ParamAngleY",
            "ParamBHandIN",
            "ParamJoy",
        ]
        assert "MouthOpen" in body["writable_param_ids"]
        assert "ParamMouthOpenY" in body["writable_param_ids"]
        assert body["cdi3_display_names"]["ParamAngleX"] == "Angle X"
    finally:
        if original is None:
            del app.state.compositor
        else:
            app.state.compositor = original


def test_get_boot_degraded_returns_empty_payload() -> None:
    """When compositor is None, endpoint returns RigCapabilities() defaults."""
    original = getattr(app.state, "compositor", None)
    if hasattr(app.state, "compositor"):
        del app.state.compositor
    try:
        with TestClient(app) as client:
            resp = client.get("/admin/rig-capabilities")
        assert resp.status_code == 200
        body = resp.json()
        assert body["writable_param_ids"] == []
        assert body["hud_excluded_param_ids"] == []
        assert body["hud_visible_param_ids"] == []
    finally:
        if original is not None:
            app.state.compositor = original


def test_get_no_mouth_in_caps_excludes_nothing() -> None:
    """Rig without MouthOpen in writable list -> no exclusions."""
    caps = RigCapabilities(writable_param_ids=["ParamAngleX", "ParamBHandIN"])

    class _StubCompositor:
        _capabilities = caps

    original = getattr(app.state, "compositor", None)
    app.state.compositor = _StubCompositor()
    try:
        with TestClient(app) as client:
            resp = client.get("/admin/rig-capabilities")
        body = resp.json()
        assert body["hud_excluded_param_ids"] == []
    finally:
        if original is None:
            del app.state.compositor
        else:
            app.state.compositor = original
