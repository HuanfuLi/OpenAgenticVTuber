"""Avatar capabilities loader -- D-07/D-08.

Loads avatars/<avatar_id>/avatar.yaml at sidecar boot via PyYAML; validates
against an AvatarCapabilities Pydantic model; exposes expressions, hotkeys,
parameters, voice. Used by:
  - actions_extractor (kind classification -- D-13)
  - construct_system_prompt (LLM tag-vocabulary string -- D-06)
"""
from pathlib import Path
from typing import List, Optional
import yaml
from pydantic import BaseModel


class Expression(BaseModel):
    name: str
    file: str  # e.g. "joy.exp3.json"


class Hotkey(BaseModel):
    name: str          # e.g. "cry", "bread-out"
    type: str          # VTS hotkey type: "TriggerAnimation" | "ToggleExpression" | ...


class Parameter(BaseModel):
    id: str            # e.g. "ParamMouthOpenY"


class Voice(BaseModel):
    backend: str = "piper"
    model: str = "en_US-amy-medium"
    lipsync_mode: str = "our-rms"


class AvatarCapabilities(BaseModel):
    expressions: List[Expression]
    hotkeys: List[Hotkey] = []
    parameters: List[Parameter] = []
    voice: Optional[Voice] = None

    def tag_vocabulary(self) -> str:
        """Return the LLM-emittable tag list as a space-separated string of
        bracket-wrapped names: '[joy], [surprise], [cry],' -- used by D-06's
        live2d_expression_prompt.txt [<insert_action_keys>] substitution."""
        names = [e.name for e in self.expressions] + [h.name for h in self.hotkeys]
        return " ".join(f"[{n}]," for n in names)


def load_capabilities(avatar_dir: Path) -> AvatarCapabilities:
    """Load and validate avatar.yaml. Raises pydantic.ValidationError on
    schema drift; raises FileNotFoundError if avatar.yaml is missing.

    Loud failure is intentional -- boot must abort with a clear message rather
    than run with a silently-empty capabilities list (which would yield zero
    extractable tags and mask the bug).
    """
    yaml_path = avatar_dir / "avatar.yaml"
    with yaml_path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return AvatarCapabilities.model_validate(raw)
