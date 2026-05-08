"""Orchestrator end-to-end tests -- D-09, D-14, D-15..D-19, D-23,
KV-cache discipline, OLVT-canonical envelope sequence,
ContextWindowExceededError retry-once.
"""
import inspect
import re
import asyncio
from types import SimpleNamespace
from typing import AsyncIterator

import pytest
from litellm.exceptions import ContextWindowExceededError

from sidecar.orchestrator.orchestrator import Orchestrator
from sidecar.orchestrator.output_types import DisplayText, SentenceOutput
from sidecar.orchestrator.tts_preprocessor import TTSPreprocessorConfig

# Shared fakes live in conftest.py (per Blocker 3 -- no cross-test imports).
from tests.conftest import _FakeGateway, _WSRecorder


ACTION_CODES_SECTION = "## Available Actions (plugin: default v1.0.0)\n[joy] - Show joy."


def _build_orch(gateway, persona="You are Teto.") -> Orchestrator:
    return Orchestrator(
        gateway=gateway,
        persona_text=persona,
        action_codes_section=ACTION_CODES_SECTION,
        tts_preprocessor_config=TTSPreprocessorConfig(),
        valid_expression_names={"joy"},
    )


class _FakeTTSManager:
    def __init__(self) -> None:
        self.speak_calls: list[dict] = []
        self.wait_calls = 0
        self.wait_started = asyncio.Event()
        self.release_wait = asyncio.Event()

    async def speak(self, tts_text, display_text, actions, sentence_id, ws) -> None:
        self.speak_calls.append(
            {
                "tts_text": tts_text,
                "display_text": display_text,
                "actions": actions,
                "sentence_id": sentence_id,
            }
        )

    async def wait_for_all_audio_complete(self) -> None:
        self.wait_calls += 1
        self.wait_started.set()
        await self.release_wait.wait()


class _FakePluginAdapter:
    def __init__(self) -> None:
        self.received: list[str] = []

    def enqueue_sentence(self, sentence: str) -> None:
        self.received.append(sentence)


async def _fake_sentence_stream(*sentences: str) -> AsyncIterator[SentenceOutput]:
    for text in sentences:
        yield SentenceOutput(
            display_text=DisplayText(text=text),
            tts_text=text,
            plugin_text=text,
            actions=[],
        )


def _build_phase3_orch(tts_manager: _FakeTTSManager | None = None) -> Orchestrator:
    return Orchestrator(
        gateway=_FakeGateway(chunks=[]),
        persona_text="You are Teto.",
        action_codes_section=ACTION_CODES_SECTION,
        tts_preprocessor_config=TTSPreprocessorConfig(),
        tts_manager=tts_manager,
        compositor_speech_queue=asyncio.Queue(),
        pending_inputs=asyncio.Queue(),
    )


@pytest.mark.asyncio
async def test_emits_canonical_envelope_sequence():
    """OLVT-canonical sequence: chain-start -> full-text -> audio* -> force-new -> chain-end."""
    gw = _FakeGateway(chunks=["Hello [joy] world. Second sentence."])
    orch = _build_orch(gw)
    ws = _WSRecorder()
    await orch.turn("hi", ws)

    assert ws.writes[0] == {
        "type": "control",
        "text": "conversation-chain-start",
    }
    assert ws.writes[1] == {"type": "full-text", "text": "Thinking..."}
    audio_writes = [w for w in ws.writes if w.get("type") == "audio"]
    assert len(audio_writes) >= 1
    for aw in audio_writes:
        assert aw["audio"] is None              # Phase 2 stub
        assert aw["volumes"] == []              # Phase 3 fills
        assert aw["slice_length"] == 20
        assert aw["forwarded"] is False
        assert "[" not in aw["display_text"]["text"]
        assert "]" not in aw["display_text"]["text"]
    # last two = force-new-message + chain-end
    assert ws.writes[-2] == {"type": "force-new-message"}
    assert ws.writes[-1] == {
        "type": "control",
        "text": "conversation-chain-end",
    }


@pytest.mark.asyncio
async def test_memory_append_only_after_turn():
    gw = _FakeGateway(chunks=["Hello world."])
    orch = _build_orch(gw)
    ws = _WSRecorder()
    await orch.turn("hi", ws)
    assert len(orch._memory) == 2
    assert orch._head_idx == 0
    assert orch._memory[0] == {"role": "user", "content": "hi"}
    assert orch._memory[1]["role"] == "assistant"
    assert "Hello" in orch._memory[1]["content"]
    assert "world" in orch._memory[1]["content"]


