from collections.abc import Iterable

from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry


RESERVED_NAMES: frozenset[str] = frozenset(
    {
        "think",
        "thinking",
        "tool_call",
        "function_call",
        "function_calls",
        "invoke",
        "parameter",
        "antml:function_calls",
        "antml:invoke",
        "antml:parameter",
        "antml:thinking",
        "antml:function_call",
        "tool_use",
        "tool_result",
        "tool_calls",
        "thought",
        "thoughts",
        "reasoning",
        "reasoning_step",
        "scratchpad",
        "artifact",
        "artifacts",
        "search_quality_reflection",
        "long_conversation_reminder",
        "tool",
        "system",
        "user",
        "assistant",
    }
)


class ReservedNameError(ValueError):
    pass


class CategoryCollisionError(ValueError):
    pass


def validate_reserved_names(
    plugin_action_codes: set[str] | list[str] | None = None,
    variants: list[VariantEntry] | None = None,
    events: list[EventEntry] | None = None,
) -> None:
    categories = (
        ("plugin.action_codes", plugin_action_codes or ()),
        ("variants[].code", (variant.code for variant in variants or ())),
        ("events[].code", (event.code for event in events or ())),
    )

    seen_by_category: dict[str, dict[str, str]] = {}
    for source, codes in categories:
        normalized_codes = _normalized_codes(codes)
        for code, original_code in normalized_codes.items():
            if code in RESERVED_NAMES:
                raise ReservedNameError(
                    "reserved LLM protocol name "
                    f"{code!r} from {source} is not allowed "
                    f"(original code: {original_code!r})"
                )

            if code in seen_by_category:
                previous_source = next(iter(seen_by_category[code]))
                raise CategoryCollisionError(
                    "cross-category code collision "
                    f"for {code!r}: {previous_source} and {source}"
                )

        for code, original_code in normalized_codes.items():
            seen_by_category.setdefault(code, {})[source] = original_code


def _normalized_codes(codes: Iterable[str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for code in codes:
        normalized.setdefault(code.lower(), code)
    return normalized
