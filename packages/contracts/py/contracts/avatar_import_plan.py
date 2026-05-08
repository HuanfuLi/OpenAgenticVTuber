from __future__ import annotations

from pydantic import BaseModel, Field

from .avatar_overrides import AvatarOverrides, Voice
from .event_entry import EventEntry
from .variant_entry import VariantEntry


class ImportWarning(BaseModel):
    kind: str
    message: str
    related_code: str | None = None


class AvatarImportPlan(BaseModel):
    detected_type: str
    avatar_id: str = ""
    avatar_name: str = ""
    source_rig_path: str = ""
    variants: list[VariantEntry] = Field(default_factory=list)
    events: list[EventEntry] = Field(default_factory=list)
    voice: Voice | None = None
    warnings: list[ImportWarning] = Field(default_factory=list)
    existing_overrides: AvatarOverrides | None = None
