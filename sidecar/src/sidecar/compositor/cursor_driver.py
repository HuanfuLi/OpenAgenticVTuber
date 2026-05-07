"""CursorDriver -- AVT-10 + D-10."""

from __future__ import annotations

from sidecar.vts.window_detect import get_cursor_and_rect

from .easing import ease_out_cubic


HEAD_MAX_DEFLECTION_DEG = 15.0
EYE_MAX_DEFLECTION_DEG = 10.0
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
    if not (left <= cx <= right and top <= cy <= bottom):
        return {}

    width = right - left
    height = bottom - top
    face_x = left + width * face_center_frac[0]
    face_y = top + height * face_center_frac[1]
    dx = cx - face_x
    dy = cy - face_y
    if (dx * dx + dy * dy) ** 0.5 < dead_zone_px:
        return {
            "ParamAngleX": 0.0,
            "ParamAngleY": 0.0,
            "ParamEyeBallX": 0.0,
            "ParamEyeBallY": 0.0,
        }

    nx = max(-1.0, min(1.0, dx / (width * 0.5)))
    ny = max(-1.0, min(1.0, dy / (height * 0.5)))
    return {
        "ParamAngleX": nx * head_max_deg,
        "ParamAngleY": -ny * head_max_deg,
        "ParamEyeBallX": nx * eye_max_deg / head_max_deg,
        "ParamEyeBallY": -ny * eye_max_deg / head_max_deg,
    }


class CursorDriver:
    def __init__(self) -> None:
        self._last_in_canvas_output: dict[str, float] = {}
        self._cursor_left_canvas_at: float | None = None

    def tick(self, now: float) -> dict[str, float]:
        cursor_xy, vts_rect = get_cursor_and_rect()
        if vts_rect is None:
            return {}
        live = _cursor_to_param_angles(cursor_xy, vts_rect)
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
