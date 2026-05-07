"""ParamFrame -- compositor's per-tick output unit. NOT a WS message.

The compositor emits one ParamFrame per 60Hz tick. The single-writer pyvts
task converts each frame into batched VTS parameter injection requests.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ParamMode = Literal["add", "set"]


class ParamFrame(BaseModel):
    """One tick's worth of merged param values bound for VTS."""

    add_params: dict[str, float] = Field(default_factory=dict)
    set_params: dict[str, tuple[float, float]] = Field(default_factory=dict)
    tick_n: int = 0
    emitted_at_monotonic: float = 0.0
