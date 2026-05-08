import asyncio
import inspect
import json

import pytest

from contracts import ParamFrame
from sidecar.vts import PyvtsSafeWriter, connect_and_authenticate
import sidecar.vts.pyvts_writer as pyvts_writer
from sidecar.vts.parameter_writer import PyVTSParameterWriter


@pytest.mark.asyncio
async def test_concurrent_gather_does_not_deadlock(fake_pyvts_client):
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await writer.connect()

    try:
        requests = [
            fake_pyvts_client.vts_request.requestParameterValue(f"Param{i}")
            for i in range(10)
        ]
        responses = await asyncio.gather(*(writer.request(msg) for msg in requests))
    finally:
        await writer.close()

    assert len(responses) == 10
    assert len({response["requestID"] for response in responses}) == 10
    assert len(fake_pyvts_client.websocket._outbound) == 10


@pytest.mark.asyncio
async def test_inject_params_batches_add_and_per_param_set(fake_pyvts_client):
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await writer.connect()

    frame = ParamFrame(
        add_params={"ParamAngleX": 0.5, "ParamAngleY": -0.25},
        set_params={"ParamMouthOpenY": (0.9, 1.0), "ParamBrowLY": (0.1, 0.3)},
        tick_n=4,
        emitted_at_monotonic=1.5,
    )

    try:
        await writer.inject_params(frame)
    finally:
        await writer.close()

    assert len(fake_pyvts_client.websocket._outbound) == 3
    assert "InjectParameterDataRequest" in fake_pyvts_client.websocket._outbound[0]
    assert "ParamMouthOpenY" in fake_pyvts_client.websocket._outbound[1]
    assert "ParamBrowLY" in fake_pyvts_client.websocket._outbound[2]


@pytest.mark.asyncio
async def test_inject_params_disables_missing_set_param_after_first_vts_error(fake_pyvts_client):
    original_send = fake_pyvts_client.websocket.send

    async def send_with_missing_param(payload: str) -> None:
        request = json.loads(payload)
        if (
            request["messageType"] == "InjectParameterDataRequest"
            and request.get("data", {}).get("mode") == "set"
            and request.get("data", {}).get("parameterValues", [{}])[0].get("id") == "Paramchibi"
        ):
            fake_pyvts_client.websocket._outbound.append(payload)
            await fake_pyvts_client.websocket._responses.put(
                json.dumps(
                    {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": request["requestID"],
                        "messageType": "APIError",
                        "data": {
                            "errorID": 453,
                            "message": "Parameter Paramchibi not found. Did you create it yet?",
                        },
                    }
                )
            )
            return
        await original_send(payload)

    fake_pyvts_client.websocket.send = send_with_missing_param
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await writer.connect()

    frame = ParamFrame(
        set_params={"Paramchibi": (1.0, 0.8), "ParamJoy": (1.0, 0.8)},
        tick_n=4,
        emitted_at_monotonic=1.5,
    )

    try:
        await writer.inject_params(frame)
        await writer.inject_params(frame)
    finally:
        await writer.close()

    sent_payloads = [json.loads(payload) for payload in fake_pyvts_client.websocket._outbound]
    sent_params = [
        payload["data"]["parameterValues"][0]["id"]
        for payload in sent_payloads
        if payload["messageType"] == "InjectParameterDataRequest"
        and payload.get("data", {}).get("mode") == "set"
    ]
    assert sent_params.count("Paramchibi") == 1
    assert sent_params.count("ParamJoy") == 2


@pytest.mark.asyncio
async def test_inject_params_disables_missing_add_param_and_retries_batch(fake_pyvts_client):
    original_send = fake_pyvts_client.websocket.send

    async def send_with_missing_add_param(payload: str) -> None:
        request = json.loads(payload)
        values = request.get("data", {}).get("parameterValues", [])
        ids = [entry.get("id") for entry in values]
        if (
            request["messageType"] == "InjectParameterDataRequest"
            and request.get("data", {}).get("mode") == "add"
            and "Lean Forward" in ids
        ):
            fake_pyvts_client.websocket._outbound.append(payload)
            await fake_pyvts_client.websocket._responses.put(
                json.dumps(
                    {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": request["requestID"],
                        "messageType": "APIError",
                        "data": {
                            "errorID": 453,
                            "message": "Parameter Lean Forward not found. Did you create it yet?",
                        },
                    }
                )
            )
            return
        await original_send(payload)

    fake_pyvts_client.websocket.send = send_with_missing_add_param
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await writer.connect()

    frame = ParamFrame(
        add_params={"FaceAngleZ": 0.1, "Lean Forward": 0.2},
        tick_n=4,
        emitted_at_monotonic=1.5,
    )

    try:
        await writer.inject_params(frame)
        await writer.inject_params(frame)
    finally:
        await writer.close()

    sent_payloads = [json.loads(payload) for payload in fake_pyvts_client.websocket._outbound]
    add_batches = [
        [entry["id"] for entry in payload["data"]["parameterValues"]]
        for payload in sent_payloads
        if payload["messageType"] == "InjectParameterDataRequest"
        and payload.get("data", {}).get("mode") == "add"
    ]
    assert add_batches == [
        ["FaceAngleZ", "Lean Forward"],
        ["FaceAngleZ"],
        ["FaceAngleZ"],
    ]


