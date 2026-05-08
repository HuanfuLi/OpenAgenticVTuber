from __future__ import annotations

from pydantic import BaseModel, Field


class Expression(BaseModel):
    name: str
    file: str


class Hotkey(BaseModel):
    name: str
    type: str
    hotkey_id: str


class RigCapabilities(BaseModel):
    writable_param_ids: list[str] = Field(default_factory=list)
    param_ranges: dict[str, tuple[float, float] | None] = Field(default_factory=dict)
    expressions: list[Expression] = Field(default_factory=list)
    hotkeys: list[Hotkey] = Field(default_factory=list)
    cdi3_display_names: dict[str, str] = Field(default_factory=dict)
    sign_inversions: list[str] = Field(default_factory=list)
