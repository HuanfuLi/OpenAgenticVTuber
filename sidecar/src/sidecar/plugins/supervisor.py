from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import AsyncIterator
from contextlib import suppress

from loguru import logger

from contracts import ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.api import BodyMotionPlugin


class NullPlugin(BodyMotionPlugin):
    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        return None

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        yield ParamFrame()


class PluginSupervisor(BodyMotionPlugin):
    ON_LOAD_TIMEOUT_SECONDS = 5.0
    FAILURE_WINDOW_SECONDS = 60.0
    MAX_FAILURES = 3

    def __init__(self, plugin: BodyMotionPlugin) -> None:
        self.plugin = plugin
        self._failure_times: deque[float] = deque()
        self._circuit_open = False

    @property
    def circuit_open(self) -> bool:
        return self._circuit_open

    @classmethod
    async def load_or_null(
        cls,
        plugin: BodyMotionPlugin,
        capabilities: RigCapabilities,
        overrides: AvatarOverrides,
        *,
        load_timeout_seconds: float | None = None,
    ) -> "PluginSupervisor":
        timeout = load_timeout_seconds or cls.ON_LOAD_TIMEOUT_SECONDS
        try:
            await asyncio.wait_for(
                asyncio.to_thread(plugin.on_load, capabilities, overrides),
                timeout=timeout,
            )
            return cls(plugin)
        except Exception as exc:  # noqa: BLE001 - plugin load must not crash boot
            logger.warning("[PLUGIN] load failed; falling back to NullPlugin: {!r}", exc)
            return cls(NullPlugin())

    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        return None

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        if self._circuit_open:
            return
        try:
            async for frame in self.plugin.on_token_stream(sentence):
                yield frame
        except Exception as exc:  # noqa: BLE001 - isolate plugin stream failures
            logger.warning("[PLUGIN] token stream failed: {!r}", exc)
            self._record_failure()

    def _record_failure(self) -> None:
        now = asyncio.get_running_loop().time()
        self._failure_times.append(now)
        while self._failure_times and now - self._failure_times[0] > self.FAILURE_WINDOW_SECONDS:
            self._failure_times.popleft()
        if len(self._failure_times) >= self.MAX_FAILURES:
            self._circuit_open = True
            logger.error("[PLUGIN] circuit breaker opened after repeated stream failures")

    async def close(self) -> None:
        with suppress(Exception):
            await asyncio.to_thread(self.plugin.on_unload)
