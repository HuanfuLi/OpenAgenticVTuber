"""CursorDriver -- AVT-10 via D-09 sidecar Win32 polling.

The accepted AVT-10 contract is a sidecar Win32 cursor/window sample from
``get_cursor_and_rect()``. No renderer event or renderer hot path is involved.

Phase 10 fix (VFY-01 / VFY-02):
- Output keys are translated through ``resolve_param_id(name, "vts")`` so the
  driver emits VTS tracking-input names (FaceAngleX, FaceAngleY, EyeLeftX,
  EyeRightX, EyeLeftY, EyeRightY) instead of Cubism input names (ParamAngleX, etc.). This matches
  every other working driver in the compositor; the milestone-1 namespace
  mismatch was the cursor-never-worked root cause. See 10-RESEARCH.md.
- The in-VTS-window gate is dropped: when the cursor is outside the rect, the
  driver continues projecting (clamped to [-1, 1]) so the avatar tracks even
  when the user moves to other windows. The dead-zone branch is preserved so
  micro-jitter near the face center does not cause head twitches.
- When no VTS rect is detected (VTS closed or pre-launch), the driver falls
  back to projecting against the primary-monitor synthetic canvas via
  ``get_primary_monitor_rect()``. Non-Windows platforms remain a no-op.
"""

from __future__ import annotations

from sidecar.vts.window_detect import get_cursor_and_rect, get_primary_monitor_rect

from .easing import ease_out_cubic


HEAD_MAX_DEFLECTION_DEG = 15.0
EYE_MAX_DEFLECTION_DEG = 13.5
DEAD_ZONE_PX = 80.0
EASE_BACK_DURATION_S = 0.800
FACE_CENTER_FRAC = (0.5, 0.5)


def _cursor_to_param_angles(
    cursor_xy: tuple[int, int],
    vts_rect: tuple[int, int, int, int],
    face_center_frac: tuple[float, float] = FACE_CENTER_FRAC,
    head_max_deg: float = HEAD_MAX_DEFLECTION_DEG,
    eye_max_deg: float = EYE_MAX_DEFLECTION_DEG,
    dead_zone_px: float = DEAD_ZONE_PX,
) -> dict[str, float]:
    cx, cy = cursor_xy
    left, top, right, bottom = vts_rect

    # In-VTS-window gate dropped per VFY-02. Cursor outside the rect still
    # produces deflection, clamped to [-1, 1] below.

    width = right - left
    height = bottom - top
    face_x = left + width * face_center_frac[0]
    face_y = top + height * face_center_frac[1]
    dx = cx - face_x
    dy = cy - face_y
    if (dx * dx + dy * dy) ** 0.5 < dead_zone_px:
        return {
            "FaceAngleX": 0.0,
            "FaceAngleY": 0.0,
            "EyeLeftX": 0.0,
            "EyeRightX": 0.0,
            "EyeLeftY": 0.0,
            "EyeRightY": 0.0,
        }

    nx = max(-1.0, min(1.0, dx / (width * 0.5)))
    ny = max(-1.0, min(1.0, dy / (height * 0.5)))
    eye_x = nx * eye_max_deg / head_max_deg
    eye_y = -ny * eye_max_deg / head_max_deg
    return {
        "FaceAngleX": nx * head_max_deg,
        "FaceAngleY": -ny * head_max_deg,
        "EyeLeftX": eye_x,
        "EyeRightX": eye_x,
        "EyeLeftY": eye_y,
        "EyeRightY": eye_y,
    }


class CursorDriver:
    def __init__(self) -> None:
        self._last_in_canvas_output: dict[str, float] = {}
        self._cursor_left_canvas_at: float | None = None

    def tick(self, now: float) -> dict[str, float]:
        cursor_xy, vts_rect = get_cursor_and_rect()
        # Synthetic-canvas fallback per VFY-02: when VTS is not running, project
        # against the primary monitor so the cursor still drives tracking.
        rect = vts_rect if vts_rect is not None else get_primary_monitor_rect()
        if rect is None:
            return {}
        live = _cursor_to_param_angles(cursor_xy, rect)
        if live:
            self._last_in_canvas_output = live
            self._cursor_left_canvas_at = None
            return live
        if self._cursor_left_canvas_at is None:
            self._cursor_left_canvas_at = now
        elapsed = now - self._cursor_left_canvas_at
        if elapsed >= EASE_BACK_DURATION_S:
            self._last_in_canvas_output = {}
            return {}
        attenuation = 1.0 - ease_out_cubic(elapsed / EASE_BACK_DURATION_S)
        return {key: value * attenuation for key, value in self._last_in_canvas_output.items()}