def test_memory_pop_violation_absent():
    """Defensive -- KV-cache discipline forbids ANY pop/del/insert/remove/clear
    on `_memory` (Warning A precision). Append-only invariant preserves the
    prefix-stability KV-cache hit rate; integer `_head_idx` advances are the
    only allowed way to drop consumed turn-pairs.
    """
    src = inspect.getsource(Orchestrator)
    forbidden = re.compile(
        r"self\._memory\.(pop|__delitem__|insert|remove|clear)"
    )
    match = forbidden.search(src)
    assert match is None, (
        f"KV-cache violation in Orchestrator: {match.group(0)!r}"
        if match
        else "unreachable"
    )
    # Forbid `del self._memory[...]` explicitly.
    assert "del self._memory" not in src
    # Slice access to self._memory must be read-only [_head_idx:]; in-place
    # mutation forbidden.
    bad_slice = re.compile(r"self\._memory\[[^]]*\]\s*=")
    assert bad_slice.search(src) is None, (
        "in-place slice assignment to self._memory forbidden"
    )


@pytest.mark.asyncio
async def test_intent_emitted_in_audio_actions():
    gw = _FakeGateway(chunks=["Hello [joy] world."])
    orch = _build_orch(gw)
    ws = _WSRecorder()
    await orch.turn("hi", ws)
    audio_writes = [w for w in ws.writes if w.get("type") == "audio"]
    all_actions = [a for w in audio_writes for a in w["actions"]]
    assert any(
        a["kind"] == "expression"
        and a["name"] == "joy"
        and a["avatar_id"] == "teto"
        for a in all_actions
    ), all_actions


@pytest.mark.asyncio
async def test_plugin_adapter_receives_bracketed_sentence_while_display_and_tts_are_stripped():
    gw = _FakeGateway(chunks=["Hello [joy] world."])
    plugin_adapter = _FakePluginAdapter()
    orch = Orchestrator(
        gateway=gw,
        persona_text="You are Teto.",
        action_codes_section=ACTION_CODES_SECTION,
        tts_preprocessor_config=TTSPreprocessorConfig(),
        plugin_adapter=plugin_adapter,
        valid_expression_names={"joy"},
    )
    ws = _WSRecorder()

    await orch.turn("hi", ws)

    assert plugin_adapter.received == ["Hello [joy] world."]
    audio_writes = [w for w in ws.writes if w.get("type") == "audio"]
    assert audio_writes
    for audio in audio_writes:
        assert "[" not in audio["display_text"]["text"]
        assert "]" not in audio["display_text"]["text"]
    assert any(
        action["kind"] == "expression" and action["name"] == "joy"
        for audio in audio_writes
        for action in audio["actions"]
    )
    assert audio_writes[0]["display_text"]["text"] == "Hello world."


@pytest.mark.asyncio
async def test_context_overflow_retry_once_then_success():
    """First call raises ContextWindowExceededError; second call succeeds.
    Assert: two LLM calls, _head_idx advanced, turn ends successfully.
    """
    gw = _FakeGateway(
        chunks=["Recovered."],
        raise_first=ContextWindowExceededError(
            message="too long", model="test-model", llm_provider="lm_studio"
        ),
    )
    orch = _build_orch(gw)
    # Pre-populate 12 entries (6 turn pairs)
    for i in range(6):
        orch._memory.append({"role": "user", "content": f"u{i}"})
        orch._memory.append({"role": "assistant", "content": f"a{i}"})
    ws = _WSRecorder()
    await orch.turn("hi", ws)
    assert gw._call == 2  # exactly one retry
    # _head_idx must advance to at least len(memory_at_failure) - 8.
    # memory_at_failure = 12 prior + 1 user = 13. 13-8 = 5.
    assert orch._head_idx >= 5
    types = [w.get("type") for w in ws.writes]
    assert (
        types[-1] == "control"
        and ws.writes[-1]["text"] == "conversation-chain-end"
    )
    assert "error" not in types


