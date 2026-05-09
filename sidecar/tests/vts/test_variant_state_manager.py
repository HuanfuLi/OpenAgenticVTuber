import pytest

from contracts import VariantToggle
from sidecar.vts.variant_state_manager import VariantStateManager


class FakeDispatcher:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, bool]] = []

    async def fire(
        self, hotkey_id: str, name: str = "", force: bool = False
    ) -> dict:
        self.calls.append((hotkey_id, name, force))
        return {"ok": True}


@pytest.mark.asyncio
async def test_reset_to_baseline_fires_reset_hotkey_and_clears_state():
    dispatcher = FakeDispatcher()
    manager = VariantStateManager(dispatcher, reset_hotkey_id="remove-all")

    await manager.apply(VariantToggle(name="hold-mic", hotkey_id="hk-a"))
    await manager.reset_to_baseline()

    assert manager.current_hotkey_id is None
    assert dispatcher.calls == [
        ("hk-a", "hold-mic", False),
        ("remove-all", "RemoveAllExpressions", True),
    ]


@pytest.mark.asyncio
async def test_apply_variant_fires_hotkey_and_sets_current_state():
    dispatcher = FakeDispatcher()
    manager = VariantStateManager(dispatcher)

    await manager.apply(VariantToggle(name="hold-mic", hotkey_id="hk-a"))

    assert manager.current_hotkey_id == "hk-a"
    assert dispatcher.calls == [("hk-a", "hold-mic", False)]


@pytest.mark.asyncio
async def test_reapplying_same_variant_is_no_op():
    dispatcher = FakeDispatcher()
    manager = VariantStateManager(dispatcher)
    toggle = VariantToggle(name="hold-mic", hotkey_id="hk-a")

    await manager.apply(toggle)
    await manager.apply(toggle)

    assert manager.current_hotkey_id == "hk-a"
    assert dispatcher.calls == [("hk-a", "hold-mic", False)]


@pytest.mark.asyncio
async def test_applying_different_variant_fires_old_hotkey_then_new_hotkey():
    dispatcher = FakeDispatcher()
    manager = VariantStateManager(dispatcher)

    await manager.apply(VariantToggle(name="hold-mic", hotkey_id="hk-a"))
    await manager.apply(VariantToggle(name="heart-eye", hotkey_id="hk-b"))

    assert manager.current_hotkey_id == "hk-b"
    assert dispatcher.calls == [
        ("hk-a", "hold-mic", False),
        ("hk-a", "", False),
        ("hk-b", "heart-eye", False),
    ]
