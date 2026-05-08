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

    out = driver.tick(10.010)
    target = min(MOUTH_MAX_OPEN, (0.5 - MOUTH_NOISE_FLOOR) * MOUTH_GAIN)
    assert out[MOUTH_PARAM] == pytest.approx(target * MOUTH_ATTACK_ALPHA)


@pytest.mark.asyncio
async def test_speech_driver_applies_ema_to_body_strategy(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    overrides = TetoOverrides(body_sway_strategy="proxy_param", proxy_body_param="Lean Forward")
    driver = SpeechDriver(queue, overrides, tmp_path)

    out = driver.tick(0.0)
    assert out["Lean Forward"] == pytest.approx(EMA_ALPHA)


@pytest.mark.asyncio
async def test_speech_driver_logs_strategy_body_params_without_mouth(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    overrides = TetoOverrides(body_sway_strategy="proxy_param", proxy_body_param="Lean Forward")
    driver = SpeechDriver(queue, overrides, tmp_path)
    messages: list[str] = []
    sink_id = logger.add(messages.append, format="{message}")
    try:
        driver.tick(0.0)
    finally:
        logger.remove(sink_id)

    speech_logs = [message for message in messages if "[SPEECH-DRIVER]" in message]
    assert speech_logs
    assert "strategy=proxy_param" in speech_logs[0]
    assert "body_params=[Lean Forward=0.200]" in speech_logs[0]
    assert "MouthOpen=" not in speech_logs[0].split("body_params=[", 1)[1]


def test_speech_driver_swap_strategy(tmp_path):
    driver = SpeechDriver(asyncio.Queue(), TetoOverrides(), tmp_path)
    driver.swap_strategy("proxy_param")
    assert driver._overrides.body_sway_strategy == "proxy_param"


@pytest.mark.asyncio
async def test_speech_driver_can_disable_mouth_output_for_external_mouth_driver(tmp_path):
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[1.0],
            slice_length=20,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, TetoOverrides(), tmp_path, emit_mouth=False)

    out = driver.tick(0.0)

    assert MOUTH_PARAM not in out
    assert "FaceAngleZ" in out


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

    open_out = driver.tick(0.0)[MOUTH_PARAM]
    assert open_out < 1.0
    assert open_out == pytest.approx(MOUTH_MAX_OPEN * MOUTH_ATTACK_ALPHA)

    closed_out = driver.tick(0.1)[MOUTH_PARAM]
    assert closed_out == pytest.approx(open_out * (1.0 - MOUTH_RELEASE_ALPHA))
