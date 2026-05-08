"""Default plugin body-sway strategy registry."""

from __future__ import annotations

from .head_only import HeadOnlyStrategy


STRATEGY_NAMES = ("head_only",)


def available_strategy_names(*_args, **_kwargs) -> tuple[str, ...]:
    return ("head_only",)


def build_strategy(name: str, *args, **kwargs):
    if name != "head_only":
        raise ValueError("Only head_only is selectable in the default plugin")
    return HeadOnlyStrategy()
