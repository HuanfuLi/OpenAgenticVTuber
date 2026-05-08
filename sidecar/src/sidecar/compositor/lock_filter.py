SYSTEM_PRIMITIVE_OVERRIDES = {
    "MouthOpen": "lipsync owns the VTS mouth input; speech without mouth motion is broken",
}


def is_system_primitive_override(param_id: str) -> bool:
    return param_id in SYSTEM_PRIMITIVE_OVERRIDES
