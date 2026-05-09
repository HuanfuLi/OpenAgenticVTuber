"""HUD-04: set-lock / clear-lock round-trip via /hud/ws."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from sidecar.compositor import HudTap
from sidecar.ws.server import app


def _seed_state() -> None:
    app.state.lock_state = {}
    app.state.hud_tap = HudTap()


def test_set_lock_persists_in_lock_state() -> None:
    _seed_state()
    with TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.send_json({"kind": "set-lock", "param_id": "FaceAngleX", "value": 0.7})
            ack = ws.receive_json()
            assert ack["kind"] == "lock-confirmed"
            assert ack["param_id"] == "FaceAngleX"
            assert ack["value"] == pytest.approx(0.7)
        assert app.state.lock_state == {"FaceAngleX": 0.7}


def test_set_lock_resolves_cubism_output_to_vts_input() -> None:
    _seed_state()
    with TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.send_json({"kind": "set-lock", "param_id": "ParamAngleX", "value": 0.7})
            ack = ws.receive_json()
            assert ack["kind"] == "lock-confirmed"
            assert ack["param_id"] == "FaceAngleX"
        assert app.state.lock_state == {"FaceAngleX": 0.7}


def test_clear_lock_removes_entry() -> None:
    _seed_state()
    app.state.lock_state["ParamAngleX"] = 0.5
    with TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.send_json({"kind": "clear-lock", "param_id": "ParamAngleX"})
        assert "ParamAngleX" not in app.state.lock_state


def test_set_lock_rejects_system_primitive() -> None:
    _seed_state()
    with TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.send_json({"kind": "set-lock", "param_id": "MouthOpen", "value": 0.5})
            reply = ws.receive_json()
            assert reply["kind"] == "lock-rejected"
            assert reply["param_id"] == "MouthOpen"
        assert "MouthOpen" not in app.state.lock_state


def test_set_lock_rejects_resolved_system_primitive() -> None:
    _seed_state()
    with TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.send_json({"kind": "set-lock", "param_id": "ParamMouthOpenY", "value": 0.5})
            reply = ws.receive_json()
            assert reply["kind"] == "lock-rejected"
            assert reply["param_id"] == "ParamMouthOpenY"
        assert app.state.lock_state == {}


def test_invalid_c2s_message_emits_lock_rejected() -> None:
    """Wrong-direction message (S2C kind sent from client) is rejected."""
    _seed_state()
    with TestClient(app) as client:
        with client.websocket_connect("/hud/ws") as ws:
            ws.send_json({"kind": "param-frame", "tick_n": 1, "params": {}, "locked_ids": []})
            reply = ws.receive_json()
            assert reply["kind"] == "lock-rejected"
