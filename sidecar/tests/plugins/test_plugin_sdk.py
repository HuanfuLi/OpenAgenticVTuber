from __future__ import annotations

from math import inf, nan

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.sdk import (
    extract_action_codes,
    finite_params,
    ramp_weight,
    safe_add_frame,
    safe_add_params,
)


def test_extract_action_codes_filters_and_normalizes() -> None:
    result = extract_action_codes(
        "Hello [WAVE] [unknown] [nod] [wave]",
        {"wave", "nod"},
    )

    assert result.codes == ["wave", "nod", "wave"]
    assert result.pending_fragment == ""


def test_extract_action_codes_preserves_partial_fragment() -> None:
    first = extract_action_codes("hello [wa", {"wave"})
    second = extract_action_codes("ve] there", {"wave"}, pending_fragment=first.pending_fragment)

    assert first.codes == []
    assert first.pending_fragment == "[wa"
    assert second.codes == ["wave"]
    assert second.pending_fragment == ""


def test_finite_params_drops_non_numeric_and_non_finite_values() -> None:
    assert finite_params(
        {
            "FaceAngleX": 1,
            "FaceAngleY": 0.25,
            "BadNan": nan,
            "BadInf": inf,
            "Text": "1.0",
            "Bool": True,
        }
    ) == {"FaceAngleX": 1.0, "FaceAngleY": 0.25}


def test_safe_add_params_filters_to_writable_params() -> None:
    capabilities = RigCapabilities(writable_param_ids=["FaceAngleX"])

    params = safe_add_params(
        {"FaceAngleX": 0.1, "FaceAngleY": 0.2},
        capabilities=capabilities,
    )

    assert params == {"FaceAngleX": 0.1}


def test_ramp_weight_is_bounded_and_expected_shape() -> None:
    values = [
        ramp_weight(0.0, ramp_in_seconds=1.0, ramp_out_seconds=1.0, easing=False),
        ramp_weight(0.5, ramp_in_seconds=1.0, ramp_out_seconds=1.0, easing=False),
        ramp_weight(1.0, ramp_in_seconds=1.0, ramp_out_seconds=1.0, easing=False),
        ramp_weight(1.5, ramp_in_seconds=1.0, ramp_out_seconds=1.0, easing=False),
        ramp_weight(2.0, ramp_in_seconds=1.0, ramp_out_seconds=1.0, easing=False),
    ]

    assert values == [0.0, 0.5, 1.0, 0.5, 0.0]
    assert all(0.0 <= value <= 1.0 for value in values)


def test_safe_add_frame_returns_param_frame_with_finite_writable_adds() -> None:
    capabilities = RigCapabilities(writable_param_ids=["FaceAngleX"])

    frame = safe_add_frame(
        {"FaceAngleX": 0.1, "FaceAngleY": 0.2, "Bad": nan},
        capabilities=capabilities,
        emitted_at_monotonic=12.5,
    )

    assert frame == ParamFrame(add_params={"FaceAngleX": 0.1}, emitted_at_monotonic=12.5)
