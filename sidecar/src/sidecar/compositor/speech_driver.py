"""Speech driver: Phase 3 lipsync consume + body-sway dispatch."""

from __future__ import annotations

import asyncio
from pathlib import Path

from loguru import logger

from contracts import SpeechEnvelopePayload
from sidecar.avatar.overrides import BodySwayStrategyName, TetoOverrides

from .body_sway import build_strategy


EMA_ALPHA = 0.2
MOUTH_PARAM = "MouthOpen"
MOUTH_NOISE_FLOOR = 0.05
MOUTH_GAIN = 0.9
MOUTH_MAX_OPEN = 0.7
MOUTH_ATTACK_ALPHA = 0.55
MOUTH_RELEASE_ALPHA = 0.45


def _format_body_params(params: dict[str, float]) -> str:
    return ",".join(f"{key}={value:.3f}" for key, value in sorted(params.items()))


class SpeechDriver:
    def __init__(
        self,
        speech_queue: asyncio.Queue[SpeechEnvelopePayload],
        overrides: TetoOverrides,
        avatar_dir: Path,
        emit_mouth: bool = True,
    ) -> None:
        self._speech_queue = speech_queue
        self._overrides = overrides
        self._avatar_dir = avatar_dir
        self._current: SpeechEnvelopePayload | None = None
        self._rms_smooth = 0.0
        self._mouth_smooth = 0.0
        self._emit_mouth = emit_mouth
        self._strategy = build_strategy(overrides.body_sway_strategy, overrides, avatar_dir)

    def swap_strategy(self, name: BodySwayStrategyName) -> None:
        self._overrides.body_sway_strategy = name
        self._strategy = build_strategy(name, self._overrides, self._avatar_dir)

    def tick(self, now: float) -> dict[str, float]:
        self._drain_queue()
        rms = self._current_rms(now)
        self._rms_smooth = EMA_ALPHA * rms + (1.0 - EMA_ALPHA) * self._rms_smooth
        mouth = self._smooth_mouth(self._mouth_target(rms))
        body_params = self._strategy.tick(self._rms_smooth, now)
        out = {MOUTH_PARAM: mouth} if self._emit_mouth else {}
        out.update(body_params)
        if self._current is not None:
            logger.debug(
                "[SPEECH-DRIVER] sentence_id={} strategy={} rms={:.3f} mouth={:.3f} body_params=[{}]",
                self._current.sentence_id,
                self._overrides.body_sway_strategy,
                rms,
                mouth,
                _format_body_params(body_params),
            )
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

    def _mouth_target(self, rms: float) -> float:
        if rms <= MOUTH_NOISE_FLOOR:
            return 0.0
        return min(MOUTH_MAX_OPEN, (rms - MOUTH_NOISE_FLOOR) * MOUTH_GAIN)

    def _smooth_mouth(self, target: float) -> float:
        alpha = MOUTH_ATTACK_ALPHA if target > self._mouth_smooth else MOUTH_RELEASE_ALPHA
        self._mouth_smooth = alpha * target + (1.0 - alpha) * self._mouth_smooth
        if self._mouth_smooth < 0.01:
            self._mouth_smooth = 0.0
        return self._mouth_smooth
