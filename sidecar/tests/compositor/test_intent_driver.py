import asyncio

import pytest

from contracts import ActionIntent
from sidecar.compositor.intent_driver import IntentDriver, RAMP_IN_MS, RAMP_OUT_MS


@pytest.mark.asyncio
async def test_intent_ramps_in_with_cubic_weight():
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    await intent_queue.put(
        ActionIntent(kind="expression", name="joy", strength=1.0, avatar_id="teto")
    )
    driver = IntentDriver(intent_queue, done_queue)

    out = driver.tick(0.0)
    assert out["ParamFacejoy"][1] == pytest.approx(0.0)

    out = driver.tick((RAMP_IN_MS / 2.0) / 1000.0)
    assert out["ParamFacejoy"][1] == pytest.approx(0.875)


@pytest.mark.asyncio
async def test_sentence_complete_starts_600ms_decay():
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    await intent_queue.put(
        ActionIntent(kind="expression", name="joy", strength=1.0, avatar_id="teto")
    )
    driver = IntentDriver(intent_queue, done_queue)
    driver.tick(1.0)
    await done_queue.put(1)

    out = driver.tick(2.0)
    assert out["ParamFacejoy"][1] == pytest.approx(1.0)

    out = driver.tick(2.0 + (RAMP_OUT_MS / 2.0) / 1000.0)
    assert out["ParamFacejoy"][1] == pytest.approx(0.125)
