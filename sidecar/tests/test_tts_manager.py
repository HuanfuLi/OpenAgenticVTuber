from __future__ import annotations

import asyncio
import base64
import re
import wave
from io import BytesIO
from types import SimpleNamespace

import pytest
from loguru import logger

from contracts import ActionIntent, DisplayTextField
from sidecar.tts.tts_manager import TTSTaskManager


class _FakeStream:
    def __init__(self, latency: float = 0.125, stream_time: float = 10.0) -> None:
        self.latency = latency
        self.time = stream_time
        self.writes: list[bytes] = []

    def write(self, pcm_bytes: bytes) -> None:
        self.writes.append(pcm_bytes)


class _FakeWS:
    def __init__(self) -> None:
        self.writes: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.writes.append(payload)


def _display(text: str) -> DisplayTextField:
    return DisplayTextField(text=text, name="Teto", avatar="teto")


def _actions() -> list[ActionIntent]:
    return [
        ActionIntent(
            kind="expression",
            name="joy",
            strength=1.0,
            duration_ms=None,
            avatar_id="teto",
        )
    ]


def _pcm_wav_b64(sample_rate: int = 22050, pcm: bytes = b"\x01\x00\x02\x00") -> str:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@pytest.mark.asyncio
async def test_speak_returns_immediately_and_parallel_synth_occurs(monkeypatch):
    stream = _FakeStream()
    ws = _FakeWS()
    queue: asyncio.Queue = asyncio.Queue()
    manager = TTSTaskManager(
        stream=stream,
        compositor_speech_queue=queue,
    )

    entered: list[int] = []
    release = asyncio.Event()

    async def fake_prepare(*, tts_text, display_text, actions, sentence_id):
        entered.append(sentence_id)
        if len(entered) == 2:
            release.set()
        await release.wait()
        return (
            {
                "type": "audio",
                "audio": _pcm_wav_b64(),
                "volumes": [0.5],
                "slice_length": 20,
                "display_text": display_text.model_dump(),
                "actions": [a.model_dump() for a in actions],
                "sentence_id": sentence_id,
                "forwarded": False,
            },
            b"\x01\x00\x02\x00",
            22050,
        )

    monkeypatch.setattr(manager, "_synthesize_payload", fake_prepare)

    await manager.speak("one.", _display("one."), _actions(), 1, ws)
    await manager.speak("two.", _display("two."), _actions(), 2, ws)

    await asyncio.wait_for(release.wait(), timeout=1)
    assert entered == [1, 2]

    await manager.wait_for_all_audio_complete()
    assert [w["sentence_id"] for w in ws.writes] == [1, 2]


@pytest.mark.asyncio
async def test_sender_buffers_out_of_order_synth_until_next_sequence(monkeypatch):
    stream = _FakeStream()
    ws = _FakeWS()
    queue: asyncio.Queue = asyncio.Queue()
    manager = TTSTaskManager(stream=stream, compositor_speech_queue=queue)

    first_can_finish = asyncio.Event()
    second_ready = asyncio.Event()

    async def fake_prepare(*, tts_text, display_text, actions, sentence_id):
        if sentence_id == 1:
            await first_can_finish.wait()
        if sentence_id == 2:
            second_ready.set()
        return (
            {
                "type": "audio",
                "audio": _pcm_wav_b64(),
                "volumes": [sentence_id / 10.0],
                "slice_length": 20,
                "display_text": display_text.model_dump(),
                "actions": [a.model_dump() for a in actions],
                "sentence_id": sentence_id,
                "forwarded": False,
            },
            bytes([sentence_id, 0]),
            22050,
        )

    monkeypatch.setattr(manager, "_synthesize_payload", fake_prepare)

    await manager.speak("first.", _display("first."), _actions(), 1, ws)
    await manager.speak("second.", _display("second."), _actions(), 2, ws)

    await asyncio.wait_for(second_ready.wait(), timeout=1)
    await asyncio.sleep(0)
    assert ws.writes == []

    first_can_finish.set()
    await manager.wait_for_all_audio_complete()

    assert [w["sentence_id"] for w in ws.writes] == [1, 2]