@pytest.mark.asyncio
async def test_context_overflow_retry_also_fails_emits_error():
    """Both calls raise ContextWindowExceededError -> CONTEXT_OVERFLOW banner.

    Per Warning A precision: the failed user message REMAINS in `_memory`
    (no pop allowed). The next turn's `_compute_send_window` prunes it
    naturally via forward-only `_head_idx`. KV-cache prefix-stability
    invariant preserved.
    """
    err = ContextWindowExceededError(
        message="too long", model="test-model", llm_provider="lm_studio"
    )
    gw = _FakeGateway(raise_first=err, raise_second=err)
    orch = _build_orch(gw)
    ws = _WSRecorder()
    await orch.turn("hi", ws)
    error_writes = [w for w in ws.writes if w.get("type") == "error"]
    assert len(error_writes) == 1
    assert "Conversation got too long" in error_writes[0]["message"]
    # Failed user message REMAINS in _memory (Warning A precision -- no pop).
    assert orch._memory[-1] == {"role": "user", "content": "hi"}


@pytest.mark.asyncio
async def test_generic_exception_emits_stream_error():
    """Generic exception -> STREAM_ERROR banner. User message REMAINS in
    memory (Warning A precision -- KV-cache discipline forbids pop)."""
    gw = _FakeGateway(raise_first=RuntimeError("boom"))
    orch = _build_orch(gw)
    ws = _WSRecorder()
    await orch.turn("hi", ws)
    error_writes = [w for w in ws.writes if w.get("type") == "error"]
    assert len(error_writes) == 1
    assert "couldn't finish that reply" in error_writes[0]["message"].lower()
    # Failed user message REMAINS.
    assert orch._memory[-1] == {"role": "user", "content": "hi"}


@pytest.mark.asyncio
async def test_system_prompt_built_once():
    """Mutating expression names post-init must NOT change system_prompt."""
    gw = _FakeGateway(chunks=["ok."])
    orch = _build_orch(gw)
    prompt_at_init = orch._system_prompt
    orch._valid_expression_names.add("JOY_MUTATED_AFTER_INIT")
    ws = _WSRecorder()
    await orch.turn("hi", ws)
    assert "JOY_MUTATED_AFTER_INIT" not in gw.calls_received_system_prompt[0]
    assert gw.calls_received_system_prompt[0] == prompt_at_init


def test_system_prompt_freezes_manifest_action_section() -> None:
    first = Orchestrator(
        gateway=_FakeGateway(chunks=[]),
        persona_text="You are Teto.",
        action_codes_section=ACTION_CODES_SECTION,
    )
    second = Orchestrator(
        gateway=_FakeGateway(chunks=[]),
        persona_text="You are Teto.",
        action_codes_section=ACTION_CODES_SECTION,
    )
    changed = Orchestrator(
        gateway=_FakeGateway(chunks=[]),
        persona_text="You are Teto.",
        action_codes_section=ACTION_CODES_SECTION + "\n[anger] - Show anger.",
    )

    assert first._system_prompt.encode() == second._system_prompt.encode()
    assert changed._system_prompt != first._system_prompt


@pytest.mark.asyncio
async def test_stub_tts_log_line_emitted():
    """D-23 stub-TTS log line surfaces via loguru for Logs drawer."""
    from loguru import logger

    records: list[str] = []
    sink_id = logger.add(
        lambda msg: records.append(msg.record["message"]), level="INFO"
    )
    try:
        gw = _FakeGateway(chunks=["Hello."])
        orch = _build_orch(gw)
        ws = _WSRecorder()
        await orch.turn("hi", ws)
    finally:
        logger.remove(sink_id)
    assert any(
        re.match(r'^\[STUB-TTS\] sentence_id=\d+ text=".*"', r)
        for r in records
    ), records


@pytest.mark.asyncio
async def test_intent_log_line_emitted():
    """D-14 ActionIntent log line surfaces via loguru for Logs drawer."""
    from loguru import logger

    records: list[str] = []
    sink_id = logger.add(
        lambda msg: records.append(msg.record["message"]), level="INFO"
    )
    try:
        gw = _FakeGateway(chunks=["Hello [joy] world."])
        orch = _build_orch(gw)
        ws = _WSRecorder()
        await orch.turn("hi", ws)
    finally:
        logger.remove(sink_id)
    assert any(
        "[INTENT]" in r
        and "kind=expression" in r
        and "name=joy" in r
        and "avatar=teto" in r
        and "strength=1.0" in r
        for r in records
    ), records


# ---------------------------------------------------------------------------
# Task 3: Lifespan + WS dispatch tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_text_input_no_orchestrator_emits_config_error():
    """app.state.orchestrator=None -> text-input replies with config error."""
    from sidecar.ws.handlers import handle_text_input

    class _FakeApp:
        class _State:
            orchestrator = None

        state = _State()

    class _FakeWS:
        def __init__(self):
            self.app = _FakeApp()
            self.writes: list[dict] = []

        async def send_json(self, d: dict):
            self.writes.append(d)

    ws = _FakeWS()
    await handle_text_input(ws, {"type": "text-input", "text": "hi"})
    assert len(ws.writes) == 1
    assert ws.writes[0]["type"] == "error"
    assert "Sidecar started without LLM configuration" in ws.writes[0]["message"]


