import asyncio

import pytest
from pyvts import vts_request

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities, Expression
from sidecar.compositor.intent_driver import IntentDriver, RAMP_IN_MS, RAMP_OUT_MS


class _RecordingWriter:
    def __init__(self) -> None:
        self.vts_request = vts_request.VTSRequest(
            developer="AgenticLLMVTuber",
            plugin_name="IntentDriver Test",
        )
        self.requests: list[dict] = []

    async def request(self, msg: dict) -> dict:
        self.requests.append(msg)
        return {
            "apiName": "VTubeStudioPublicAPI",
            "apiVersion": "1.0",
            "requestID": msg["requestID"],
            "messageType": msg["messageType"].replace("Request", "Response"),
            "data": {},
        }


def _driver(intent_queue, done_queue, writer):
    return IntentDriver(
        intent_queue,
        done_queue,
        writer=writer,
        capabilities=AvatarCapabilities(
            expressions=[Expression(name="joy", file="Love.exp3.json")]
        ),
    )


@pytest.mark.asyncio
async def test_expression_intent_activates_vts_expression_with_fade_time():
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    writer = _RecordingWriter()
    intent_queue.put_nowait(
        ActionIntent(kind="expression", name="joy", strength=0.8, avatar_id="teto")
    )
    driver = _driver(intent_queue, done_queue, writer)

    assert driver.tick(0.0) == {}
    await asyncio.sleep(0)

    assert len(writer.requests) == 1
    request = writer.requests[0]
    assert request["messageType"] == "ExpressionActivationRequest"
    assert request["data"] == {
        "expressionFile": "Love.exp3.json",
        "fadeTime": RAMP_IN_MS / 1000.0,
        "active": True,
    }


@pytest.mark.asyncio
async def test_sentence_complete_deactivates_expression_with_ramp_out_fade():
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    writer = _RecordingWriter()
    intent_queue.put_nowait(
        ActionIntent(kind="expression", name="joy", strength=0.8, avatar_id="teto")
    )
    driver = _driver(intent_queue, done_queue, writer)

    driver.tick(0.0)
    await asyncio.sleep(0)
    done_queue.put_nowait(1)
    driver.tick(1.0)
    await asyncio.sleep(0)

    assert len(writer.requests) == 2
    request = writer.requests[1]
    assert request["messageType"] == "ExpressionActivationRequest"
    assert request["data"] == {
        "expressionFile": "Love.exp3.json",
        "fadeTime": RAMP_OUT_MS / 1000.0,
        "active": False,
    }
    assert driver.tick(1.0 + (RAMP_OUT_MS / 1000.0)) == {}


@pytest.mark.asyncio
async def test_expression_intents_never_inject_raw_exp3_params_or_hotkeys():
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    writer = _RecordingWriter()
    intent_queue.put_nowait(
        ActionIntent(kind="expression", name="joy", strength=0.8, avatar_id="teto")
    )
    driver = _driver(intent_queue, done_queue, writer)

    driver.tick(0.0)
    await asyncio.sleep(0)
    done_queue.put_nowait(1)
    driver.tick(0.3)
    await asyncio.sleep(0)

    message_types = [request["messageType"] for request in writer.requests]
    assert message_types == [
        "ExpressionActivationRequest",
        "ExpressionActivationRequest",
    ]
    assert "HotkeyTriggerRequest" not in message_types
    assert "InjectParameterDataRequest" not in message_types
