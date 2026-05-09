"""Adapted from OLVT agent/output_types.py (MIT) -- see PROVENANCE.md.

Adaptations vs OLVT:
  - Dropped `Actions` dataclass (CONTEXT.md D-12 / RESEARCH Discrepancy 5):
    we use list[Dispatch] instead of OLVT's {expressions,pictures,sounds}.
  - Dropped `AudioOutput` (Phase 3 will add a different shape).
  - SentenceOutput.dispatches is now List[Dispatch].
"""
from dataclasses import dataclass, field
from typing import List, Optional

from contracts import Dispatch


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

    Contains a single sentence triple (display, TTS, and plugin-visible raw text)
    with associated dispatches.

    Attributes:
        display_text: Text to be displayed in UI.
        tts_text: Text to be sent to TTS engine.
        plugin_text: Post-sentence_divider, pre-display/pre-TTS text delivered
            to body-motion plugins.
        dispatches: list[Dispatch] -- Phase 7 D-A4 ordered action, variant,
            and event records emitted by the code parser.
    """

    display_text: DisplayText
    tts_text: str
    plugin_text: str
    dispatches: List[Dispatch] = field(default_factory=list)