@pytest.mark.asyncio
async def test_handle_text_input_queues_turn_when_configured():
    """app.state.orchestrator=Orchestrator -> text-input queues the turn."""
    from sidecar.ws.handlers import handle_text_input

    orch = _build_phase3_orch()

    class _FakeApp:
        def __init__(self, orchestrator):
            class _State:
                pass

            self._state = _State()
            self._state.orchestrator = orchestrator

        @property
        def state(self):
            return self._state

    class _FakeWS:
        def __init__(self, orchestrator):
            self.app = _FakeApp(orchestrator)
            self.writes: list[dict] = []

        async def send_json(self, d: dict):
            self.writes.append(d)

    ws = _FakeWS(orch)
    await handle_text_input(ws, {"type": "text-input", "text": "hi"})
    assert ws.writes == []
    assert orch._active_ws is ws
    assert await orch.pending_inputs.get() == "hi"


@pytest.mark.asyncio
async def test_handle_text_input_empty_text_returns_silently():
    """Empty/whitespace-only text-input is silently dropped (no envelope)."""
    from sidecar.ws.handlers import handle_text_input

    class _FakeApp:
        class _State:
            orchestrator = None

        state = _State()

    class _FakeWS:
        def __init__(self):
            self.app = _FakeApp()
            self.writes: list[dict] = []

        async def send_json(self, d: dict):
            self.writes.append(d)

    ws = _FakeWS()
    await handle_text_input(ws, {"type": "text-input", "text": "   "})
    assert ws.writes == []


@pytest.mark.asyncio
async def test_handle_control_refuses_unavailable_body_sway_strategy():
    from sidecar.avatar.overrides import TetoOverrides
    from sidecar.ws.handlers import handle_control

    class _Compositor:
        def __init__(self):
            self.swaps: list[str] = []

        def request_strategy_swap(self, name: str) -> None:
            self.swaps.append(name)

    class _FakeApp:
        def __init__(self):
            class _State:
                pass

            self._state = _State()
            self._state.compositor = _Compositor()
            self._state.teto_overrides = TetoOverrides()

        @property
        def state(self):
            return self._state

    class _FakeWS:
        def __init__(self):
            self.app = _FakeApp()

    ws = _FakeWS()
    await handle_control(ws, {"type": "control", "text": "set-body-sway-strategy:proxy_param"})
    await handle_control(ws, {"type": "control", "text": "set-body-sway-strategy:head_only"})

    assert ws.app.state.compositor.swaps == ["head_only"]


@pytest.mark.asyncio
async def test_turn_waits_for_audio_complete_before_chain_end(monkeypatch):
    tts_manager = _FakeTTSManager()
    orch = _build_phase3_orch(tts_manager)
    ws = _WSRecorder()

    async def fake_run_pipeline(_send_window):
        async for item in _fake_sentence_stream("One.", "Two."):
            yield item

    monkeypatch.setattr(orch, "_run_pipeline", fake_run_pipeline)

    turn_task = asyncio.create_task(orch.turn("hi", ws))
    await asyncio.wait_for(tts_manager.wait_started.wait(), timeout=1)

    assert ws.writes[0] == {"type": "control", "text": "conversation-chain-start"}
    assert ws.writes[1] == {"type": "full-text", "text": "Thinking..."}
    assert [call["sentence_id"] for call in tts_manager.speak_calls] == [1, 2]
    assert {"type": "force-new-message"} not in ws.writes
    assert {"type": "control", "text": "conversation-chain-end"} not in ws.writes

    tts_manager.release_wait.set()
    await turn_task
    assert ws.writes[-2] == {"type": "force-new-message"}
    assert ws.writes[-1] == {"type": "control", "text": "conversation-chain-end"}


