"""Idle baseline driver for AVT-02."""

from __future__ import annotations

import math
import random

from opensimplex import OpenSimplex


class IdleDriver:
    """Continuous low-amplitude head, eye, blink, and breath motion."""

    BLINK_DURATION_S = 0.07
    BLINK_REOPEN_DURATION_S = 0.18
    BLINK_CLOSED_VALUE = 0.05
    BLINK_OPEN_VALUE = 0.55

    def __init__(self, seed: int = 42, breath_writeable: bool = False) -> None:
        self._noise = OpenSimplex(seed)
        self._rng = random.Random(seed)
        self._breath_writeable = breath_writeable
        self._next_blink_at = 0.0
        self._blink_until = 0.0
        self._blink_reopen_until = 0.0
        self._schedule_next_blink(0.0)

    def _schedule_next_blink(self, now: float) -> None:
        self._next_blink_at = now + self._rng.uniform(2.0, 6.0)

    def tick(self, now: float) -> dict[str, float]:
        eye_x = self._noise.noise2(now * 0.45, 4.0) * 0.35
        eye_y = self._noise.noise2(now * 0.40, 5.0) * 0.25
        out = {
            "FaceAngleX": self._noise.noise2(now * 0.35, 1.0) * 5.0,
            "FaceAngleY": self._noise.noise2(now * 0.30, 2.0) * 3.0,
            "FaceAngleZ": self._noise.noise2(now * 0.25, 3.0) * 4.0,
            "EyeLeftX": eye_x,
            "EyeRightX": eye_x,
            "EyeLeftY": eye_y,
            "EyeRightY": eye_y,
        }
        if self._breath_writeable:
            out["Auto Breath"] = (math.sin(now * math.tau * 0.25) + 1.0) * 0.5

        if now >= self._next_blink_at:
            self._blink_until = now + self.BLINK_DURATION_S
            self._blink_reopen_until = self._blink_until + self.BLINK_REOPEN_DURATION_S
            self._schedule_next_blink(now)
        if now < self._blink_until:
            out["EyeOpenLeft"] = self.BLINK_CLOSED_VALUE
            out["EyeOpenRight"] = self.BLINK_CLOSED_VALUE
        elif now < self._blink_reopen_until:
            out["EyeOpenLeft"] = self.BLINK_OPEN_VALUE
            out["EyeOpenRight"] = self.BLINK_OPEN_VALUE
        return out