@pytest.mark.asyncio
async def test_sender_uses_locked_order_for_non_silent_payload(monkeypatch):
    stream = _FakeStream(latency=0.2, stream_time=50.0)
    ws = _FakeWS()
    speech_queue: asyncio.Queue = asyncio.Queue()
    manager = TTSTaskManager(stream=stream, compositor_speech_queue=speech_queue)

    observed: list[str] = []
    envelope = None

    async def fake_put(item):
        nonlocal envelope
        observed.append("queue-put")
        envelope = item

    async def fake_send_json(payload):
        observed.append("ws-send")
        ws.writes.append(payload)

    async def fake_executor(_executor, func, pcm_bytes):
        observed.append("write")
        func(pcm_bytes)

    speech_queue.put = fake_put  # type: ignore[method-assign]
    ws.send_json = fake_send_json  # type: ignore[method-assign]
    loop = asyncio.get_running_loop()
    monkeypatch.setattr(loop, "run_in_executor", fake_executor)

    async def fake_prepare(*, tts_text, display_text, actions, sentence_id):
        return (
            {
                "type": "audio",
                "audio": _pcm_wav_b64(),
                "volumes": [0.2, 0.8],
                "slice_length": 20,
                "display_text": display_text.model_dump(),
                "actions": [a.model_dump() for a in actions],
                "sentence_id": sentence_id,
                "forwarded": False,
            },
            b"\x01\x00\x02\x00",
            22050,
        )

    monkeypatch.setattr(manager, "_synthesize_payload", fake_prepare)

    await manager.speak("hello.", _display("hello."), _actions(), 1, ws)
    await manager.wait_for_all_audio_complete()

    assert observed == ["queue-put", "ws-send", "write"]
    assert envelope is not None
    assert envelope.sentence_id == 1
    assert envelope.started_at == pytest.approx(50.2)


@pytest.mark.asyncio
async def test_silent_payload_skips_queue_put_and_stream_write(monkeypatch):
    stream = _FakeStream()
    ws = _FakeWS()
    speech_queue: asyncio.Queue = asyncio.Queue()
    manager = TTSTaskManager(stream=stream, compositor_speech_queue=speech_queue)

    queue_put_calls = 0

    async def fake_put(_item):
        nonlocal queue_put_calls
        queue_put_calls += 1

    speech_queue.put = fake_put  # type: ignore[method-assign]

    await manager.speak("   ", _display("blank"), _actions(), 1, ws)
    await manager.wait_for_all_audio_complete()

    assert queue_put_calls == 0
    assert stream.writes == []
    assert len(ws.writes) == 1
    assert ws.writes[0]["audio"] is None


@pytest.mark.asyncio
async def test_wait_for_all_audio_complete_waits_for_tasks_queue_and_latency(monkeypatch):
    stream = _FakeStream(latency=0.25)
    ws = _FakeWS()
    speech_queue: asyncio.Queue = asyncio.Queue()
    manager = TTSTaskManager(stream=stream, compositor_speech_queue=speech_queue)

    sleep_calls: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleep_calls.append(delay)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    async def fake_prepare(*, tts_text, display_text, actions, sentence_id):
        return (
            {
                "type": "audio",
                "audio": _pcm_wav_b64(),
                "volumes": [0.1],
                "slice_length": 20,
                "display_text": display_text.model_dump(),
                "actions": [a.model_dump() for a in actions],
                "sentence_id": sentence_id,
                "forwarded": False,
            },
            b"\x01\x00",
            22050,
        )

    monkeypatch.setattr(manager, "_synthesize_payload", fake_prepare)

    await manager.speak("hello.", _display("hello."), _actions(), 1, ws)
    await manager.wait_for_all_audio_complete()

    assert sleep_calls == [pytest.approx(0.27)]


@pytest.mark.asyncio
async def test_tts_logs_emit_expected_markers(monkeypatch):
    stream = _FakeStream(stream_time=12.0, latency=0.15)
    ws = _FakeWS()
    queue: asyncio.Queue = asyncio.Queue()
    manager = TTSTaskManager(stream=stream, compositor_speech_queue=queue)

    async def fake_prepare(*, tts_text, display_text, actions, sentence_id):
        await asyncio.sleep(0)
        return (
            {
                "type": "audio",
                "audio": _pcm_wav_b64(),
                "volumes": [0.4],
                "slice_length": 20,
                "display_text": display_text.model_dump(),
                "actions": [a.model_dump() for a in actions],
                "sentence_id": sentence_id,
                "forwarded": False,
            },
            b"\x01\x00",
            22050,
        )

    monkeypatch.setattr(manager, "_synthesize_payload", fake_prepare)

    records: list[str] = []
    sink_id = logger.add(lambda msg: records.append(msg.record["message"]), level="INFO")
    try:
        await manager.speak("hello.", _display("hello."), _actions(), 1, ws)
        await manager.wait_for_all_audio_complete()
    finally:
        logger.remove(sink_id)

    patterns = [
        r'^\[TTS-SYNTH-START\] sentence_id=1 text="hello\." spawn_at=\d+(\.\d+)?$',
        r"^\[TTS-SYNTH-END\] sentence_id=1 synth_ms=\d+(\.\d+)?$",
        r"^\[TTS-WRITE-START\] sentence_id=1 started_at=\d+(\.\d+)? volumes_n=1 slice_ms=20$",
        r"^\[TTS-WRITE-END\] sentence_id=1 write_ms=\d+(\.\d+)? xrun=(True|False)$",
        r"^\[TTS-DRAIN-END\] sentence_id=1 drain_ms=\d+(\.\d+)?$",
    ]
    for pattern in patterns:
        assert any(re.match(pattern, record) for record in records), records
