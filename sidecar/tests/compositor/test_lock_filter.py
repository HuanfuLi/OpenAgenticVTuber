"""Tests for hud_excluded_param_ids -- HUD-06 / ARCH-12 namespace coverage."""

from __future__ import annotations

from sidecar.compositor.lock_filter import (
    SYSTEM_PRIMITIVE_OVERRIDES,
    hud_excluded_param_ids,
    is_system_primitive_override,
)


def test_system_primitive_overrides_unchanged() -> None:
    """ARCH-12: list itself stays at one entry (MouthOpen). variant/event do NOT enter."""
    assert SYSTEM_PRIMITIVE_OVERRIDES == {
        "MouthOpen": "lipsync owns the VTS mouth input; speech without mouth motion is broken",
    }


def test_is_system_primitive_override_vts_form() -> None:
    assert is_system_primitive_override("MouthOpen") is True
    assert is_system_primitive_override("ParamMouthOpenY") is False
    assert is_system_primitive_override("ParamAngleX") is False
    assert is_system_primitive_override("") is False


def test_hud_excluded_direct_vts_form() -> None:
    assert hud_excluded_param_ids(["MouthOpen"]) == {"MouthOpen"}


def test_hud_excluded_cubism_form_via_resolver() -> None:
    """ParamMouthOpenY resolver-maps to MouthOpen -> excluded."""
    assert hud_excluded_param_ids(["ParamMouthOpenY"]) == {"ParamMouthOpenY"}


def test_mouth_excluded_in_both_namespaces() -> None:
    """Rig source files may carry both forms; both must be excluded."""
    result = hud_excluded_param_ids(["ParamMouthOpenY", "MouthOpen"])
    assert result == {"ParamMouthOpenY", "MouthOpen"}


def test_hud_excluded_preserves_unrelated_writable_params() -> None:
    """Rotation, hand, joy params are NOT excluded -- they're user-lockable per HUD-03."""
    inputs = ["ParamAngleX", "ParamBHandIN", "ParamJoy", "ParamMouthOpenY", "MouthOpen"]
    result = hud_excluded_param_ids(inputs)
    assert result == {"ParamMouthOpenY", "MouthOpen"}
    assert "ParamAngleX" not in result
    assert "ParamBHandIN" not in result
    assert "ParamJoy" not in result


def test_hud_excluded_empty_input() -> None:
    assert hud_excluded_param_ids([]) == set()


def test_hud_excluded_unrelated_face_angles_not_excluded() -> None:
    """ParamAngleX -> FaceAngleX, which is NOT in SYSTEM_PRIMITIVE_OVERRIDES, so NOT excluded."""
    assert hud_excluded_param_ids(["ParamAngleX", "ParamAngleY", "ParamAngleZ"]) == set()
