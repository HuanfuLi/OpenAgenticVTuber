"""Expression intent driver for AVT-08."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from loguru import logger

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities
from sidecar.avatar.overrides import DiscoveredHotkey, TetoOverrides

RAMP_IN_MS = 300.0
RAMP_OUT_MS = 600.0


@dataclass
class _ActiveIntent:
    name: str
    strength: float
    started_at: float
    ending_at: float | None = None


class IntentDriver:
    """Consumes expression intents and decays them on sentence-complete signals."""

    def __init__(
        self,
        intent_queue: asyncio.Queue[ActionIntent],
        sentence_complete_queue: asyncio.Queue[int],
        writer=None,
        capabilities: AvatarCapabilities | None = None,
        overrides: TetoOverrides | None = None,
    ) -> None:
        self._intent_queue = intent_queue
        self._sentence_complete_queue = sentence_complete_queue
        self._writer = writer
        self._capabilities = capabilities
        self._overrides = overrides
        self._active: dict[str, _ActiveIntent] = {}

    def tick(self, now: float) -> dict[str, tuple[float, float]]:
        self._drain_queues(now)
        expired: list[str] = []
        for name, intent in self._active.items():
            if intent.ending_at is not None:
                elapsed = (now - intent.ending_at) * 1000.0
                if elapsed >= RAMP_OUT_MS:
                    expired.append(name)
        for name in expired:
            self._active.pop(name, None)
        return {}

    def _drain_queues(self, now: float) -> None:
        while True:
            try:
                intent = self._intent_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            if intent.kind == "expression":
                self._active[intent.name] = _ActiveIntent(
                    name=intent.name,
                    strength=intent.strength,
                    started_at=now,
                )
                self._schedule_hotkey(intent.name, active=True)
            self._intent_queue.task_done()

        complete_seen = False
        while True:
            try:
                self._sentence_complete_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            complete_seen = True
            self._sentence_complete_queue.task_done()
        if complete_seen:
            for intent in list(self._active.values()):
                if intent.ending_at is None:
                    intent.ending_at = now
                    self._schedule_hotkey(intent.name, active=False)

    def _schedule_hotkey(self, intent_name: str, *, active: bool) -> None:
        if self._writer is None or self._overrides is None:
            return
        hotkey = self._resolve_hotkey(intent_name)
        if hotkey is None:
            logger.warning("[INTENT-HOTKEY] no hotkey found for expression={!r}", intent_name)
            return
        action = "on" if active else "off"
        logger.info(
            "[INTENT-HOTKEY] trigger expression={!r} action={} hotkey={!r}",
            intent_name,
            action,
            hotkey.name,
        )
        asyncio.create_task(self._fire_hotkey(hotkey))

    async def _fire_hotkey(self, hotkey: DiscoveredHotkey) -> None:
        try:
            request = self._writer.vts_request.requestTriggerHotKey(hotkey.hotkey_id)
            await self._writer.request(request)
        except Exception:
            logger.exception("[INTENT-HOTKEY] trigger failed hotkey={!r}", hotkey.name)

    def _resolve_hotkey(self, intent_name: str) -> DiscoveredHotkey | None:
        if self._overrides is None:
            return None
        desired_file = self._expression_file(intent_name)
        normalized_name = _normalize(intent_name)

        for hotkey in self._overrides.discovered_hotkeys:
            if hotkey.is_meta or not hotkey.llm_emittable:
                continue
            if desired_file and hotkey.file.casefold() == desired_file.casefold():
                return hotkey
            if normalized_name and normalized_name in _normalize(hotkey.name):
                return hotkey
        return None

    def _expression_file(self, intent_name: str) -> str | None:
        if self._capabilities is None:
            return None
        normalized_name = _normalize(intent_name)
        for expression in self._capabilities.expressions:
            if _normalize(expression.name) == normalized_name:
                return expression.file
        return None


def _normalize(value: str) -> str:
    return "".join(ch for ch in value.casefold() if ch.isalnum())
