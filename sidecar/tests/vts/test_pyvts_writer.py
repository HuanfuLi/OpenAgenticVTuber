import asyncio
import inspect

import pytest

from contracts import ParamFrame
from sidecar.vts import PyvtsSafeWriter, connect_and_authenticate


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


def test_recv_loop_is_only_recv_caller():
    source = inspect.getsource(PyvtsSafeWriter)
    assert source.count("websocket.recv") == 1
    assert "async def _recv_loop" in source


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
