from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator

from sidecar.plugins.api import ApiVersion


RESERVED_ACTION_CODES = {
    "think",
    "thinking",
    "tool_call",
    "tool_calls",
    "function_call",
    "function_calls",
    "invoke",
    "parameter",
    "system",
}


def _reject_reserved_or_bracketed(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be empty")
    if normalized.lower() in RESERVED_ACTION_CODES:
        raise ValueError(f"{field_name} uses reserved name: {value}")
    if "[" in normalized or "]" in normalized or "<" in normalized or ">" in normalized:
        raise ValueError(f"{field_name} must not include brackets: {value}")
    return normalized


class PluginActionCode(BaseModel):
    code: str
    description: str

    @field_validator("code")
    @classmethod
    def _valid_code(cls, value: str) -> str:
        return _reject_reserved_or_bracketed(value, "action code")

    @field_validator("description")
    @classmethod
    def _description_not_empty(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("description must not be empty")
        return normalized


class PluginManifest(BaseModel):
    name: str
    version: str
    entrypoint: str
    api_version: str
    action_codes: list[PluginActionCode] = Field(default_factory=list)
    author: str | None = None
    license: str | None = None
    homepage: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def _valid_name(cls, value: str) -> str:
        return _reject_reserved_or_bracketed(value, "plugin name")

    @field_validator("entrypoint")
    @classmethod
    def _valid_entrypoint(cls, value: str) -> str:
        normalized = value.strip()
        if ":" not in normalized:
            raise ValueError("entrypoint must use path.py:ClassName")
        return normalized

    @field_validator("api_version")
    @classmethod
    def _compatible_api_version(cls, value: str) -> str:
        normalized = value.strip()
        expected_major = ApiVersion.V1.value.split(".", maxsplit=1)[0]
        actual_major = normalized.split(".", maxsplit=1)[0]
        if actual_major != expected_major:
            raise ValueError(f"incompatible plugin api_version: {value}")
        return normalized

    @model_validator(mode="after")
    def _unique_action_codes(self) -> "PluginManifest":
        seen: set[str] = set()
        for action_code in self.action_codes:
            key = action_code.code.lower()
            if key in seen:
                raise ValueError(f"duplicate action code: {action_code.code}")
            seen.add(key)
        return self
