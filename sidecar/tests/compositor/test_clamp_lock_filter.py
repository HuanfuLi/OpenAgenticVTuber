from __future__ import annotations

import math

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities

from sidecar.compositor.clamp import clamp_and_validate, reset_drop_warning_cache
from sidecar.compositor.lock_filter import SYSTEM_PRIMITIVE_OVERRIDES, is_system_primitive_override


def test_clamp_and_validate_drops_unknown_and_nonfinite_params() -> None:
    frame = ParamFrame(
        add_params={
            "ParamAngleX": 2.5,
            "UnknownAdd": 0.5,
            "ParamAngleY": math.nan,
            "ParamAngleZ": math.inf,
        },
        set_params={
            "ParamEyeOpenL": (0.25, 0.5),
            "UnknownSet": (0.5, 0.5),
            "ParamEyeOpenR": (math.nan, 0.5),
            "ParamEyeBallX": (0.1, math.inf),
        },
        tick_n=42,
        emitted_at_monotonic=12.5,
    )
    capabilities = RigCapabilities(
        writable_param_ids=[
            "ParamAngleX",
            "ParamAngleY",
            "ParamAngleZ",
            "ParamEyeOpenL",
            "ParamEyeOpenR",
            "ParamEyeBallX",
        ]
    )

    clamped = clamp_and_validate(frame, capabilities)

    assert clamped.add_params == {"ParamAngleX": 1.0}
    assert clamped.set_params == {"ParamEyeOpenL": (0.25, 0.5)}
    assert clamped.tick_n == 42
    assert clamped.emitted_at_monotonic == 12.5


def test_clamp_and_validate_clamps_add_values_set_values_and_set_weights() -> None:
    frame = ParamFrame(
        add_params={"ParamAngleX": -2.0, "ParamAngleY": 0.25},
        set_params={
            "ParamEyeOpenL": (2.0, 1.5),
            "ParamEyeOpenR": (-2.0, -0.25),
        },
    )
    capabilities = RigCapabilities(
        writable_param_ids=["ParamAngleX", "ParamAngleY", "ParamEyeOpenL", "ParamEyeOpenR"]
    )

    clamped = clamp_and_validate(frame, capabilities)

    assert clamped.add_params == {"ParamAngleX": -1.0, "ParamAngleY": 0.25}
    assert clamped.set_params == {
        "ParamEyeOpenL": (1.0, 1.0),
        "ParamEyeOpenR": (-1.0, 0.0),
    }


def test_clamp_and_validate_allows_vts_tracking_inputs_not_reflected_from_rig() -> None:
    frame = ParamFrame(
        add_params={
            "FaceAngleX": 12.5,
            "FaceAngleY": -8.25,
            "FaceAngleZ": 7.1,
            "EyeRightY": 0.2,
            "FacePositionZ": -2.15,
        },
        set_params={"MouthOpen": (0.8, 1.0)},
    )
    capabilities = RigCapabilities(writable_param_ids=["ParamAngleX"])

    clamped = clamp_and_validate(frame, capabilities)

    assert clamped.add_params == frame.add_params
    assert clamped.set_params == frame.set_params


def test_clamp_and_validate_uses_tracking_input_ranges() -> None:
    frame = ParamFrame(
        add_params={
            "FaceAngleX": 45.0,
            "FaceAngleZ": -45.0,
            "FacePositionZ": -9.0,
            "FacePositionX": 2.0,
        },
        set_params={"MouthOpen": (2.0, 1.0)},
    )
    capabilities = RigCapabilities(writable_param_ids=[])

    clamped = clamp_and_validate(frame, capabilities)

    assert clamped.add_params == {
        "FaceAngleX": 30.0,
        "FaceAngleZ": -30.0,
        "FacePositionZ": -3.0,
        "FacePositionX": 1.0,
    }
    assert clamped.set_params == {"MouthOpen": (1.0, 1.0)}


def test_clamp_and_validate_warns_unknown_param_once(monkeypatch) -> None:
    reset_drop_warning_cache()
    warnings: list[tuple[str, tuple[object, ...]]] = []
    monkeypatch.setattr(
        "sidecar.compositor.clamp.logger.warning",
        lambda message, *args: warnings.append((message, args)),
    )
    frame = ParamFrame(add_params={"UnknownAdd": 0.5})
    capabilities = RigCapabilities(writable_param_ids=[])

    clamp_and_validate(frame, capabilities)
    clamp_and_validate(frame, capabilities)

    assert warnings == [("[PLUGIN-FRAME-DROP] unknown add param={}", ("UnknownAdd",))]
    reset_drop_warning_cache()


def test_mouth_open_is_only_system_primitive_override() -> None:
    assert SYSTEM_PRIMITIVE_OVERRIDES == {
        "MouthOpen": "lipsync owns the VTS mouth input; speech without mouth motion is broken",
    }
    assert is_system_primitive_override("MouthOpen") is True
    assert is_system_primitive_override("ParamAngleX") is False
