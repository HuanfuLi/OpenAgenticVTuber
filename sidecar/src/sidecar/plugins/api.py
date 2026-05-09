from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from enum import StrEnum

from contracts import ActionCode, ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities


class ApiVersion(StrEnum):
    V1 = "1.0"


class BodyMotionPlugin(ABC):
    api_version: ApiVersion = ApiVersion.V1

    @abstractmethod
    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        """Called once at sidecar boot. Do not call pyvts here."""

    @abstractmethod
    def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        """Consume orchestrator-decorated sentence text and yield ParamFrames."""

    def on_unload(self) -> None:
        """Best-effort cleanup. Runtime always tolerates cleanup exceptions."""

    def on_action_code(self, action: ActionCode) -> None:
        """Called when the LLM emits a validated [action] code."""
