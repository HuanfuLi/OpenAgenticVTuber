import asyncio
import json
from collections import deque

import pytest

from pyvts import vts_request


class FakeWebSocket:
    def __init__(self) -> None:
        self._outbound: list[str] = []
        self._responses: asyncio.Queue[str] = asyncio.Queue()
        self.closed = False
        self.auth_response_results = deque([True])

    async def send(self, payload: str) -> None:
        self._outbound.append(payload)
        request = json.loads(payload)
        response = {
            "apiName": request.get("apiName", "VTubeStudioPublicAPI"),
            "apiVersion": request.get("apiVersion", "1.0"),
            "requestID": request.get("requestID"),
            "messageType": request["messageType"].replace("Request", "Response"),
            "data": {
                "echoMessageType": request["messageType"],
                "parameterValues": request.get("data", {}).get("parameterValues", []),
                "authenticated": self._authenticated_for(request),
                "authenticationToken": "token-from-vts",
            },
        }
        await self._responses.put(json.dumps(response))

    def _authenticated_for(self, request: dict) -> bool:
        if request["messageType"] != "AuthenticationRequest":
            return True
        if self.auth_response_results:
            return self.auth_response_results.popleft()
        return True

    async def recv(self) -> str:
        return await self._responses.get()

    async def close(self, code: int = 1000, reason: str = "closed") -> None:
        self.closed = True


class FakePyvtsClient:
    def __init__(self) -> None:
        self.websocket = FakeWebSocket()
        self.vts_request = vts_request.VTSRequest(
            developer="AgenticLLMVTuber",
            plugin_name="Phase4 Test",
        )
        self.connect_calls = 0
        self.close_calls = 0
        self.authentic_token = "token"
        self.token_requests = 0
        self.authenticate_requests = 0
        self.auth_results = deque([True])
        self.read_token_calls = 0
        self.write_token_calls = 0

    async def connect(self) -> None:
        self.connect_calls += 1

    async def close(self) -> None:
        self.close_calls += 1
        await self.websocket.close()

    async def request_authenticate_token(self, force: bool = False) -> None:
        self.token_requests += 1

    async def request_authenticate(self) -> bool:
        self.authenticate_requests += 1
        return self.auth_results[0] if self.auth_results else True

    async def read_token(self) -> str:
        self.read_token_calls += 1
        return self.authentic_token

    async def write_token(self) -> None:
        self.write_token_calls += 1


@pytest.fixture
def fake_pyvts_client() -> FakePyvtsClient:
    return FakePyvtsClient()
