"""Default body-motion plugin package."""

from __future__ import annotations

from collections.abc import AsyncIterator

from contracts import ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.api import BodyMotionPlugin


class DefaultPlugin(BodyMotionPlugin):
    def __init__(self) -> None:
        self.capabilities: RigCapabilities | None = None
        self.overrides: AvatarOverrides | None = None
        self._active_action: str | None = None

    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        self.capabilities = capabilities
        self.overrides = overrides

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        if False:
            yield ParamFrame()
        return

    def on_unload(self) -> None:
        self.capabilities = None
        self.overrides = None
        self._active_action = None
