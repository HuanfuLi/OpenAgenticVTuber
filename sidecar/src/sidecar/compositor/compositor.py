"""60Hz action compositor."""

from __future__ import annotations

import asyncio
from typing import Protocol

from loguru import logger

from contracts import ParamFrame
from sidecar.avatar.overrides import BodySwayStrategyName


class TickDriver(Protocol):
    def tick(self, now: float) -> dict[str, float]: ...


class IntentTickDriver(Protocol):
    def tick(self, now: float) -> dict[str, tuple[float, float]]: ...


class Compositor:
    """Deadline-driven 60Hz merge loop.

    Merge order is idle -> speech -> intent -> cursor. Idle/speech/cursor write
    additive values; intent is isolated to set_params for AVT-03.
    """

    TICK_HZ = 60
    TICK_DT = 1.0 / 60.0
    FALL_BEHIND_THRESHOLD = 2

    def __init__(
        self,
        writer,
        idle_driver: TickDriver,
        speech_driver: TickDriver,
        intent_driver: IntentTickDriver,
        cursor_driver: TickDriver | None = None,
    ) -> None:
        self._writer = writer
        self._idle = idle_driver
        self._speech = speech_driver
        self._intent = intent_driver
        self._cursor = cursor_driver
        self._stop = False
        self._tick_count = 0
        self._dropped_frames = 0
        self._pending_strategy_swap: BodySwayStrategyName | None = None

    def request_strategy_swap(self, name: BodySwayStrategyName) -> None:
        self._pending_strategy_swap = name

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        start = loop.time()
        tick_n = 0
        while not self._stop:
            await self._tick(loop.time())
            tick_n += 1
            self._tick_count = tick_n
            target = start + tick_n * self.TICK_DT
            now = loop.time()
            if now > target + self.FALL_BEHIND_THRESHOLD * self.TICK_DT:
                self._dropped_frames += 1
                start = now
                tick_n = 0
                continue
            await asyncio.sleep(max(0.0, target - now))

    async def _tick(self, now: float) -> None:
        if self._pending_strategy_swap is not None:
            new_name = self._pending_strategy_swap
            self._pending_strategy_swap = None
            if hasattr(self._speech, "swap_strategy"):
                self._speech.swap_strategy(new_name)

        add_acc: dict[str, float] = {}
        set_acc: dict[str, tuple[float, float]] = {}

        for source in (self._idle.tick(now), self._speech.tick(now)):
            for key, value in source.items():
                add_acc[key] = add_acc.get(key, 0.0) + value

        for key, value_weight in self._intent.tick(now).items():
            set_acc[key] = value_weight

        if self._cursor is not None:
            for key, value in self._cursor.tick(now).items():
                add_acc[key] = add_acc.get(key, 0.0) + value

        frame = ParamFrame(
            add_params=add_acc,
            set_params=set_acc,
            tick_n=self._tick_count,
            emitted_at_monotonic=now,
        )
        try:
            await self._writer.inject_params(frame)
        except Exception as exc:  # noqa: BLE001 - degraded until VTS handshake completes
            logger.warning(f"[COMPOSITOR] writer.inject_params failed: {exc!r}")

    async def stop(self) -> None:
        self._stop = True
