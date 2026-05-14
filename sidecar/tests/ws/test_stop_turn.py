from __future__ import annotations

import pytest

from sidecar.ws.handlers import handle_stop_turn


class _FakeApp:
    def __init__(self, orchestrator) -> None:
        class _State:
            pass

        self._state = _State()
        self._state.orchestrator = orchestrator

    @property
    def state(self):
        return self._state


class _FakeWS:
    def __init__(self, orchestrator) -> None:
        self.app = _FakeApp(orchestrator)
        self.closed = False

    async def close(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_stop_turn_without_orchestrator_is_harmless() -> None:
    ws = _FakeWS(None)

    await handle_stop_turn(ws, {"type": "stop-turn"})

    assert ws.closed is False


@pytest.mark.asyncio
async def test_stop_turn_invokes_cancel_without_closing_socket() -> None:
    class _Orchestrator:
        def __init__(self) -> None:
            self.active_ws = None
            self.cancel_calls = 0

        def set_active_ws(self, ws) -> None:
            self.active_ws = ws

        async def cancel_active_turn(self) -> None:
            self.cancel_calls += 1

    orchestrator = _Orchestrator()
    ws = _FakeWS(orchestrator)

    await handle_stop_turn(ws, {"type": "stop-turn"})

    assert orchestrator.active_ws is ws
    assert orchestrator.cancel_calls == 1
    assert ws.closed is False
