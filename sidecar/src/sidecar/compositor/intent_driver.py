"""Expression intent driver for AVT-08."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities
from sidecar.compositor.easing import ease_out_cubic

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
        avatar_dir: Path | None = None,
    ) -> None:
        self._intent_queue = intent_queue
        self._sentence_complete_queue = sentence_complete_queue
        self._writer = writer
        self._capabilities = capabilities
        self._avatar_dir = avatar_dir
        self._active: dict[str, _ActiveIntent] = {}
        self._expression_params: dict[str, list[tuple[str, float]]] = {}

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

        out: dict[str, tuple[float, float]] = {}
        for intent in self._active.values():
            params = self._params_for_expression(intent.name)
            if not params:
                continue
            weight = self._weight_for(intent, now)
            if weight <= 0.0 and intent.ending_at is not None:
                continue
            for param_id, value in params:
                out[param_id] = (value, weight)
        return out

    def _drain_queues(self, now: float) -> None:
        while True:
            try:
                intent = self._intent_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            if intent.kind == "expression":
                normalized_name = _normalize(intent.name)
                self._active[normalized_name] = _ActiveIntent(
                    name=intent.name,
                    strength=_clamp(intent.strength),
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
            for intent in list(self._active.values()):
                if intent.ending_at is None:
                    intent.ending_at = now

    def _params_for_expression(self, intent_name: str) -> list[tuple[str, float]]:
        normalized_name = _normalize(intent_name)
        if normalized_name in self._expression_params:
            return self._expression_params[normalized_name]

        expression_file = self._expression_file(intent_name)
        if expression_file is None:
            logger.warning("[INTENT-EXPRESSION] unknown expression={!r}", intent_name)
            self._expression_params[normalized_name] = []
            return []

        paths: list[Path] = []
        if self._avatar_dir is not None:
            paths.append(self._avatar_dir / "Expressions" / expression_file)
        paths.append(
            Path(__file__).resolve().parents[4]
            / "Live2D"
            / "重音テト"
            / "Expressions"
            / expression_file
        )

        exp3_path = next((path for path in paths if path.exists()), None)
        if exp3_path is None:
            logger.warning(
                "[INTENT-EXPRESSION] missing exp3 file expression={!r} file={!r}",
                intent_name,
                expression_file,
            )
            self._expression_params[normalized_name] = []
            return []

        raw = json.loads(exp3_path.read_text(encoding="utf-8"))
        params = [
            (entry["Id"], float(entry.get("Value", 0.0)))
            for entry in raw.get("Parameters", [])
            if entry.get("Id")
        ]
        self._expression_params[normalized_name] = params
        return params

    def _expression_file(self, intent_name: str) -> str | None:
        if self._capabilities is None:
            return None
        normalized_name = _normalize(intent_name)
        for expression in self._capabilities.expressions:
            if _normalize(expression.name) == normalized_name:
                return expression.file
        return None

    def _weight_for(self, intent: _ActiveIntent, now: float) -> float:
        strength = _clamp(intent.strength)
        if intent.ending_at is not None:
            elapsed_ms = max(0.0, (now - intent.ending_at) * 1000.0)
            return strength * (1.0 - ease_out_cubic(elapsed_ms / RAMP_OUT_MS))

        elapsed_ms = max(0.0, (now - intent.started_at) * 1000.0)
        return strength * ease_out_cubic(elapsed_ms / RAMP_IN_MS)


def _normalize(value: str) -> str:
    return "".join(ch for ch in value.casefold() if ch.isalnum())


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))
