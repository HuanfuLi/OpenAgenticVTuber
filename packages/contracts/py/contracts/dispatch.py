from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class ActionCode(BaseModel):
    kind: Literal["action"] = "action"
    name: str


class VariantToggle(BaseModel):
    kind: Literal["variant"] = "variant"
    name: str
    hotkey_id: str


class EventFire(BaseModel):
    kind: Literal["event"] = "event"
    name: str
    hotkey_id: str
    duration_ms: int


Dispatch = Annotated[
    Union[ActionCode, VariantToggle, EventFire],
    Field(discriminator="kind"),
]
