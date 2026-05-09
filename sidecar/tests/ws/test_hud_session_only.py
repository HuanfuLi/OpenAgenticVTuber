"""HUD-07: lock state is process-memory only -- cleared on app/sidecar restart."""

from __future__ import annotations

from sidecar.compositor import HudTap
from sidecar.ws.server import app


def test_lock_state_starts_empty_in_lifespan_seed() -> None:
    """When lifespan seeds app.state.lock_state, it begins empty."""
    app.state.lock_state = {}
    app.state.hud_tap = HudTap()
    assert app.state.lock_state == {}


def test_lock_state_is_plain_dict_no_persistence_layer() -> None:
    """Defense-in-depth: lock_state is a plain dict."""
    app.state.lock_state = {}
    app.state.hud_tap = HudTap()
    assert type(app.state.lock_state) is dict
    app.state.lock_state["ParamAngleX"] = 0.5
    assert app.state.lock_state["ParamAngleX"] == 0.5


def test_no_persistence_hooks_in_hud_handlers() -> None:
    """Code-level guard: hud_handlers.py must not import disk persistence."""
    from pathlib import Path

    src = Path(__file__).resolve().parents[3] / "sidecar/src/sidecar/ws/hud_handlers.py"
    text = src.read_text(encoding="utf-8")
    forbidden = ["yaml.dump", "json.dump(", "open(", "Path(", "save(", "persist", "electron_store"]
    for needle in forbidden:
        assert needle not in text, f"Forbidden persistence hook found in hud_handlers.py: {needle}"
