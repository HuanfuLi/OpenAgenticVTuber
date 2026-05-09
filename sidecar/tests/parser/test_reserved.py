import pytest
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry

from sidecar.parser import (
    RESERVED_NAMES,
    CategoryCollisionError,
    ReservedNameError,
    validate_reserved_names,
)


EXPECTED_RESERVED_NAMES = frozenset(
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


def _variant(code: str) -> VariantEntry:
    return VariantEntry(code=code, hotkey_id=f"variant-{code}", source_name=code)


def _event(code: str) -> EventEntry:
    return EventEntry(
        code=code,
        hotkey_id=f"event-{code}",
        motion_file=f"{code}.motion3.json",
        duration_seconds=1.0,
    )


def test_reserved_plugin_action_code_raises() -> None:
    with pytest.raises(ReservedNameError) as exc_info:
        validate_reserved_names(plugin_action_codes={"think"}, variants=[], events=[])

    message = str(exc_info.value)
    assert "reserved LLM protocol name" in message
    assert "think" in message
    assert "plugin.action_codes" in message


def test_plugin_variant_collision_raises() -> None:
    with pytest.raises(CategoryCollisionError) as exc_info:
        validate_reserved_names(
            plugin_action_codes={"Joy"},
            variants=[_variant("joy")],
            events=[],
        )

    message = str(exc_info.value)
    assert "cross-category code collision" in message
    assert "joy" in message
    assert "plugin.action_codes" in message
    assert "variants[].code" in message


def test_variant_event_collision_raises() -> None:
    with pytest.raises(CategoryCollisionError) as exc_info:
        validate_reserved_names(
            plugin_action_codes=set(),
            variants=[_variant("wave")],
            events=[_event("WAVE")],
        )

    message = str(exc_info.value)
    assert "cross-category code collision" in message
    assert "wave" in message
    assert "variants[].code" in message
    assert "events[].code" in message


def test_clean_input_passes() -> None:
    validate_reserved_names(
        plugin_action_codes={"joy", "sad"},
        variants=[_variant("heart-eye")],
        events=[_event("wave")],
    )


def test_reserved_names_completeness() -> None:
    assert RESERVED_NAMES == EXPECTED_RESERVED_NAMES
    assert len(RESERVED_NAMES) == 28
    assert "antml:function_calls" in RESERVED_NAMES
