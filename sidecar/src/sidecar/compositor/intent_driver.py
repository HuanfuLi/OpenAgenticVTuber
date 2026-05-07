"""Expression intent driver for AVT-08."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities
from sidecar.avatar.overrides import TetoOverrides

from .easing import ease_out_cubic


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
        out: dict[str, tuple[float, float]] = {}
        expired: list[str] = []
        for name, intent in self._active.items():
            if intent.ending_at is None:
                weight = ease_out_cubic((now - intent.started_at) * 1000.0 / RAMP_IN_MS)
            else:
                elapsed = (now - intent.ending_at) * 1000.0
                weight = 1.0 - ease_out_cubic(elapsed / RAMP_OUT_MS)
                if elapsed >= RAMP_OUT_MS:
                    expired.append(name)
                    continue
            out[f"ParamFace{name}"] = (intent.strength, max(0.0, min(1.0, weight)))
        for name in expired:
            self._active.pop(name, None)
        return out

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
            for intent in self._active.values():
                if intent.ending_at is None:
                    intent.ending_at = now
