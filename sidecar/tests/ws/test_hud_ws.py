"""HUD-01 / HUD-02: /hud/ws lifecycle + decimation cadence."""

from __future__ import annotations

from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from sidecar.compositor import HudTap
from sidecar.ws.server import app


@contextmanager
def _seed_app_state():
    """Seed app.state for tests that bypass full lifespan."""
    original_lock = getattr(app.state, "lock_state", None)
    original_tap = getattr(app.state, "hud_tap", None)
    app.state.lock_state = {}
    app.state.hud_tap = HudTap()
    try:
        yield
    finally:
        if original_lock is None:
            if hasattr(app.state, "lock_state"):
                del app.state.lock_state
        else:
            app.state.lock_state = original_lock
        if original_tap is None:
            if hasattr(app.state, "hud_tap"):
                del app.state.hud_tap
        else:
            app.state.hud_tap = original_tap


def test_hud_ws_opens_and_closes() -> None:
    with _seed_app_state(), TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.close()
        assert True


def test_hud_ws_pushes_param_frame_after_publish() -> None:
    """Verify push_loop emits HudParamFrameMessage when hud_tap.publish is called."""
    with _seed_app_state(), TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            from contracts import ParamFrame

            app.state.hud_tap.publish(
                ParamFrame(add_params={"ParamAngleX": 0.5}, tick_n=4),
                {"ParamAngleX": 0.5},
            )
            msg = ws.receive_json()
            assert msg["kind"] == "param-frame"
            assert msg["tick_n"] == 4
            assert msg["params"]["ParamAngleX"] == pytest.approx(0.5)
            assert msg["locked_ids"] == ["ParamAngleX"]


def test_hud_ws_param_frame_excludes_mouth() -> None:
    """HUD-06: MouthOpen is filtered from the push payload."""
    with _seed_app_state(), TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            from contracts import ParamFrame

            app.state.hud_tap.publish(
                ParamFrame(
                    set_params={"MouthOpen": (0.7, 1.0), "ParamAngleX": (0.3, 1.0)},
                    tick_n=8,
                ),
                {},
            )
            msg = ws.receive_json()
            assert "MouthOpen" not in msg["params"]
            assert msg["params"]["ParamAngleX"] == pytest.approx(0.3)
