"""OLVT-shape WebSocket message envelope.

Mirrors Open-LLM-VTuber's _route_message() shape exactly: flat fields with
`type` as the dispatch discriminator. The Phase 1 subset is text-input,
display-text, shutdown. Phase 2-4 will add: ai-speak-signal, audio,
interrupt-signal, etc. -- all match OLVT names verbatim.
"""

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class TextInputMessage(BaseModel):
    type: Literal["text-input"] = "text-input"
    text: str


class DisplayTextMessage(BaseModel):
    type: Literal["display-text"] = "display-text"
    text: str


class ShutdownMessage(BaseModel):
    type: Literal["shutdown"] = "shutdown"


WSMessage = Annotated[
    Union[TextInputMessage, DisplayTextMessage, ShutdownMessage],
    Field(discriminator="type"),
]
