"""Expression intent driver for AVT-08."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities

RAMP_IN_MS = 300.0
RAMP_OUT_MS = 600.0


@dataclass
class _ActiveIntent:
    name: str
    strength: float
    started_at: float
    expression_file: str
    ending_at: float | None = None


class IntentDriver:
    """Consumes expression intents and decays them on sentence-complete signals."""

    def __init__(
        self,
        intent_queue: asyncio.Queue[ActionIntent],
        sentence_complete_queue: asyncio.Queue[int],
        writer=None,
        capabilities: AvatarCapabilities | None = None,
        avatar_dir: Path | None = None,
    ) -> None:
        self._intent_queue = intent_queue
        self._sentence_complete_queue = sentence_complete_queue
        self._writer = writer
        self._capabilities = capabilities
        self._avatar_dir = avatar_dir
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
                normalized_name = _normalize(intent.name)
                expression_file = self._expression_file(intent.name)
                if expression_file is None:
                    logger.warning("[INTENT-EXPRESSION] unknown expression={!r}", intent.name)
                    self._intent_queue.task_done()
                    continue
                self._active[normalized_name] = _ActiveIntent(
                    name=intent.name,
                    strength=_clamp(intent.strength),
                    started_at=now,
                    expression_file=expression_file,
                )
                self._send_expression_activation(expression_file, active=True, fade_ms=RAMP_IN_MS)
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
                    self._send_expression_activation(
                        intent.expression_file,
                        active=False,
                        fade_ms=RAMP_OUT_MS,
                    )

    def _expression_file(self, intent_name: str) -> str | None:
        if self._capabilities is None:
            return None
        normalized_name = _normalize(intent_name)
        for expression in self._capabilities.expressions:
            if _normalize(expression.name) == normalized_name:
                return expression.file
        return None

    def _send_expression_activation(
        self, expression_file: str, *, active: bool, fade_ms: float
    ) -> None:
        if self._writer is None:
            return
        msg = self._writer.vts_request.requestExpressionActivation(
            expression_file=expression_file,
            active=active,
            fade_time=fade_ms / 1000.0,
        )
        try:
            task = asyncio.create_task(self._writer.request(msg))
        except RuntimeError:
            logger.warning(
                "[INTENT-EXPRESSION] no running loop for expression activation file={!r}",
                expression_file,
            )
            return
        task.add_done_callback(
            lambda done: logger.warning(
                "[INTENT-EXPRESSION] activation failed file={!r} active={}: {!r}",
                expression_file,
                active,
                done.exception(),
            )
            if done.exception() is not None
            else None
        )


def _normalize(value: str) -> str:
    return "".join(ch for ch in value.casefold() if ch.isalnum())


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))
