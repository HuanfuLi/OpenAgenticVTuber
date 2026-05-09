from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from numbers import Real
from typing import Iterable, Mapping

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities


@dataclass(frozen=True)
class ActionCodeParseResult:
    codes: list[str]
    pending_fragment: str = ""


def normalize_action_code(value: str) -> str:
    return value.strip().lower()


def extract_action_codes(
    text: str,
    allowed_codes: Iterable[str],
    *,
    pending_fragment: str = "",
) -> ActionCodeParseResult:
    """Extract allowed bracket action codes from LLM-visible text.

    `pending_fragment` preserves an unfinished trailing token such as "[sm" so
    callers can parse chunked token streams without losing split action codes.
    """
    allowed = {normalize_action_code(code) for code in allowed_codes}
    source = f"{pending_fragment}{text}"
    next_pending = ""

    last_open = source.rfind("[")
    last_close = source.rfind("]")
    if last_open > last_close:
        next_pending = source[last_open:]
        source = source[:last_open]

    codes: list[str] = []
    index = 0
    while index < len(source):
        if source[index] != "[":
            index += 1
            continue
        end = source.find("]", index + 1)
        if end == -1:
            break
        candidate = normalize_action_code(source[index + 1 : end])
        if candidate in allowed:
            codes.append(candidate)
        index = end + 1

    return ActionCodeParseResult(codes=codes, pending_fragment=next_pending)


def clamp01(value: float) -> float:
    if value <= 0.0:
        return 0.0
    if value >= 1.0:
        return 1.0
    return value


def ease_in_out_cubic(t: float) -> float:
    t = clamp01(t)
    if t < 0.5:
        return 4.0 * t * t * t
    return 1.0 - ((-2.0 * t + 2.0) ** 3) / 2.0


def ramp_weight(
    elapsed_seconds: float,
    *,
    ramp_in_seconds: float = 0.25,
    ramp_out_seconds: float = 0.5,
    easing: bool = True,
) -> float:
    """Return a bounded 0..1 attack/release weight."""
    elapsed = max(0.0, elapsed_seconds)
    ramp_in = max(0.000_001, ramp_in_seconds)
    ramp_out = max(0.000_001, ramp_out_seconds)

    if elapsed <= ramp_in:
        raw = elapsed / ramp_in
    elif elapsed <= ramp_in + ramp_out:
        raw = 1.0 - ((elapsed - ramp_in) / ramp_out)
    else:
        raw = 0.0
    return ease_in_out_cubic(raw) if easing else clamp01(raw)


def finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, Real):
        return None
    number = float(value)
    return number if isfinite(number) else None


def finite_params(params: Mapping[str, object]) -> dict[str, float]:
    output: dict[str, float] = {}
    for param_id, value in params.items():
        number = finite_number(value)
        if number is not None:
            output[str(param_id)] = number
    return output


def writable_param_ids(
    capabilities: RigCapabilities | None = None,
    writable_ids: Iterable[str] | None = None,
) -> set[str]:
    if writable_ids is not None:
        return {str(param_id) for param_id in writable_ids}
    if capabilities is None:
        return set()
    return {str(param_id) for param_id in capabilities.writable_param_ids}


def filter_writable_params(
    params: Mapping[str, float],
    *,
    capabilities: RigCapabilities | None = None,
    writable_ids: Iterable[str] | None = None,
) -> dict[str, float]:
    writable = writable_param_ids(capabilities, writable_ids)
    if not writable:
        return dict(params)
    return {param_id: value for param_id, value in params.items() if param_id in writable}


def safe_add_params(
    params: Mapping[str, object],
    *,
    capabilities: RigCapabilities | None = None,
    writable_ids: Iterable[str] | None = None,
) -> dict[str, float]:
    return filter_writable_params(
        finite_params(params),
        capabilities=capabilities,
        writable_ids=writable_ids,
    )


def safe_add_frame(
    params: Mapping[str, object],
    *,
    capabilities: RigCapabilities | None = None,
    writable_ids: Iterable[str] | None = None,
    emitted_at_monotonic: float = 0.0,
) -> ParamFrame:
    return ParamFrame(
        add_params=safe_add_params(
            params,
            capabilities=capabilities,
            writable_ids=writable_ids,
        ),
        emitted_at_monotonic=emitted_at_monotonic,
    )
