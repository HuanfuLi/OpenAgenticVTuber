"""Avatar per-rig override loader."""
from __future__ import annotations

from pathlib import Path

import yaml
from contracts.avatar_overrides import (
    AvatarOverrides,
    BodySwayStrategyName,
    DiscoveredHotkey,
    ParamProbeResult,
    Voice,
)
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry


TetoOverrides = AvatarOverrides


def load_avatar_overrides(avatar_dir: Path) -> AvatarOverrides:
    """Load avatars/<id>/_avatar_overrides.yaml, falling back to legacy Teto YAML.

    Missing files deliberately return safe defaults so the sidecar can boot
    before the operator has run the smoke-pass entry gate.
    """

    yaml_path = avatar_dir / "_avatar_overrides.yaml"
    if not yaml_path.exists():
        yaml_path = avatar_dir / "teto_overrides.yaml"
    if not yaml_path.exists():
        return AvatarOverrides()
    with yaml_path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return AvatarOverrides.model_validate(raw)


def save_avatar_overrides(avatar_dir: Path, overrides: AvatarOverrides) -> None:
    """Write avatars/<id>/_avatar_overrides.yaml as stable field-ordered YAML."""

    yaml_path = avatar_dir / "_avatar_overrides.yaml"
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    raw = overrides.model_dump(mode="json")
    with yaml_path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(raw, f, sort_keys=False, allow_unicode=True)


def load_overrides(avatar_dir: Path) -> TetoOverrides:
    return load_avatar_overrides(avatar_dir)


def save_overrides(avatar_dir: Path, overrides: TetoOverrides) -> None:
    save_avatar_overrides(avatar_dir, overrides)


__all__ = [
    "AvatarOverrides",
    "TetoOverrides",
    "BodySwayStrategyName",
    "DiscoveredHotkey",
    "ParamProbeResult",
    "Voice",
    "VariantEntry",
    "EventEntry",
    "load_avatar_overrides",
    "save_avatar_overrides",
    "load_overrides",
    "save_overrides",
]
