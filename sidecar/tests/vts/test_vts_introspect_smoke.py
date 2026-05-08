import pytest

from scripts import vts_introspect_smoke


class FakeRequests:
    def BaseRequest(self, message_type):
        return {"messageType": message_type}

    def requestHotKeyList(self):
        return {"messageType": "HotkeyListRequest"}

    def requestTrackingParameterList(self):
        return {"messageType": "TrackingParameterListRequest"}


class FakeVtsClient:
    def __init__(self, plugin_info, auth_result):
        self.plugin_info = plugin_info
        self.auth_result = auth_result
        self.vts_request = FakeRequests()
        self.requests = []
        self.closed = False

    async def connect(self):
        return None

    async def request_authenticate_token(self):
        return {"data": {"authenticationToken": "token"}}

    async def request_authenticate(self):
        return self.auth_result

    async def request(self, payload):
        self.requests.append(payload)
        message_type = payload.get("messageType")
        if message_type == "HotkeyListRequest":
            return {"data": {"availableHotkeys": [{"name": "Joy", "type": "ToggleExpression", "hotkeyID": "h"}]}}
        if message_type == "TrackingParameterListRequest":
            return {"data": {"customParameters": [], "defaultParameters": [{"name": "ParamAngleX"}]}}
        return {"data": {}}

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_auth_rejection_fails_before_hotkey_list(monkeypatch, capsys):
    clients = []

    def fake_vts(plugin_info):
        client = FakeVtsClient(plugin_info, {"data": {"authenticated": False}})
        clients.append(client)
        return client

    monkeypatch.setattr(vts_introspect_smoke.pyvts, "vts", fake_vts)

    exit_code = await vts_introspect_smoke.main()

    assert exit_code == 2
    assert "HotkeyListRequest" not in [request.get("messageType") for request in clients[0].requests]
    assert clients[0].plugin_info["plugin_name"] == "AgenticLLMVTuber"
    assert str(vts_introspect_smoke.TOKEN_PATH) in capsys.readouterr().out


@pytest.mark.asyncio
async def test_false_auth_result_fails_before_authenticated_requests(monkeypatch):
    clients = []

    def fake_vts(plugin_info):
        client = FakeVtsClient(plugin_info, False)
        clients.append(client)
        return client

    monkeypatch.setattr(vts_introspect_smoke.pyvts, "vts", fake_vts)

    exit_code = await vts_introspect_smoke.main()

    assert exit_code == 2
    assert clients[0].requests == []


@pytest.mark.asyncio
async def test_connection_refused_remains_exit_3(monkeypatch, capsys):
    class RefusedClient(FakeVtsClient):
        async def connect(self):
            raise ConnectionRefusedError("refused")

    monkeypatch.setattr(
        vts_introspect_smoke.pyvts,
        "vts",
        lambda plugin_info: RefusedClient(plugin_info, {"data": {"authenticated": True}}),
    )

    exit_code = await vts_introspect_smoke.main()

    assert exit_code == 3
    assert "Is VTube Studio running?" in capsys.readouterr().out
