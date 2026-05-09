"""Idle baseline driver for AVT-02."""

from __future__ import annotations

import math

from opensimplex import OpenSimplex


class IdleDriver:
    """Continuous low-amplitude head, gaze, and breath motion.

    VTube Studio owns normal idle blinking. This driver intentionally avoids
    EyeOpenLeft/EyeOpenRight so it does not fight VTS/model blink smoothing.
    Deliberate eye gestures such as wink should be explicit plugin/action
    frames, not part of idle motion.
    """

    def __init__(self, seed: int = 42, breath_writeable: bool = False) -> None:
        self._noise = OpenSimplex(seed)
        self._breath_writeable = breath_writeable

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

        return out
