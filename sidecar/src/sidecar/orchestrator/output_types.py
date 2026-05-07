"""Adapted from OLVT agent/output_types.py (MIT) -- see PROVENANCE.md.

Adaptations vs OLVT:
  - Dropped `Actions` dataclass (CONTEXT.md D-12 / RESEARCH Discrepancy 5):
    we use list[ActionIntent] instead of OLVT's {expressions,pictures,sounds}.
  - Dropped `AudioOutput` (Phase 3 will add a different shape).
  - SentenceOutput.actions is now List[ActionIntent].
"""
from dataclasses import dataclass, field
from typing import List, Optional

from contracts import ActionIntent


@dataclass
class DisplayText:
    """Text to be displayed with optional metadata."""

    text: str
    name: Optional[str] = "Teto"
    avatar: Optional[str] = "teto"

    def to_dict(self) -> dict:
        return {"text": self.text, "name": self.name, "avatar": self.avatar}

    def __str__(self) -> str:
        return f"{self.name}: {self.text}"


@dataclass
class SentenceOutput:
    """Output type for text-based responses.

    Contains a single sentence pair (display and TTS) with associated actions.

    Attributes:
        display_text: Text to be displayed in UI.
        tts_text: Text to be sent to TTS engine.
        actions: list[ActionIntent] -- Phase 2 D-12 divergence from OLVT
            Actions{expressions,pictures,sounds} dataclass; preserves
            kind/name/strength/duration_ms/avatar_id for Phase 4 compositor.
    """

    display_text: DisplayText
    tts_text: str
    actions: List[ActionIntent] = field(default_factory=list)
