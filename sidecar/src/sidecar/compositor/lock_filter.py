"""Lock filter and HUD-exclusion derivation.

SYSTEM_PRIMITIVE_OVERRIDES per ARCH-12: VTS tracking input names where lipsync
(or any future system primitive) wins over user lock during compositor merge.

hud_excluded_param_ids() per HUD-06: derived inverse-mapping that returns the
subset of writable_param_ids HIDDEN from the HUD slider list (covers BOTH
direct VTS-form membership AND Cubism-form params that resolver-map to a
VTS-form override). Single source of truth: SYSTEM_PRIMITIVE_OVERRIDES.
"""

from __future__ import annotations

from contracts.rig_capabilities import RigCapabilities
from sidecar.compositor.param_id_resolver import _VTS_INPUT_PARAM_MAP


SYSTEM_PRIMITIVE_OVERRIDES = {
    "MouthOpen": "lipsync owns the VTS mouth input; speech without mouth motion is broken",
}


# Inverse map (VTS tracking input name -> set of Cubism IDs that resolver-map to it)
# Built once at module load from _VTS_INPUT_PARAM_MAP -- no second list to maintain.
_VTS_TO_CUBISM_REVERSE: dict[str, set[str]] = {}
for _cubism_id, _vts_id in _VTS_INPUT_PARAM_MAP.items():
    _VTS_TO_CUBISM_REVERSE.setdefault(_vts_id, set()).add(_cubism_id)


def is_system_primitive_override(param_id: str) -> bool:
    return param_id in SYSTEM_PRIMITIVE_OVERRIDES


def hud_excluded_param_ids(writable_param_ids: list[str]) -> set[str]:
    """Return the subset of writable_param_ids hidden from HUD per HUD-06 / ARCH-12.

    A param ID is excluded if EITHER:
    1. It is a VTS tracking input name directly in SYSTEM_PRIMITIVE_OVERRIDES
       (e.g., "MouthOpen"), OR
    2. It is a Cubism param ID that the resolver maps TO a VTS tracking input
       in SYSTEM_PRIMITIVE_OVERRIDES (e.g., "ParamMouthOpenY" -> "MouthOpen"
       -> excluded).
    """
    excluded: set[str] = set()
    for param_id in writable_param_ids:
        if param_id in SYSTEM_PRIMITIVE_OVERRIDES:
            excluded.add(param_id)
            continue
        vts_form = _VTS_INPUT_PARAM_MAP.get(param_id)
        if vts_form and vts_form in SYSTEM_PRIMITIVE_OVERRIDES:
            excluded.add(param_id)
    return excluded


def hud_visible_param_ids(capabilities: RigCapabilities) -> set[str]:
    """Return the lockable, meaningful HUD slider IDs for a rig.

    When VTS parameter settings are available, Phase 8 now records bounded VTS
    input params in param_ranges. Prefer that smaller writer-compatible surface
    over every Cubism/CDI3 output param, which can include hundreds of internal
    rig controls. If no bounded params exist, fall back to the original Phase 9
    contract: writable ids minus system-primitive exclusions.
    """
    excluded = hud_excluded_param_ids(capabilities.writable_param_ids)
    ranged = {
        param_id
        for param_id in capabilities.writable_param_ids
        if param_id not in excluded and capabilities.param_ranges.get(param_id) is not None
    }
    if ranged:
        return ranged
    return {
        param_id
        for param_id in capabilities.writable_param_ids
        if param_id not in excluded
    }
