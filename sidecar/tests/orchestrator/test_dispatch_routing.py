from __future__ import annotations

import pytest
from loguru import logger

from contracts import ActionCode, AvatarOverrides, EventEntry, EventFire, VariantEntry, VariantToggle
from sidecar.orchestrator.orchestrator import Orchestrator
from sidecar.orchestrator.output_types import DisplayText, SentenceOutput


class _Gateway:
    async def stream(self, _send_window, _system_prompt):
        if False:
            yield ""


class _WS:
    def __init__(self) -> None:
        self.writes: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.writes.append(payload)


class _PluginAdapter:
    def __init__(self, record: list[str] | None = None, *, accepts: bool = True) -> None:
        self.record = record if record is not None else []
        self.accepts = accepts
        self.actions: list[ActionCode] = []
        self.sentences: list[str] = []

    def enqueue_action_code(self, action: ActionCode) -> bool:
        self.record.append(f"action:{action.name}")
        self.actions.append(action)
        return self.accepts

    def enqueue_sentence(self, sentence: str) -> None:
        self.sentences.append(sentence)


class _VariantStateManager:
    def __init__(self, record: list[str] | None = None) -> None:
        self.record = record if record is not None else []
        self.applied: list[VariantToggle] = []

    async def apply(self, toggle: VariantToggle) -> None:
        self.record.append(f"variant:{toggle.name}")
        self.applied.append(toggle)


class _DiscreteDispatcher:
    def __init__(self, record: list[str] | None = None) -> None:
        self.record = record if record is not None else []
        self.fired: list[tuple[str, str]] = []

    async def fire(self, hotkey_id: str, name: str = "", force: bool = False):
        del force
        self.record.append(f"event-fire:{name}")
        self.fired.append((hotkey_id, name))
        return {"ok": True}


class _EventCompletionTracker:
    def __init__(self, record: list[str] | None = None) -> None:
        self.record = record if record is not None else []
        self.tracked: list[EventFire] = []

    def track(self, event: EventFire) -> None:
        self.record.append(f"event-track:{event.name}")
        self.tracked.append(event)


def _orchestrator(**kwargs) -> Orchestrator:
    return Orchestrator(
        gateway=_Gateway(),
        persona_text="persona",
        action_codes_section="",
        allow_no_tts_test_stub=True,
        **kwargs,
    )


@pytest.mark.asyncio
async def test_action_dispatch_reaches_active_plugin_adapter() -> None:
    records: list[str] = []
    plugin_adapter = _PluginAdapter()
    sink_id = logger.add(lambda msg: records.append(msg.record["message"]), level="INFO")
    try:
        await _orchestrator(plugin_adapter=plugin_adapter)._route_dispatches(
            [ActionCode(name="joy")]
        )
    finally:
        logger.remove(sink_id)

    assert plugin_adapter.actions == [ActionCode(name="joy")]
    assert any("[DISPATCH] kind=action name=joy" in record for record in records)


@pytest.mark.asyncio
async def test_variant_dispatch_routes_to_variant_state_manager() -> None:
    manager = _VariantStateManager()
    toggle = VariantToggle(name="hold-mic", hotkey_id="hk-v")

    await _orchestrator(variant_state_manager=manager)._route_dispatches([toggle])

    assert manager.applied == [toggle]


@pytest.mark.asyncio
async def test_event_dispatch_fires_and_tracks_completion() -> None:
    dispatcher = _DiscreteDispatcher()
    tracker = _EventCompletionTracker()
    event = EventFire(name="wave", hotkey_id="hk-e", duration_ms=2833)

    await _orchestrator(
        discrete_dispatcher=dispatcher,
        event_completion_tracker=tracker,
    )._route_dispatches([event])

    assert dispatcher.fired == [("hk-e", "wave")]
    assert tracker.tracked == [event]


@pytest.mark.asyncio
async def test_dispatch_order_is_preserved() -> None:
    record: list[str] = []

    await _orchestrator(
        plugin_adapter=_PluginAdapter(record),
        variant_state_manager=_VariantStateManager(record),
        discrete_dispatcher=_DiscreteDispatcher(record),
        event_completion_tracker=_EventCompletionTracker(record),
    )._route_dispatches(
        [
            ActionCode(name="joy"),
            VariantToggle(name="hold-mic", hotkey_id="hk-v"),
            EventFire(name="wave", hotkey_id="hk-e", duration_ms=2833),
        ]
    )

    assert record == ["action:joy", "variant:hold-mic", "event-fire:wave", "event-track:wave"]


@pytest.mark.asyncio
async def test_event_without_hotkey_id_is_dropped() -> None:
    records: list[str] = []
    dispatcher = _DiscreteDispatcher()
    sink_id = logger.add(lambda msg: records.append(msg.record["message"]), level="INFO")
    try:
        await _orchestrator(discrete_dispatcher=dispatcher)._route_dispatches(
            [EventFire(name="wave", hotkey_id="", duration_ms=2833)]
        )
    finally:
        logger.remove(sink_id)

    assert dispatcher.fired == []
    assert any(
        "[DISPATCH-DROP] kind=event name=wave reason=missing-hotkey-id" in record
        for record in records
    )


@pytest.mark.asyncio
async def test_stub_audio_payload_contains_dispatches_and_no_actions() -> None:
    ws = _WS()
    dispatches = [ActionCode(name="joy")]
    sentence = SentenceOutput(
        display_text=DisplayText(text="Hello"),
        tts_text="Hello",
        plugin_text="[joy] Hello",
        dispatches=dispatches,
    )

    await _orchestrator()._emit_sentence(ws, sentence, sentence_id=7)

    assert ws.writes[0]["dispatches"] == [dispatch.model_dump() for dispatch in dispatches]
    assert "actions" not in ws.writes[0]


@pytest.mark.asyncio
async def test_no_tts_emit_requires_explicit_test_stub_opt_in() -> None:
    ws = _WS()
    sentence = SentenceOutput(
        display_text=DisplayText(text="Hello"),
        tts_text="Hello",
        plugin_text="Hello",
        dispatches=[],
    )

    with pytest.raises(RuntimeError, match="TTSTaskManager"):
        await Orchestrator(
            gateway=_Gateway(),
            persona_text="persona",
            action_codes_section="",
        )._emit_sentence(ws, sentence, sentence_id=7)


@pytest.mark.asyncio
async def test_pipeline_uses_plugin_actions_and_avatar_overrides_for_code_extractor() -> None:
    class Gateway:
        async def stream(self, _send_window, _system_prompt):
            yield "[neutral] {heart-eye} <wave> Hello."

    orchestrator = Orchestrator(
        gateway=Gateway(),
        persona_text="persona",
        action_codes_section="",
        plugin_action_codes={"neutral"},
        avatar_overrides=AvatarOverrides(
            variants=[
                VariantEntry(
                    code="heart-eye",
                    hotkey_id="hk-variant",
                    source_name="Heart Eye",
                )
            ],
            events=[
                EventEntry(
                    code="wave",
                    hotkey_id="hk-event",
                    motion_file="wave.motion3.json",
                    duration_seconds=1.5,
                )
            ],
        ),
    )

    outputs = [item async for item in orchestrator._run_pipeline([])]

    assert len(outputs) == 1
    assert outputs[0].dispatches == [
        ActionCode(name="neutral"),
        VariantToggle(name="heart-eye", hotkey_id="hk-variant"),
        EventFire(name="wave", hotkey_id="hk-event", duration_ms=2500),
    ]
