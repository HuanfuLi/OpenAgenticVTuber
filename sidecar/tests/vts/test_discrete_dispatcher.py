import asyncio

import pytest

from sidecar.avatar.overrides import DiscoveredHotkey, TetoOverrides
from sidecar.vts.discrete_dispatcher import DiscreteDispatcher
from sidecar.vts.pyvts_writer import PyvtsSafeWriter


@pytest.fixture
async def writer_with_dispatcher(fake_pyvts_client):
    writer = PyvtsSafeWriter(client=fake_pyvts_client)
    await writer.connect()
    yield writer, DiscreteDispatcher(writer)
    await writer.close()


@pytest.mark.asyncio
async def test_fire_by_id_sends_hotkey_trigger_request(
    writer_with_dispatcher, fake_pyvts_client
):
    writer, dispatcher = writer_with_dispatcher
    sent_before = len(fake_pyvts_client.websocket._outbound)
    await dispatcher.fire(
        hotkey_id="cafeda105c574052a6f09fac80c00fff",
        name="【SV】Microphone[1]",
    )
    sent_after = len(fake_pyvts_client.websocket._outbound)
    assert sent_after - sent_before == 1
    last_sent = fake_pyvts_client.websocket._outbound[-1]
    assert "HotkeyTriggerRequest" in last_sent
    assert "cafeda105c574052a6f09fac80c00fff" in last_sent


@pytest.mark.asyncio
async def test_fire_by_name_resolves_via_overrides(
    writer_with_dispatcher, fake_pyvts_client
):
    writer, dispatcher = writer_with_dispatcher
    overrides = TetoOverrides(
        discovered_hotkeys=[
            DiscoveredHotkey(
                hotkey_id="hid-7",
                name="Star Eye [7]",
                type="ToggleExpression",
                file="Star Eye.exp3.json",
                is_meta=False,
                llm_emittable=True,
            ),
            DiscoveredHotkey(
                hotkey_id="hid-meta",
                name="Remove All Toggles",
                type="RemoveAllExpressions",
                file="",
                is_meta=True,
                llm_emittable=False,
            ),
        ]
    )
    sent_before = len(fake_pyvts_client.websocket._outbound)
    await dispatcher.fire_by_name("Star Eye [7]", overrides)
    sent_after = len(fake_pyvts_client.websocket._outbound)
    assert sent_after - sent_before == 1
    assert "hid-7" in fake_pyvts_client.websocket._outbound[-1]


@pytest.mark.asyncio
async def test_fire_by_name_refuses_meta_hotkeys(writer_with_dispatcher):
    writer, dispatcher = writer_with_dispatcher
    overrides = TetoOverrides(
        discovered_hotkeys=[
            DiscoveredHotkey(
                hotkey_id="hid-meta",
                name="Remove All Toggles",
                type="RemoveAllExpressions",
                file="",
                is_meta=True,
                llm_emittable=False,
            )
        ]
    )
    with pytest.raises(ValueError, match="is_meta"):
        await dispatcher.fire_by_name("Remove All Toggles", overrides)


@pytest.mark.asyncio
async def test_fire_by_name_unknown_raises(writer_with_dispatcher):
    writer, dispatcher = writer_with_dispatcher
    overrides = TetoOverrides(discovered_hotkeys=[])
    with pytest.raises(ValueError, match="not found"):
        await dispatcher.fire_by_name("Nonexistent Hotkey", overrides)
