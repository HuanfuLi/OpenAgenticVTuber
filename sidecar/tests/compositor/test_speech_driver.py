import asyncio

import pytest
from loguru import logger

from contracts import SpeechEnvelopePayload
from sidecar.avatar.overrides import TetoOverrides
from sidecar.compositor.speech_driver import (
    EMA_ALPHA,
    MOUTH_ATTACK_ALPHA,
    MOUTH_GAIN,
    MOUTH_MAX_OPEN,
    MOUTH_NOISE_FLOOR,
    MOUTH_PARAM,
    MOUTH_RELEASE_ALPHA,
    MOUTH_RMS_BLEND,
    SPEECH_EVIDENCE_LOG_ENV,
    SpeechDriver,
)


@pytest.mark.asyncio
async def test_speech_driver_interpolates_rms_and_outputs_mouth(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[0.0, 1.0],
            slice_length=20,
            started_at=10.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)

    out = driver.tick(10.020)
    smoothed_rms = EMA_ALPHA * 1.0
    mouth_rms = MOUTH_RMS_BLEND * 1.0 + (1.0 - MOUTH_RMS_BLEND) * smoothed_rms
    target = min(MOUTH_MAX_OPEN, (mouth_rms - MOUTH_NOISE_FLOOR) * MOUTH_GAIN)
    assert out[MOUTH_PARAM] == pytest.approx(target * MOUTH_ATTACK_ALPHA)


@pytest.mark.asyncio
async def test_speech_driver_applies_ema_to_body_strategy(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0] * 50,
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)

    out = driver.tick(0.25)
    assert out["FaceAngleZ"] != 0.0
    assert out["FacePositionX"] != 0.0
    assert abs(out["FaceAngleZ"]) > 1.0
    assert abs(out["FacePositionZ"]) < 0.3


@pytest.mark.asyncio
async def test_speech_driver_does_not_log_evidence_by_default(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)
    messages: list[str] = []
    sink_id = logger.add(messages.append, format="{message}")
    try:
        driver.tick(0.0)
        driver.tick(0.001)
    finally:
        logger.remove(sink_id)

    assert not [message for message in messages if "[SPEECH-DRIVER]" in message]


@pytest.mark.asyncio
async def test_speech_driver_logs_strategy_body_params_when_evidence_enabled(tmp_path, monkeypatch):
    monkeypatch.setenv(SPEECH_EVIDENCE_LOG_ENV, "1")
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)
    messages: list[str] = []
    sink_id = logger.add(messages.append, format="{message}")
    try:
        driver.tick(0.0)
    finally:
        logger.remove(sink_id)

    speech_logs = [message for message in messages if "[SPEECH-DRIVER]" in message]
    assert speech_logs
    assert "strategy=head_only" in speech_logs[0]
    assert "FaceAngleZ=" in speech_logs[0]
    assert "FacePositionX=" in speech_logs[0]
    assert "MouthOpen=" not in speech_logs[0].split("body_params=[", 1)[1]


@pytest.mark.asyncio
async def test_speech_driver_throttles_evidence_logs(tmp_path, monkeypatch):
    monkeypatch.setenv(SPEECH_EVIDENCE_LOG_ENV, "1")
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)
    messages: list[str] = []
    sink_id = logger.add(messages.append, format="{message}")
    try:
        driver.tick(0.0)
        driver.tick(0.001)
        driver.tick(0.251)
    finally:
        logger.remove(sink_id)

    speech_logs = [message for message in messages if "[SPEECH-DRIVER]" in message]
    assert len(speech_logs) == 2


def test_speech_driver_swap_strategy(tmp_path):
    driver = SpeechDriver(asyncio.Queue(), TetoOverrides(), tmp_path)
    driver.swap_strategy("head_only")
    assert driver._overrides.body_sway_strategy == "head_only"


@pytest.mark.asyncio
async def test_speech_driver_caps_and_releases_mouth(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)

    open_out = 0.0
    for step in range(20):
        open_out = driver.tick(step * 0.02)[MOUTH_PARAM]
    assert open_out < 1.0
    assert open_out <= MOUTH_MAX_OPEN

    closed_out = driver.tick(0.5)[MOUTH_PARAM]
    assert closed_out == pytest.approx(open_out * (1.0 - MOUTH_RELEASE_ALPHA))


@pytest.mark.asyncio
async def test_speech_driver_damps_fast_rms_swings_for_gpt_sovits(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[0.0, 1.0, 0.0, 1.0, 0.0, 1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path)

    outputs = [driver.tick(step * 0.01)[MOUTH_PARAM] for step in range(10)]

    deltas = [abs(curr - prev) for prev, curr in zip(outputs, outputs[1:])]
    assert max(deltas) < 0.16
    assert max(outputs) - min(outputs) > 0.08
