from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .action_binding import DefaultPluginActionBinding
from .event_entry import EventEntry
from .variant_entry import VariantEntry


class Voice(BaseModel):
    backend: str = "piper"
    model: str = "en_US-amy-medium"
    lipsync_mode: str = "our-rms"


class ParamProbeResult(BaseModel):
    name: str
    wrote: float
    readback: float
    visible: bool
    orphan_face_tracker: bool
    blend_partial: bool


class DiscoveredHotkey(BaseModel):
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


class AvatarOverrides(BaseModel):
    orphan_params: list[str] = Field(default_factory=list)
    physics_chain_proxies: dict[str, str] = Field(default_factory=dict)
    sign_inversions: list[str] = Field(default_factory=list)

    body_sway_strategy: BodySwayStrategyName = "head_only"
    proxy_body_param: str | None = None
    exp3_body_pose: str | None = None

    param_probes: list[ParamProbeResult] = Field(default_factory=list)
    discovered_hotkeys: list[DiscoveredHotkey] = Field(default_factory=list)
    notes: dict[str, str] = Field(default_factory=dict)

    voice: Voice = Field(default_factory=Voice)
    variants: list[VariantEntry] = Field(default_factory=list)
    events: list[EventEntry] = Field(default_factory=list)
    default_plugin_action_bindings: list[DefaultPluginActionBinding] = Field(default_factory=list)
    source_rig_path: str = ""
