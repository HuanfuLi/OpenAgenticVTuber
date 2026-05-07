"""DiscreteEvent -- rare-trigger payload (AVT-09). Maps 1:1 to a VTS hotkey."""

from __future__ import annotations

from pydantic import BaseModel


class DiscreteEvent(BaseModel):
    hotkey_id: str
    name: str
    triggered_at: float
