"""Head-only fallback body-sway strategy."""

from __future__ import annotations


class HeadOnlyStrategy:
    name = "head_only"

    def tick(self, rms: float, now: float) -> dict[str, float]:
        return {
            "ParamAngleZ": rms * 2.0,
            "ParamAngleY": rms * 1.0,
        }
