"""Head-only fallback body-sway strategy."""

from __future__ import annotations

import math


class HeadOnlyStrategy:
    name = "head_only"

    def tick(self, rms: float, now: float) -> dict[str, float]:
        drive = max(0.0, min(1.0, float(rms)))
        sway_phase = now * math.tau * 0.55
        breathe_phase = now * math.tau * 0.35
        sway = math.sin(sway_phase)
        counter = math.sin(sway_phase + math.pi / 2.0)
        breathe = math.sin(breathe_phase)
        return {
            "FaceAngleX": drive * 3.0 * counter,
            "FaceAngleY": drive * 5.0 * counter,
            "FaceAngleZ": drive * 12.0 * sway,
            "FacePositionX": drive * 0.35 * sway,
            "FacePositionZ": drive * -0.25 * (0.65 + 0.35 * breathe),
        }
