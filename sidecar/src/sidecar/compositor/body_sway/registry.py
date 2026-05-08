"""Body-sway strategy registry."""

from __future__ import annotations

from pathlib import Path

from sidecar.avatar.overrides import TetoOverrides

from .exp3_modulation import Exp3ModulationStrategy
from .head_only import HeadOnlyStrategy
from .proxy_param import ProxyParamStrategy


STRATEGY_NAMES = ("head_only", "proxy_param", "exp3_modulation")


def available_strategy_names(overrides: TetoOverrides) -> tuple[str, ...]:
    names = ["head_only"]
    if overrides.proxy_body_param:
        names.append("proxy_param")
    if overrides.exp3_body_pose:
        names.append("exp3_modulation")
    return tuple(names)


def build_strategy(name: str, overrides: TetoOverrides, avatar_dir: Path):
    if name == "head_only":
        return HeadOnlyStrategy()
    if name == "proxy_param":
        return ProxyParamStrategy(overrides.proxy_body_param or "Lean Forward")
    if name == "exp3_modulation":
        exp3_path = avatar_dir / overrides.exp3_body_pose if overrides.exp3_body_pose else None
        return Exp3ModulationStrategy(exp3_path)
    raise ValueError(f"Unknown body-sway strategy: {name!r}")