@pytest.mark.asyncio
async def test_turn_loop_processes_pending_inputs_serially(monkeypatch):
    tts_manager = _FakeTTSManager()
    orch = _build_phase3_orch(tts_manager)
    started: list[str] = []
    finished: list[str] = []
    release_first = asyncio.Event()
    release_second = asyncio.Event()

    async def fake_turn(user_text: str, _ws) -> None:
        started.append(user_text)
        if user_text == "first":
            await release_first.wait()
        else:
            await release_second.wait()
        finished.append(user_text)

    monkeypatch.setattr(orch, "turn", fake_turn)
    orch.set_active_ws(SimpleNamespace())

    loop_task = asyncio.create_task(orch._turn_loop())
    await orch.pending_inputs.put("first")
    await orch.pending_inputs.put("second")
    await asyncio.sleep(0)

    assert started == ["first"]
    assert finished == []

    release_first.set()
    await asyncio.sleep(0)
    assert started == ["first", "second"]
    assert finished == ["first"]

    release_second.set()
    await asyncio.sleep(0)
    assert finished == ["first", "second"]

    loop_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await loop_task


@pytest.mark.asyncio
async def test_handle_text_input_enqueues_pending_inputs_instead_of_awaiting_turn():
    from sidecar.ws.handlers import handle_text_input

    class _TurnSentinel:
        async def turn(self, *_args, **_kwargs):
            raise AssertionError("handle_text_input must not await orchestrator.turn directly")

    class _FakeApp:
        def __init__(self):
            class _State:
                pass

            def _set_active_ws(_ws):
                return None

            self._state = _State()
            self._state.orchestrator = SimpleNamespace(
                pending_inputs=asyncio.Queue(),
                turn=_TurnSentinel().turn,
                set_active_ws=_set_active_ws,
            )

        @property
        def state(self):
            return self._state

    class _FakeWS:
        def __init__(self):
            self.app = _FakeApp()
            self.writes: list[dict] = []

        async def send_json(self, d: dict):
            self.writes.append(d)

    ws = _FakeWS()
    await handle_text_input(ws, {"type": "text-input", "text": "hello"})

    assert ws.writes == []
    assert await ws.app.state.orchestrator.pending_inputs.get() == "hello"


# ---------- _load_provider_config_from_env / _warmup_ping unit tests ---------


def test_load_provider_config_from_env_present(monkeypatch):
    import json as _json

    from sidecar.ws.server import _load_provider_config_from_env

    monkeypatch.setenv(
        "AGENTICLLMVTUBER_LLM_CONFIG_JSON",
        _json.dumps(
            {
                "provider": "lm_studio",
                "endpoint": "http://localhost:1234/v1",
                "apiKey": "",
                "model": "qwen2.5-7b-instruct",
            }
        ),
    )
    cfg = _load_provider_config_from_env()
    assert cfg is not None
    assert cfg.provider == "lm_studio"
    assert cfg.endpoint == "http://localhost:1234/v1"
    assert cfg.model == "qwen2.5-7b-instruct"


def test_load_provider_config_from_env_absent(monkeypatch):
    from sidecar.ws.server import _load_provider_config_from_env

    monkeypatch.delenv("AGENTICLLMVTUBER_LLM_CONFIG_JSON", raising=False)
    assert _load_provider_config_from_env() is None


def test_load_provider_config_from_env_malformed(monkeypatch):
    from sidecar.ws.server import _load_provider_config_from_env

    monkeypatch.setenv("AGENTICLLMVTUBER_LLM_CONFIG_JSON", "{not json")
    assert _load_provider_config_from_env() is None


@pytest.mark.asyncio
async def test_warmup_ping_calls_gateway_once(fake_gateway):
    """Pitfall 5 -- warmup fires exactly one stream() call before WS opens."""
    from sidecar.ws.server import _warmup_ping

    gw = fake_gateway(chunks=["x"])
    await _warmup_ping(gw)
    assert gw._call == 1
    # Warmup messages should be a minimal user message -- never the system prompt.
    assert gw.calls_received_messages[0] == [{"role": "user", "content": "hi"}]


@pytest.mark.asyncio
async def test_warmup_ping_does_not_raise_on_gateway_error(fake_gateway):
    """Warmup failures are caught -- first turn will retry naturally."""
    from sidecar.ws.server import _warmup_ping

    gw = fake_gateway(raise_first=RuntimeError("boom"))
    # Must NOT raise -- warmup is best-effort.
    await _warmup_ping(gw)


def test_server_routes_speech_only_to_compositor_queue():
    from sidecar.ws import server

    src = inspect.getsource(server)
    assert "_drain_speech_queue_until_phase4" not in src
    assert "speech_drv = SpeechDriver(" in src
    assert "compositor_speech_queue," in src
    assert "SpeechMouthDriver" not in src
    assert "PyVTSParameterWriter" not in src
    assert "mouth_speech_queue" not in src
    assert "mouth_task" not in src
    assert "emit_mouth" not in src
