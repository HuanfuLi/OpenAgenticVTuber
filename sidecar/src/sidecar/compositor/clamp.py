from __future__ import annotations

import math

from loguru import logger

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities
from sidecar.compositor.param_id_resolver import (
    VTS_TRACKING_INPUT_PARAM_IDS,
    VTS_TRACKING_INPUT_PARAM_RANGES,
)

_warned_drops: set[tuple[str, str, str]] = set()


def _warning_once(reason: str, mode: str, key: str, message: str, *args: object) -> None:
    warning_key = (reason, mode, key)
    if warning_key in _warned_drops:
        return
    _warned_drops.add(warning_key)
    logger.warning(message, *args)


def reset_drop_warning_cache() -> None:
    _warned_drops.clear()


def _clamp_param_value(key: str, value: float) -> float:
    lower, upper = VTS_TRACKING_INPUT_PARAM_RANGES.get(key, (-1.0, 1.0))
    return max(lower, min(upper, float(value)))


def clamp_and_validate(frame: ParamFrame, capabilities: RigCapabilities) -> ParamFrame:
    writable = set(capabilities.writable_param_ids) | set(VTS_TRACKING_INPUT_PARAM_IDS)
    add_params: dict[str, float] = {}
    set_params: dict[str, tuple[float, float]] = {}

    for key, value in frame.add_params.items():
        if key not in writable:
            _warning_once("unknown", "add", key, "[PLUGIN-FRAME-DROP] unknown add param={}", key)
            continue
        if not math.isfinite(float(value)):
            _warning_once(
                "nonfinite",
                "add",
                key,
                "[PLUGIN-FRAME-DROP] nonfinite add param={} value={}",
                key,
                value,
            )
            continue
        add_params[key] = _clamp_param_value(key, float(value))

    for key, value_weight in frame.set_params.items():
        value, weight = value_weight
        if key not in writable:
            _warning_once("unknown", "set", key, "[PLUGIN-FRAME-DROP] unknown set param={}", key)
            continue
        if not math.isfinite(float(value)) or not math.isfinite(float(weight)):
            _warning_once(
                "nonfinite",
                "set",
                key,
                "[PLUGIN-FRAME-DROP] nonfinite set param={} value_weight={}",
                key,
                value_weight,
            )
            continue
        set_params[key] = (
            _clamp_param_value(key, float(value)),
            max(0.0, min(1.0, float(weight))),
        )

    return ParamFrame(
        add_params=add_params,
        set_params=set_params,
        tick_n=frame.tick_n,
        emitted_at_monotonic=frame.emitted_at_monotonic,
    )
