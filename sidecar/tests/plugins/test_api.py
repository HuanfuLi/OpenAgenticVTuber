from __future__ import annotations

from collections.abc import AsyncIterator

from contracts import ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts import ActionCode
from contracts.rig_capabilities import RigCapabilities

from sidecar.plugins import ApiVersion, BodyMotionPlugin


def test_body_motion_plugin_requires_lifecycle_hooks() -> None:
    abstract_methods = BodyMotionPlugin.__abstractmethods__

    assert "on_load" in abstract_methods
    assert "on_token_stream" in abstract_methods


def test_concrete_body_motion_plugin_can_instantiate() -> None:
    class FakePlugin(BodyMotionPlugin):
        def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
            return None

        async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
            yield ParamFrame()

    plugin = FakePlugin()

    assert plugin.api_version is ApiVersion.V1


def test_api_version_v1_value() -> None:
    assert ApiVersion.V1.value == "1.0"


def test_body_motion_plugin_has_optional_action_code_hook() -> None:
    class FakePlugin(BodyMotionPlugin):
        def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
            return None

        async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
            yield ParamFrame()

    plugin = FakePlugin()
    action = ActionCode(name="joy")

    assert plugin.on_action_code(action) is None
