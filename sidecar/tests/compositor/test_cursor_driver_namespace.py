"""Regression test: CursorDriver MUST emit VTS tracking-input names only.

See 10-RESEARCH.md root-cause analysis: the milestone-1 cursor failure was
caused by `cursor_driver.py` returning Cubism input names (ParamAngleX/Y,
ParamEyeBallX/Y). Every other working driver in this codebase emits VTS
tracking-input names. This test prevents future regressions by asserting
that no Cubism param name leaks out of the cursor driver.
"""

from __future__ import annotations

from sidecar.compositor.cursor_driver import _cursor_to_param_angles
from sidecar.compositor.param_id_resolver import VTS_TRACKING_INPUT_PARAM_IDS


# ParamAngleZ is defensive -- cursor never wrote head-roll, but listed here
# to catch future regressions if cursor adds Z-axis output (per W5 review note).
CUBISM_NAMES_THAT_MUST_NOT_LEAK = frozenset(
    {"ParamAngleX", "ParamAngleY", "ParamAngleZ", "ParamEyeBallX", "ParamEyeBallY"}
)


def test_cursor_driver_returns_only_vts_tracking_input_names():
    # Cursor at right edge of a 200x200 canvas -- non-empty deflection output expected
    out = _cursor_to_param_angles((300, 200), (100, 100, 300, 300))
    assert out, "deflection output unexpectedly empty for right-edge cursor"
    leaked_cubism = set(out.keys()) & CUBISM_NAMES_THAT_MUST_NOT_LEAK
    assert not leaked_cubism, (
        f"CursorDriver leaked Cubism param names: {leaked_cubism}. "
        "Every output key must be a VTS tracking-input name (e.g., FaceAngleX). "
        "See 10-RESEARCH.md for root cause."
    )
    non_vts_keys = set(out.keys()) - VTS_TRACKING_INPUT_PARAM_IDS
    assert not non_vts_keys, (
        f"CursorDriver returned non-VTS-tracking-input keys: {non_vts_keys}. "
        f"Allowed keys: {sorted(VTS_TRACKING_INPUT_PARAM_IDS)}"
    )


def test_cursor_driver_dead_zone_returns_translated_keys_too():
    # Inside dead zone -- output is zeros but keys must still be translated
    out = _cursor_to_param_angles((210, 210), (100, 100, 300, 300))
    assert out, "dead-zone branch must return zeroed dict, not empty"
    leaked_cubism = set(out.keys()) & CUBISM_NAMES_THAT_MUST_NOT_LEAK
    assert not leaked_cubism, f"Dead-zone branch leaked Cubism names: {leaked_cubism}"
