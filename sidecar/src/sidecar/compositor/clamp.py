from __future__ import annotations

import math

from loguru import logger

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities


def clamp_and_validate(frame: ParamFrame, capabilities: RigCapabilities) -> ParamFrame:
    writable = set(capabilities.writable_param_ids)
    add_params: dict[str, float] = {}
    set_params: dict[str, tuple[float, float]] = {}

    for key, value in frame.add_params.items():
        if key not in writable:
            logger.warning("[PLUGIN-FRAME-DROP] unknown add param={}", key)
            continue
        if not math.isfinite(float(value)):
            logger.warning("[PLUGIN-FRAME-DROP] nonfinite add param={} value={}", key, value)
            continue
        add_params[key] = max(-1.0, min(1.0, float(value)))

    for key, value_weight in frame.set_params.items():
        value, weight = value_weight
        if key not in writable:
            logger.warning("[PLUGIN-FRAME-DROP] unknown set param={}", key)
            continue
        if not math.isfinite(float(value)) or not math.isfinite(float(weight)):
            logger.warning("[PLUGIN-FRAME-DROP] nonfinite set param={} value_weight={}", key, value_weight)
            continue
        set_params[key] = (
            max(-1.0, min(1.0, float(value))),
            max(0.0, min(1.0, float(weight))),
        )

    return ParamFrame(
        add_params=add_params,
        set_params=set_params,
        tick_n=frame.tick_n,
        emitted_at_monotonic=frame.emitted_at_monotonic,
    )