def test_recv_loop_is_only_recv_caller():
    source = inspect.getsource(PyvtsSafeWriter)
    assert source.count("websocket.recv") == 1
    assert "async def _recv_loop" in source


def test_default_safe_writer_uses_distinct_compositor_vts_identity(monkeypatch):
    clients = []

    class FakeClient:
        vts_request = object()

        def __init__(self, **kwargs):
            self.kwargs = kwargs
            clients.append(self)

    monkeypatch.setattr(pyvts_writer.pyvts, "vts", lambda **kwargs: FakeClient(**kwargs))

    PyvtsSafeWriter()

    plugin_info = clients[0].kwargs["plugin_info"]
    assert plugin_info["plugin_name"] == "AgenticLLMVTuber Phase4 Safe Writer"
    assert plugin_info["authentication_token_path"].endswith(".vts_token.txt")


def test_mouth_writer_uses_distinct_vts_identity_and_token(monkeypatch):
    clients = []

    class FakeClient:
        vts_request = object()

        def __init__(self, **kwargs):
            self.kwargs = kwargs
            clients.append(self)

    monkeypatch.setattr(pyvts_writer.pyvts, "vts", lambda **kwargs: FakeClient(**kwargs))

    PyVTSParameterWriter()

    plugin_info = clients[0].kwargs["plugin_info"]
    assert plugin_info["plugin_name"] == "AgenticLLMVTuber Phase3 Mouth Driver"
    assert plugin_info["authentication_token_path"].endswith(".vts_token.txt")


@pytest.mark.asyncio
async def test_mouth_writer_authenticates_through_safe_handshake(monkeypatch, fake_pyvts_client):
    monkeypatch.setattr(pyvts_writer.pyvts, "vts", lambda **kwargs: fake_pyvts_client)
    writer = PyVTSParameterWriter()

    await writer.connect_and_authenticate()

    await writer.close()
    assert fake_pyvts_client.connect_calls == 1
    assert fake_pyvts_client.token_requests == 0
    assert fake_pyvts_client.authenticate_requests == 0
    assert fake_pyvts_client.read_token_calls == 1
    assert len(fake_pyvts_client.websocket._outbound) == 1
    assert "AuthenticationRequest" in fake_pyvts_client.websocket._outbound[0]


@pytest.mark.asyncio
async def test_handshake_uses_background_safe_writer(fake_pyvts_client):
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await connect_and_authenticate(writer)

    await writer.close()

    assert fake_pyvts_client.connect_calls == 1
    assert fake_pyvts_client.token_requests == 0
    assert fake_pyvts_client.authenticate_requests == 0
    assert fake_pyvts_client.read_token_calls == 1
    assert len(fake_pyvts_client.websocket._outbound) == 1
    assert "AuthenticationRequest" in fake_pyvts_client.websocket._outbound[-1]


@pytest.mark.asyncio
async def test_handshake_requests_token_through_safe_writer_when_missing(fake_pyvts_client):
    fake_pyvts_client.authentic_token = ""
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await connect_and_authenticate(writer)

    await writer.close()

    assert fake_pyvts_client.token_requests == 0
    assert fake_pyvts_client.authenticate_requests == 0
    assert fake_pyvts_client.write_token_calls == 1
    assert len(fake_pyvts_client.websocket._outbound) == 2
    assert "AuthenticationTokenRequest" in fake_pyvts_client.websocket._outbound[0]
    assert "AuthenticationRequest" in fake_pyvts_client.websocket._outbound[1]


@pytest.mark.asyncio
async def test_handshake_refreshes_rejected_existing_token(fake_pyvts_client):
    fake_pyvts_client.websocket.auth_response_results.clear()
    fake_pyvts_client.websocket.auth_response_results.extend([False, True])
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await connect_and_authenticate(writer)

    await writer.close()

    assert fake_pyvts_client.write_token_calls == 1
    assert len(fake_pyvts_client.websocket._outbound) == 3
    assert "AuthenticationRequest" in fake_pyvts_client.websocket._outbound[0]
    assert "AuthenticationTokenRequest" in fake_pyvts_client.websocket._outbound[1]
    assert "AuthenticationRequest" in fake_pyvts_client.websocket._outbound[2]
