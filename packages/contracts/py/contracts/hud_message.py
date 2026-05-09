"""HUD Phase 9 wire contracts: server-to-client (S2C) and client-to-server (C2S) discriminated unions."""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


# ---------- Server -> Client (S2C) ----------

class HudParamFrameMessage(BaseModel):
    """Full snapshot pushed at 15Hz per CONTEXT D-C4 (no delta encoding)."""
    kind: Literal["param-frame"] = "param-frame"
    tick_n: int
    params: dict[str, float]
    locked_ids: list[str]


class HudLockConfirmedMessage(BaseModel):
    kind: Literal["lock-confirmed"] = "lock-confirmed"
    param_id: str
    value: float


class HudLockRejectedMessage(BaseModel):
    """ERROR-log channel only per CONTEXT D-C5; never surfaces in renderer UI."""
    kind: Literal["lock-rejected"] = "lock-rejected"
    param_id: str
    reason: str


HudMessageS2C = Annotated[
    Union[HudParamFrameMessage, HudLockConfirmedMessage, HudLockRejectedMessage],
    Field(discriminator="kind"),
]


# ---------- Client -> Server (C2S) ----------

class HudSetLockMessage(BaseModel):
    kind: Literal["set-lock"] = "set-lock"
    param_id: str
    value: float


class HudClearLockMessage(BaseModel):
    kind: Literal["clear-lock"] = "clear-lock"
    param_id: str


HudMessageC2S = Annotated[
    Union[HudSetLockMessage, HudClearLockMessage],
    Field(discriminator="kind"),
]
