from __future__ import annotations

from collections.abc import AsyncIterator
from time import monotonic
from typing import Callable

from contracts import ActionCode, ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins import BodyMotionPlugin
from sidecar.plugins.sdk import extract_action_codes, ramp_weight, safe_add_frame


ACTION_COMPOSITIONS: dict[str, dict[str, float]] = {
    "nod": {"FaceAngleX": 3.0},
    "lean": {"FacePositionZ": 0.04},
}


class SampleMotionPlugin(BodyMotionPlugin):
    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self.capabilities: RigCapabilities | None = None
        self._clock = clock
        self._pending_fragment = ""
        self._active_action: str | None = None
        self._active_started_at = 0.0

    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        self.capabilities = capabilities

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        result = extract_action_codes(
            sentence,
            ACTION_COMPOSITIONS.keys(),
            pending_fragment=self._pending_fragment,
        )
        self._pending_fragment = result.pending_fragment
        for code in result.codes:
            self._activate(code)
        if self._active_action:
            yield self.render_frame()

    def on_action_code(self, action: ActionCode) -> None:
        self._activate(action.name)

    def on_unload(self) -> None:
        self.capabilities = None
        self._pending_fragment = ""
        self._active_action = None

    def _activate(self, action_code: str) -> None:
        normalized = action_code.strip().lower()
        if normalized not in ACTION_COMPOSITIONS:
            return
        self._active_action = normalized
        self._active_started_at = self._clock()

    def render_frame(self, now: float | None = None) -> ParamFrame:
        current = self._clock() if now is None else now
        if not self._active_action:
            return ParamFrame(emitted_at_monotonic=current)
        elapsed = max(0.0, current - self._active_started_at)
        weight = ramp_weight(elapsed, ramp_in_seconds=0.2, ramp_out_seconds=0.6)
        composition = {
            param_id: value * weight
            for param_id, value in ACTION_COMPOSITIONS[self._active_action].items()
        }
        if elapsed >= 0.8:
            self._active_action = None
        return safe_add_frame(
            composition,
            capabilities=self.capabilities,
            emitted_at_monotonic=current,
        )
