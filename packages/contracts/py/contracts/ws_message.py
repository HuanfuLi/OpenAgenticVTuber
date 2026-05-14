"""OLVT-shape WebSocket message envelope (Phase 1 + Phase 2 surface).

Phase 1 surface: text-input, display-text, shutdown (unchanged).
Phase 2 surface adds: audio (per OLVT canonical), control, full-text,
force-new-message, error, log.
"""

from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field
from .audio_payload import AudioPayloadMessage  # noqa: F401 -- re-export


# Phase 1 (unchanged):

class TextInputMessage(BaseModel):
    type: Literal["text-input"] = "text-input"
    text: str
    session_id: str | None = None
    history: list["TextInputHistoryMessage"] = Field(default_factory=list)


class TextInputHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class DisplayTextMessage(BaseModel):
    type: Literal["display-text"] = "display-text"
    text: str


class ShutdownMessage(BaseModel):
    type: Literal["shutdown"] = "shutdown"


class StopTurnMessage(BaseModel):
    type: Literal["stop-turn"] = "stop-turn"


# Phase 2 (new):

class ControlMessage(BaseModel):
    """OLVT conversation_utils.py:138-204 control signals.
    text values used in Phase 2:
      - "conversation-chain-start"  (D-03)
      - "conversation-chain-end"    (D-04)
    """
    type: Literal["control"] = "control"
    text: str


class FullTextMessage(BaseModel):
    """OLVT conversation_utils.py:143 -- turn-start "Thinking..." echo (D-03)."""
    type: Literal["full-text"] = "full-text"
    text: str


class ForceNewMessageMessage(BaseModel):
    """OLVT conversation_utils.py:181 -- turn seal (D-04)."""
    type: Literal["force-new-message"] = "force-new-message"


class ErrorMessage(BaseModel):
    """Surfaced as a banner above the chat input (CHAT.STREAM_ERROR or
    CHAT.CONTEXT_OVERFLOW per UI-SPEC Copywriting Contract)."""
    type: Literal["error"] = "error"
    message: str


class LogMessage(BaseModel):
    """Sidecar stdout/loguru bridge to renderer Logs drawer (Phase 1 channel,
    re-used for structured sidecar log lines per D-14, D-23)."""
    type: Literal["log"] = "log"
    level: str          # "info" | "warn" | "error" | "debug"
    message: str


WSMessage = Annotated[
    Union[
        TextInputMessage,
        DisplayTextMessage,
        ShutdownMessage,
        StopTurnMessage,
        AudioPayloadMessage,
        ControlMessage,
        FullTextMessage,
        ForceNewMessageMessage,
        ErrorMessage,
        LogMessage,
    ],
    Field(discriminator="type"),
]
