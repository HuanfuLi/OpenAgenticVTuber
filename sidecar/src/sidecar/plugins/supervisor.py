from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Literal

from loguru import logger

from contracts import ActionCode, ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.api import BodyMotionPlugin

PluginLifecycleState = Literal[
    "active",
    "restart pending",
    "load failed",
    "fallback/null",
    "circuit open",
    "invalid manifest",
    "unknown/loading",
]


class NullPlugin(BodyMotionPlugin):
    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        return None

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        yield ParamFrame()


class PluginSupervisor(BodyMotionPlugin):
    ON_LOAD_TIMEOUT_SECONDS = 5.0
    FAILURE_WINDOW_SECONDS = 60.0
    MAX_FAILURES = 3

    def __init__(
        self,
        plugin: BodyMotionPlugin,
        *,
        selected_plugin_name: str = "default",
        loaded_plugin_name: str | None = None,
        lifecycle_state: PluginLifecycleState | None = None,
        summary: str | None = None,
        developer_details: str | None = None,
    ) -> None:
        self.plugin = plugin
        self._failure_times: deque[float] = deque()
        self._circuit_open = False
        self.selected_plugin_name = selected_plugin_name
        self.loaded_plugin_name = loaded_plugin_name
        self._lifecycle_state = lifecycle_state
        self._summary = summary
        self._developer_details = developer_details

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
        selected_plugin_name: str = "default",
        loaded_plugin_name: str | None = None,
        failure_state: PluginLifecycleState = "load failed",
        failure_summary: str | None = None,
        failure_details: str | None = None,
    ) -> "PluginSupervisor":
        if failure_details is not None:
            return cls(
                NullPlugin(),
                selected_plugin_name=selected_plugin_name,
                loaded_plugin_name=None,
                lifecycle_state=failure_state,
                summary=failure_summary or "Plugin could not load; using fallback/null motion.",
                developer_details=failure_details,
            )

        timeout = load_timeout_seconds or cls.ON_LOAD_TIMEOUT_SECONDS
        try:
            await asyncio.wait_for(
                asyncio.to_thread(plugin.on_load, capabilities, overrides),
                timeout=timeout,
            )
            return cls(
                plugin,
                selected_plugin_name=selected_plugin_name,
                loaded_plugin_name=loaded_plugin_name or selected_plugin_name,
                lifecycle_state="active",
                summary="Plugin active.",
            )
        except Exception as exc:  # noqa: BLE001 - plugin load must not crash boot
            logger.warning("[PLUGIN] load failed; falling back to NullPlugin: {!r}", exc)
            return cls(
                NullPlugin(),
                selected_plugin_name=selected_plugin_name,
                loaded_plugin_name=None,
                lifecycle_state="load failed",
                summary=failure_summary or "Plugin failed during on_load; using fallback/null motion.",
                developer_details=repr(exc),
            )

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

    def on_action_code(self, action: ActionCode) -> None:
        if self._circuit_open:
            return
        try:
            self.plugin.on_action_code(action)
        except Exception as exc:  # noqa: BLE001 - isolate plugin action failures
            logger.warning("[PLUGIN] action code failed: {!r}", exc)
            with suppress(RuntimeError):
                self._record_failure()

    def render_frame(self, now: float) -> ParamFrame:
        if self._circuit_open:
            return ParamFrame()

        render_frame = getattr(self.plugin, "render_frame", None)
        if not callable(render_frame):
            return ParamFrame()

        try:
            return render_frame(now)
        except Exception as exc:  # noqa: BLE001 - isolate plugin render failures
            logger.warning("[PLUGIN] render_frame failed: {!r}", exc)
            with suppress(RuntimeError):
                self._record_failure()
            return ParamFrame()

    def _record_failure(self) -> None:
        now = asyncio.get_running_loop().time()
        self._failure_times.append(now)
        while self._failure_times and now - self._failure_times[0] > self.FAILURE_WINDOW_SECONDS:
            self._failure_times.popleft()
        if len(self._failure_times) >= self.MAX_FAILURES:
            self._circuit_open = True
            logger.error("[PLUGIN] circuit breaker opened after repeated stream failures")

    def runtime_status(self) -> dict[str, object]:
        lifecycle = self._lifecycle_state
        summary = self._summary
        if self._circuit_open:
            lifecycle = "circuit open"
            summary = "Plugin circuit breaker opened after repeated runtime failures."
        elif lifecycle is None:
            lifecycle = "fallback/null" if isinstance(self.plugin, NullPlugin) else "active"
        if summary is None:
            summary = (
                "Fallback/null motion is active."
                if lifecycle == "fallback/null"
                else "Plugin active."
            )

        fallback_active = isinstance(self.plugin, NullPlugin) or lifecycle in {
            "load failed",
            "fallback/null",
            "invalid manifest",
            "circuit open",
        }
        return {
            "selectedPlugin": self.selected_plugin_name,
            "loadedPlugin": self.loaded_plugin_name,
            "lifecycleState": lifecycle,
            "summary": summary,
            "developerDetails": self._developer_details,
            "fallbackActive": fallback_active,
            "chatAvailable": True,
        }

    async def close(self) -> None:
        with suppress(Exception):
            await asyncio.to_thread(self.plugin.on_unload)
