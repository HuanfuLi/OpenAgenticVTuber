import asyncio

import pytest

from contracts import SpeechEnvelopePayload
from sidecar.avatar.overrides import TetoOverrides
from sidecar.compositor.speech_driver import EMA_ALPHA, MOUTH_PARAM, SpeechDriver


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
    assert out[MOUTH_PARAM] == pytest.approx(0.5)


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


def test_speech_driver_swap_strategy(tmp_path):
    driver = SpeechDriver(asyncio.Queue(), TetoOverrides(), tmp_path)
    driver.swap_strategy("proxy_param")
    assert driver._overrides.body_sway_strategy == "proxy_param"
