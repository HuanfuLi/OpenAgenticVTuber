"""ActionIntent -- PROJECT_DESIGN §6 dataclass adapted to Pydantic v2.

Phase 2 fills `kind` and `name` from avatar.yaml lookup; defaults for the rest.
Phase 4's compositor consumes via internal pub-sub (NOT the WS -- D-11).
"""
from typing import Literal, Optional
from pydantic import BaseModel


class ActionIntent(BaseModel):
    kind: Literal["expression", "action", "reaction"]
    name: str
    strength: float = 1.0
    duration_ms: Optional[int] = None
    avatar_id: str  # always "teto" in skeleton
