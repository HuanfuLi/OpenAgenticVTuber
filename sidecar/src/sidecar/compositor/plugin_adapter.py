from __future__ import annotations

import asyncio
from contextlib import suppress

from loguru import logger

from contracts import ParamFrame
from sidecar.plugins.api import BodyMotionPlugin


class PluginAdapter:
    STALE_AFTER_SECONDS = 1.0

    def __init__(self, plugin: BodyMotionPlugin) -> None:
        self._plugin = plugin
        self._latest_frame: ParamFrame | None = None
        self._latest_at: float | None = None
        self._tasks: set[asyncio.Task] = set()

    def submit_frame(self, frame: ParamFrame, now: float) -> None:
        self._latest_frame = frame
        self._latest_at = now

    def tick(self, now: float) -> ParamFrame:
        if self._latest_frame is None or self._latest_at is None:
            return ParamFrame()
        if now - self._latest_at > self.STALE_AFTER_SECONDS:
            return ParamFrame()
        return self._latest_frame.model_copy(
            update={"tick_n": self._latest_frame.tick_n, "emitted_at_monotonic": now}
        )

    def enqueue_sentence(self, sentence: str) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            logger.warning("[PLUGIN] dropping sentence because no event loop is running")
            return
        task = loop.create_task(self._consume(sentence))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _consume(self, sentence: str) -> None:
        loop = asyncio.get_running_loop()
        with suppress(Exception):
            async for frame in self._plugin.on_token_stream(sentence):
                self.submit_frame(frame, loop.time())
