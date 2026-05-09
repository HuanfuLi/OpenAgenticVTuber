"""Tests for hud_excluded_param_ids -- HUD-06 / ARCH-12 namespace coverage."""

from __future__ import annotations

from contracts.rig_capabilities import RigCapabilities
from sidecar.compositor.lock_filter import (
    SYSTEM_PRIMITIVE_OVERRIDES,
    hud_excluded_param_ids,
    hud_visible_param_ids,
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


def test_hud_visible_prefers_bounded_vts_input_params() -> None:
    caps = RigCapabilities(
        writable_param_ids=[
            "FaceAngleX",
            "MouthOpen",
            "ParamAngleX",
            "ParamMouthOpenY",
            "ParamInternalRigControl",
        ],
        param_ranges={
            "FaceAngleX": (-30.0, 30.0),
            "MouthOpen": (0.0, 1.0),
            "ParamAngleX": None,
            "ParamMouthOpenY": None,
            "ParamInternalRigControl": None,
        },
    )

    assert hud_visible_param_ids(caps) == {"FaceAngleX"}


def test_hud_visible_falls_back_when_no_bounded_params() -> None:
    caps = RigCapabilities(
        writable_param_ids=["ParamAngleX", "ParamMouthOpenY"],
        param_ranges={"ParamAngleX": None, "ParamMouthOpenY": None},
    )

    assert hud_visible_param_ids(caps) == {"ParamAngleX"}
