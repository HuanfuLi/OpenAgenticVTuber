from __future__ import annotations

import asyncio

import pytest

from contracts import ActionCode, ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.api import BodyMotionPlugin
from sidecar.plugins.supervisor import NullPlugin, PluginSupervisor


class _GoodPlugin(BodyMotionPlugin):
    def __init__(self) -> None:
        self.loaded = False
        self.unloaded = False
        self.actions: list[ActionCode] = []

    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        self.loaded = True

    async def on_token_stream(self, sentence: str):
        yield ParamFrame(add_params={"FaceAngleX": 0.25})

    def on_action_code(self, action: ActionCode) -> None:
        self.actions.append(action)

    def on_unload(self) -> None:
        self.unloaded = True


class _LoadFailPlugin(_GoodPlugin):
    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        raise RuntimeError("load failed")


class _SlowLoadPlugin(_GoodPlugin):
    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        import time

        time.sleep(0.05)


class _FailingStreamPlugin(_GoodPlugin):
    async def on_token_stream(self, sentence: str):
        raise RuntimeError("stream failed")
        yield ParamFrame()


@pytest.mark.asyncio
async def test_load_or_null_falls_back_on_load_failure() -> None:
    supervisor = await PluginSupervisor.load_or_null(
        _LoadFailPlugin(),
        RigCapabilities(),
        AvatarOverrides(),
    )

    assert isinstance(supervisor.plugin, NullPlugin)
    assert [frame async for frame in supervisor.on_token_stream("hi")] == [ParamFrame()]
    assert supervisor.runtime_status()["lifecycleState"] == "load failed"
    assert supervisor.runtime_status()["fallbackActive"] is True


@pytest.mark.asyncio
async def test_load_or_null_applies_timeout() -> None:
    supervisor = await PluginSupervisor.load_or_null(
        _SlowLoadPlugin(),
        RigCapabilities(),
        AvatarOverrides(),
        load_timeout_seconds=0.001,
    )

    assert isinstance(supervisor.plugin, NullPlugin)


@pytest.mark.asyncio
async def test_generator_failure_circuit_breaker_opens_after_three_failures() -> None:
    supervisor = await PluginSupervisor.load_or_null(
        _FailingStreamPlugin(),
        RigCapabilities(),
        AvatarOverrides(),
    )

    for _ in range(PluginSupervisor.MAX_FAILURES):
        assert [frame async for frame in supervisor.on_token_stream("hi")] == []

    assert supervisor.circuit_open is True
    assert [frame async for frame in supervisor.on_token_stream("hi")] == []
    assert supervisor.runtime_status()["lifecycleState"] == "circuit open"


@pytest.mark.asyncio
async def test_load_or_null_preserves_selected_plugin_when_manifest_invalid() -> None:
    supervisor = await PluginSupervisor.load_or_null(
        NullPlugin(),
        RigCapabilities(),
        AvatarOverrides(),
        selected_plugin_name="broken",
        failure_state="invalid manifest",
        failure_summary="Selected plugin is invalid.",
        failure_details="missing api_version",
    )

    status = supervisor.runtime_status()

    assert status["selectedPlugin"] == "broken"
    assert status["loadedPlugin"] is None
    assert status["lifecycleState"] == "invalid manifest"
    assert status["fallbackActive"] is True
    assert status["chatAvailable"] is True


@pytest.mark.asyncio
async def test_close_calls_unload_and_tolerates_exceptions() -> None:
    plugin = _GoodPlugin()
    supervisor = await PluginSupervisor.load_or_null(
        plugin,
        RigCapabilities(),
        AvatarOverrides(),
    )

    await supervisor.close()

    assert plugin.unloaded is True


@pytest.mark.asyncio
async def test_action_code_delegates_to_wrapped_plugin() -> None:
    plugin = _GoodPlugin()
    supervisor = await PluginSupervisor.load_or_null(
        plugin,
        RigCapabilities(),
        AvatarOverrides(),
    )

    supervisor.on_action_code(ActionCode(name="smirk"))

    assert plugin.actions == [ActionCode(name="smirk")]
