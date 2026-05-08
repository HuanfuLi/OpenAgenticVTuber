"""DEPRECATED - milestone-1 compatibility layer.

Per CONTEXT D-A1-1, new boot code uses RigCapabilities. Legacy orchestrator
tests and callers still load avatar.yaml until Phase 6 rewrites them, so this
module preserves the old AvatarCapabilities contract during the handoff.
"""

# TODO(Phase 6): delete this file after legacy actions_extractor/orchestrator.py rewrites land

from pathlib import Path

import yaml
from contracts.avatar_overrides import Voice
from contracts.rig_capabilities import RigCapabilities
from pydantic import BaseModel, Field


class Expression(BaseModel):
    name: str
    file: str


class Hotkey(BaseModel):
    name: str
    type: str


class Parameter(BaseModel):
    id: str


class AvatarCapabilities(BaseModel):
    """Deprecated avatar.yaml model kept for pre-Phase-6 callers."""

    expressions: list[Expression]
    hotkeys: list[Hotkey] = Field(default_factory=list)
    parameters: list[Parameter] = Field(default_factory=list)
    voice: Voice | None = None

    @property
    def writable_param_ids(self) -> list[str]:
        return [parameter.id for parameter in self.parameters]

    def tag_vocabulary(self) -> str:
        names = [item.name for item in [*self.expressions, *self.hotkeys]]
        return f"{', '.join(f'[{name}]' for name in names)}," if names else ""


def load_capabilities(avatar_dir) -> AvatarCapabilities:
    path = Path(avatar_dir) / "avatar.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return AvatarCapabilities.model_validate(data)


__all__ = [
    "AvatarCapabilities",
    "Expression",
    "Hotkey",
    "Parameter",
    "RigCapabilities",
    "Voice",
    "load_capabilities",
]
