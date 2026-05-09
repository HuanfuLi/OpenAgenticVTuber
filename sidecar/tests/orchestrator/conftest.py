import pytest

from contracts import EventEntry, VariantEntry


@pytest.fixture
def plugin_action_codes() -> set[str]:
    return {"joy", "anger", "smirk"}


@pytest.fixture
def variants() -> list[VariantEntry]:
    return [
        VariantEntry(
            code="hold-mic",
            hotkey_id="hk-variant",
            source_name="Hold Mic",
        )
    ]


@pytest.fixture
def events() -> list[EventEntry]:
    return [
        EventEntry(
            code="wave",
            hotkey_id="hk-event",
            motion_file="Motions/Wave.motion3.json",
            duration_seconds=1.833,
            duration_is_fallback=False,
        )
    ]


@pytest.fixture
def fallback_events() -> list[EventEntry]:
    return [
        EventEntry(
            code="wave",
            hotkey_id="hk-event",
            motion_file="",
            duration_seconds=10.0,
            duration_is_fallback=True,
        )
    ]
