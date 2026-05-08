"""ParamID resolver -- VTS pass-through, non-VTS explicitly unsupported."""

from __future__ import annotations

from typing import Literal


RendererName = Literal["vts", "pixi", "cubism_native"]

_VTS_INPUT_PARAM_MAP = {
    "ParamAngleX": "FaceAngleX",
    "ParamAngleY": "FaceAngleY",
    "ParamAngleZ": "FaceAngleZ",
    "ParamEyeBallX": "EyeLeftX",
    "ParamEyeBallY": "EyeRightY",
    "ParamEyeLOpen": "EyeOpenLeft",
    "ParamEyeROpen": "EyeOpenRight",
    "ParamMouthOpenY": "MouthOpen",
}


def resolve_param_id(name: str, renderer: RendererName = "vts") -> str:
    if renderer == "vts":
        return _VTS_INPUT_PARAM_MAP.get(name, name)
    if renderer in ("pixi", "cubism_native"):
        raise NotImplementedError(
            f"ParamID resolution for renderer={renderer!r} is post-MVP exploratory. "
            "See .planning/PROJECT.md R-OPEN-2. Skeleton ships VTS-only per AVT-05."
        )
    raise ValueError(
        f"Unknown renderer: {renderer!r}; expected 'vts' | 'pixi' | 'cubism_native'"
    )
