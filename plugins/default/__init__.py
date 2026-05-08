"""Default body-motion plugin package."""

from __future__ import annotations

from collections.abc import AsyncIterator
from time import monotonic
from typing import Callable

from contracts import ParamFrame
from contracts.action_binding import DefaultPluginActionBinding
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.api import BodyMotionPlugin


SUPPORTED_ACTION_CODES = frozenset(
    {"anger", "disgust", "fear", "joy", "neutral", "sadness", "smirk", "surprise"}
)

EMOTION_COMPOSITIONS = {
    "joy": {
        "FaceAngleZ": (0.10, 0.65),
        "FaceAngleY": (0.04, 0.45),
        "EyeOpenLeft": (0.06, 0.35),
        "EyeOpenRight": (0.06, 0.35),
    },
    "anger": {"FaceAngleZ": (-0.08, 0.60), "FaceAngleY": (-0.03, 0.45)},
    "disgust": {"FaceAngleZ": (-0.06, 0.50), "FaceAngleY": (0.06, 0.35)},
    "fear": {"FaceAngleZ": (0.04, 0.55), "FacePositionZ": (-0.04, 0.40)},
    "neutral": {},
    "sadness": {"FaceAngleZ": (-0.05, 0.45), "FacePositionZ": (-0.03, 0.35)},
    "smirk": {"FaceAngleZ": (0.07, 0.55), "FaceAngleY": (0.05, 0.40)},
    "surprise": {
        "FacePositionZ": (0.05, 0.45),
        "EyeOpenLeft": (0.08, 0.40),
        "EyeOpenRight": (0.08, 0.40),
    },
}

RAMP_IN_SECONDS = 0.3
RAMP_OUT_SECONDS = 0.6


class DefaultPlugin(BodyMotionPlugin):
    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self.capabilities: RigCapabilities | None = None
        self.overrides: AvatarOverrides | None = None
        self.composition_sources: dict[str, str] = {}
        self._clock = clock
        self._parse_buffer = ""
        self._active_action: str | None = None
        self._active_started_at = 0.0

    @property
    def active_action(self) -> str | None:
        return self._active_action

    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        self.capabilities = capabilities
        self.overrides = overrides
        self.composition_sources = self._build_composition_sources(capabilities, overrides)

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        action_codes = self._extract_action_codes(sentence)
        for action_code in action_codes:
            self._activate(action_code)

        frame = self._render_active_frame()
        if frame is not None:
            yield frame

    def on_unload(self) -> None:
        self.capabilities = None
        self.overrides = None
        self.composition_sources = {}
        self._parse_buffer = ""
        self._active_action = None

    def _build_composition_sources(
        self,
        capabilities: RigCapabilities,
        overrides: AvatarOverrides,
    ) -> dict[str, str]:
        sources = {action_code: "fallback" for action_code in SUPPORTED_ACTION_CODES}
        for binding in capabilities.default_plugin_action_bindings:
            self._apply_binding_source(sources, binding)
        for binding in overrides.default_plugin_action_bindings:
            self._apply_binding_source(sources, binding)
        return sources

    def _apply_binding_source(
        self,
        sources: dict[str, str],
        binding: DefaultPluginActionBinding,
    ) -> None:
        action_code = binding.action_code.lower()
        if action_code not in SUPPORTED_ACTION_CODES:
            return
        source_name = binding.expression_name or str(binding.expression_index)
        sources[action_code] = f"{binding.source}:{source_name}"

    def _extract_action_codes(self, sentence: str) -> list[str]:
        text = self._parse_buffer + sentence
        self._parse_buffer = ""

        last_open = text.rfind("[")
        last_close = text.rfind("]")
        if last_open > last_close:
            self._parse_buffer = text[last_open:]
            text = text[:last_open]

        actions: list[str] = []
        lower = text.lower()
        index = 0
        while index < len(lower):
            if lower[index] != "[":
                index += 1
                continue
            end = lower.find("]", index)
            if end == -1:
                break
            candidate = lower[index + 1 : end].strip()
            if candidate in SUPPORTED_ACTION_CODES:
                actions.append(candidate)
            index = end + 1
        return actions

    def _activate(self, action_code: str) -> None:
        if action_code == "neutral":
            self._active_action = None
            return
        self._active_action = action_code
        self._active_started_at = self._clock()

    def _render_active_frame(self) -> ParamFrame | None:
        if self._active_action is None:
            return None

        elapsed = max(0.0, self._clock() - self._active_started_at)
        weight = self._ramp_weight(elapsed)
        composition = EMOTION_COMPOSITIONS[self._active_action]
        writable = set(self.capabilities.writable_param_ids) if self.capabilities else set()
        add_params = {
            param_id: amount * weight
            for param_id, (amount, _blend_limit) in composition.items()
            if not writable or param_id in writable
        }

        if elapsed >= RAMP_IN_SECONDS + RAMP_OUT_SECONDS:
            self._active_action = None

        return ParamFrame(add_params=add_params, emitted_at_monotonic=self._clock())

    def _ramp_weight(self, elapsed: float) -> float:
        if elapsed <= RAMP_IN_SECONDS:
            return elapsed / RAMP_IN_SECONDS
        if elapsed <= RAMP_IN_SECONDS + RAMP_OUT_SECONDS:
            return 1.0 - ((elapsed - RAMP_IN_SECONDS) / RAMP_OUT_SECONDS)
        return 0.0
