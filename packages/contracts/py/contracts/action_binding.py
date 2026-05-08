from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DefaultPluginActionBinding(BaseModel):
    plugin_name: Literal["default"] = "default"
    action_code: str = Field(pattern=r"^[a-z][a-z0-9-]{0,30}$")
    expression_index: int = Field(ge=0)
    expression_name: str = ""
    source: Literal["olvt_emotionMap", "manual"] = "olvt_emotionMap"
