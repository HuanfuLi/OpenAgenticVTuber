"""DEPRECATED - milestone-1 import shim; deleted after Phase 6 rewrites callers.

Per CONTEXT D-A1-1, AvatarCapabilities is replaced by RigCapabilities. This
shim exists only during the 08-01 -> 08-02/Phase 6 handoff.
"""

# TODO(Phase 6): delete this file after IntentDriver/actions_extractor/orchestrator.py rewrites land

from contracts.avatar_overrides import Voice
from contracts.rig_capabilities import RigCapabilities
from pydantic import BaseModel
from sidecar.avatar.overrides import load_avatar_overrides


class Expression(BaseModel):
    name: str
    file: str


class Hotkey(BaseModel):
    name: str
    type: str


class Parameter(BaseModel):
    id: str


class AvatarCapabilities:
    """DEPRECATED - empty shim. Replaced by RigCapabilities."""

    def __init__(self, expressions=None, hotkeys=None, parameters=None, voice=None):
        self.expressions = expressions or []
        self.hotkeys = hotkeys or []
        self.parameters = parameters or []
        self.voice = voice

    def tag_vocabulary(self) -> str:
        return ""


def load_capabilities(avatar_dir) -> AvatarCapabilities:
    load_avatar_overrides(avatar_dir)
    return AvatarCapabilities(expressions=[])


__all__ = [
    "AvatarCapabilities",
    "Expression",
    "Hotkey",
    "Parameter",
    "RigCapabilities",
    "Voice",
    "load_capabilities",
]
