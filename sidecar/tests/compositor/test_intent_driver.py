import asyncio

import pytest

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities, Expression
from sidecar.avatar.overrides import DiscoveredHotkey, TetoOverrides
from sidecar.compositor.intent_driver import IntentDriver, RAMP_OUT_MS


@pytest.mark.asyncio
async def test_intent_triggers_matching_hotkey(monkeypatch):
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    await intent_queue.put(
        ActionIntent(kind="expression", name="chibi", strength=1.0, avatar_id="teto")
    )
    tasks = []

    class _Writer:
        class _Request:
            def requestTriggerHotKey(self, hotkey_id):
                return {"messageType": "HotkeyTriggerRequest", "data": {"hotkeyID": hotkey_id}}

        vts_request = _Request()

        async def request(self, request):
            tasks.append(request)

    driver = IntentDriver(
        intent_queue,
        done_queue,
        writer=_Writer(),
        capabilities=AvatarCapabilities(
            expressions=[Expression(name="chibi", file="chibi.exp3.json")]
        ),
        overrides=TetoOverrides(
            discovered_hotkeys=[
                DiscoveredHotkey(
                    hotkey_id="hid-chibi",
                    name="【Chibi】[Q]",
                    type="ToggleExpression",
                    file="chibi.exp3.json",
                )
            ]
        ),
    )

    assert driver.tick(0.0) == {}
    await asyncio.sleep(0)
    assert tasks[0]["data"]["hotkeyID"] == "hid-chibi"


@pytest.mark.asyncio
async def test_sentence_complete_toggles_expression_off():
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    await intent_queue.put(
        ActionIntent(kind="expression", name="chibi", strength=1.0, avatar_id="teto")
    )
    tasks = []

    class _Writer:
        class _Request:
            def requestTriggerHotKey(self, hotkey_id):
                return {"messageType": "HotkeyTriggerRequest", "data": {"hotkeyID": hotkey_id}}

        vts_request = _Request()

        async def request(self, request):
            tasks.append(request)

    driver = IntentDriver(
        intent_queue,
        done_queue,
        writer=_Writer(),
        capabilities=AvatarCapabilities(
            expressions=[Expression(name="chibi", file="chibi.exp3.json")]
        ),
        overrides=TetoOverrides(
            discovered_hotkeys=[
                DiscoveredHotkey(
                    hotkey_id="hid-chibi",
                    name="【Chibi】[Q]",
                    type="ToggleExpression",
                    file="chibi.exp3.json",
                )
            ]
        ),
    )
    driver.tick(1.0)
    await asyncio.sleep(0)
    await done_queue.put(1)

    assert driver.tick(2.0) == {}
    await asyncio.sleep(0)
    assert [task["data"]["hotkeyID"] for task in tasks] == ["hid-chibi", "hid-chibi"]

    driver.tick(2.0 + (RAMP_OUT_MS / 1000.0))
    assert "chibi" not in driver._active
