"""Teto per-rig override loader.

`avatar.yaml` contains VTS-introspectable capabilities. This file loads the
engineer-curated deviations that are not discoverable from VTS alone.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Literal, Optional

import yaml
from pydantic import BaseModel, Field, model_validator


class ParamProbeResult(BaseModel):
    """D-05 smoke-pass output for one parameter probe."""

    name: str
    wrote: float
    readback: float
    visible: bool
    orphan_face_tracker: bool
    blend_partial: bool


class DiscoveredHotkey(BaseModel):
    """D-11 VTS hotkey discovery output."""

    hotkey_id: str
    name: str
    type: str
    file: str = ""
    is_meta: bool = False
    llm_emittable: bool = True

    @model_validator(mode="after")
    def _meta_hotkeys_are_not_llm_emittable(self) -> "DiscoveredHotkey":
        if self.is_meta:
            self.llm_emittable = False
        return self


BodySwayStrategyName = Literal["head_only", "proxy_param", "exp3_modulation"]


class TetoOverrides(BaseModel):
    """Engineer-curated Teto deviations and Phase 4 strategy choices."""

    orphan_params: List[str] = Field(default_factory=list)
    physics_chain_proxies: dict[str, str] = Field(default_factory=dict)
    sign_inversions: List[str] = Field(default_factory=list)

    body_sway_strategy: BodySwayStrategyName = "head_only"
    proxy_body_param: Optional[str] = None
    exp3_body_pose: Optional[str] = None

    param_probes: List[ParamProbeResult] = Field(default_factory=list)
    discovered_hotkeys: List[DiscoveredHotkey] = Field(default_factory=list)
    notes: dict[str, str] = Field(default_factory=dict)


def load_overrides(avatar_dir: Path) -> TetoOverrides:
    """Load avatars/<id>/teto_overrides.yaml.

    Missing files deliberately return safe defaults so the sidecar can boot
    before the operator has run the smoke-pass entry gate.
    """

    yaml_path = avatar_dir / "teto_overrides.yaml"
    if not yaml_path.exists():
        return TetoOverrides()
    with yaml_path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return TetoOverrides.model_validate(raw)


def save_overrides(avatar_dir: Path, overrides: TetoOverrides) -> None:
    """Write avatars/<id>/teto_overrides.yaml as stable field-ordered YAML."""

    yaml_path = avatar_dir / "teto_overrides.yaml"
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    raw = overrides.model_dump(mode="json")
    with yaml_path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(raw, f, sort_keys=False, allow_unicode=True)
