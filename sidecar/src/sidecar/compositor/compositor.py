"""60Hz action compositor."""

from __future__ import annotations

import asyncio
from typing import Protocol

from loguru import logger

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities
from sidecar.avatar.overrides import BodySwayStrategyName
from sidecar.compositor.clamp import clamp_and_validate
from sidecar.compositor.hud_tap import HudTap
from sidecar.compositor.lock_filter import SYSTEM_PRIMITIVE_OVERRIDES

MOUTH_PARAM = "MouthOpen"


class TickDriver(Protocol):
    def tick(self, now: float) -> dict[str, float]: ...


class IntentTickDriver(Protocol):
    def tick(self, now: float) -> dict[str, tuple[float, float]]: ...


class PluginTickDriver(Protocol):
    def tick(self, now: float) -> ParamFrame: ...


class Compositor:
    """Deadline-driven 60Hz merge loop.

    Merge order is idle -> speech -> plugin -> cursor. Idle/speech/cursor write
    additive values except MouthOpen, which must be set to avoid over-opening
    when VTS blends it with face-tracking inputs. Plugin frames preserve their
    explicit add/set modes and are clamped before the VTS writer.
    """

    TICK_HZ = 60
    TICK_DT = 1.0 / 60.0
    FALL_BEHIND_THRESHOLD = 2

    def __init__(
        self,
        writer,
        idle_driver: TickDriver,
        speech_driver: TickDriver,
        plugin_driver: PluginTickDriver,
        capabilities: RigCapabilities,
        cursor_driver: TickDriver | None = None,
        lock_state: dict[str, float] | None = None,
        hud_tap: HudTap | None = None,
    ) -> None:
        self._writer = writer
        self._idle = idle_driver
        self._speech = speech_driver
        self._plugin = plugin_driver
        self._capabilities = capabilities
        self._cursor = cursor_driver
        self._lock_state = lock_state if lock_state is not None else {}
        self._hud_tap = hud_tap
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

        for key, value in self._idle.tick(now).items():
            add_acc[key] = add_acc.get(key, 0.0) + value

        for key, value in self._speech.tick(now).items():
            if key == MOUTH_PARAM:
                set_acc[key] = (value, 1.0)
            else:
                add_acc[key] = add_acc.get(key, 0.0) + value

        plugin_frame = self._plugin.tick(now)
        for key, value in plugin_frame.add_params.items():
            add_acc[key] = add_acc.get(key, 0.0) + value
        set_acc.update(plugin_frame.set_params)

        if self._cursor is not None:
            for key, value in self._cursor.tick(now).items():
                add_acc[key] = add_acc.get(key, 0.0) + value

        # Apply locks LAST in merge per ARCH-05. SYSTEM_PRIMITIVE_OVERRIDES guard is
        # defense-in-depth -- HUD already excludes those from the slider list (HUD-06).
        for param_id, locked_value in self._lock_state.items():
            if param_id in SYSTEM_PRIMITIVE_OVERRIDES:
                continue
            set_acc[param_id] = (locked_value, 1.0)
            add_acc.pop(param_id, None)

        frame = clamp_and_validate(ParamFrame(
            add_params=add_acc,
            set_params=set_acc,
            tick_n=self._tick_count,
            emitted_at_monotonic=now,
        ), self._capabilities)
        try:
            await self._writer.inject_params(frame)
        except Exception as exc:  # noqa: BLE001 - degraded until VTS handshake completes
            logger.warning(f"[COMPOSITOR] writer.inject_params failed: {exc!r}")

        # 15 Hz HUD tap -- every 4th 60 Hz tick.
        if self._hud_tap is not None and self._tick_count % 4 == 0:
            try:
                self._hud_tap.publish(frame, dict(self._lock_state))
            except Exception:  # noqa: BLE001 -- HUD must never crash compositor
                logger.exception("[HUD-TAP] publish failed")

    async def stop(self) -> None:
        self._stop = True
