"""Easing helpers shared by compositor drivers."""

from __future__ import annotations


def ease_out_cubic(t: float) -> float:
    """Clamp `t` to [0, 1] and return cubic ease-out."""

    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3
