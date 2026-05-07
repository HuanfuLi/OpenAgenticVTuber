"""Speech driver: Phase 3 lipsync consume + body-sway dispatch."""

from __future__ import annotations

import asyncio
from pathlib import Path

from contracts import SpeechEnvelopePayload
from sidecar.avatar.overrides import BodySwayStrategyName, TetoOverrides

from .body_sway import build_strategy


EMA_ALPHA = 0.2
MOUTH_PARAM = "MouthOpen"


class SpeechDriver:
    def __init__(
        self,
        speech_queue: asyncio.Queue[SpeechEnvelopePayload],
        overrides: TetoOverrides,
        avatar_dir: Path,
    ) -> None:
        self._speech_queue = speech_queue
        self._overrides = overrides
        self._avatar_dir = avatar_dir
        self._current: SpeechEnvelopePayload | None = None
        self._rms_smooth = 0.0
        self._strategy = build_strategy(overrides.body_sway_strategy, overrides, avatar_dir)

    def swap_strategy(self, name: BodySwayStrategyName) -> None:
        self._overrides.body_sway_strategy = name
        self._strategy = build_strategy(name, self._overrides, self._avatar_dir)

    def tick(self, now: float) -> dict[str, float]:
        self._drain_queue()
        rms = self._current_rms(now)
        self._rms_smooth = EMA_ALPHA * rms + (1.0 - EMA_ALPHA) * self._rms_smooth
        out = {MOUTH_PARAM: rms}
        out.update(self._strategy.tick(self._rms_smooth, now))
        return out

    def _drain_queue(self) -> None:
        while True:
            try:
                self._current = self._speech_queue.get_nowait()
                self._speech_queue.task_done()
            except asyncio.QueueEmpty:
                break

    def _current_rms(self, now: float) -> float:
        if self._current is None or not self._current.volumes:
            return 0.0
        elapsed_ms = max(0.0, (now - self._current.started_at) * 1000.0)
        idx = int(elapsed_ms // self._current.slice_length)
        if idx >= len(self._current.volumes):
            return 0.0
        frac = (elapsed_ms % self._current.slice_length) / self._current.slice_length
        current = self._current.volumes[idx]
        nxt = self._current.volumes[idx + 1] if idx + 1 < len(self._current.volumes) else current
        return current * (1.0 - frac) + nxt * frac
