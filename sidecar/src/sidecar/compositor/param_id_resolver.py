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

VTS_TRACKING_INPUT_PARAM_IDS = frozenset(
    {
        "FaceAngleX",
        "FaceAngleY",
        "FaceAngleZ",
        "FacePositionX",
        "FacePositionY",
        "FacePositionZ",
        "EyeLeftX",
        "EyeLeftY",
        "EyeRightX",
        "EyeRightY",
        "EyeOpenLeft",
        "EyeOpenRight",
        "MouthOpen",
        "MouthSmile",
        "Brows",
        "BrowsLeftY",
        "BrowsRightY",
    }
)

VTS_TRACKING_INPUT_PARAM_RANGES = {
    "FaceAngleX": (-30.0, 30.0),
    "FaceAngleY": (-30.0, 30.0),
    "FaceAngleZ": (-30.0, 30.0),
    "FacePositionX": (-1.0, 1.0),
    "FacePositionY": (-1.0, 1.0),
    "FacePositionZ": (-3.0, 3.0),
    "EyeLeftX": (-1.0, 1.0),
    "EyeLeftY": (-1.0, 1.0),
    "EyeRightX": (-1.0, 1.0),
    "EyeRightY": (-1.0, 1.0),
    "EyeOpenLeft": (-1.0, 1.0),
    "EyeOpenRight": (-1.0, 1.0),
    "MouthOpen": (0.0, 1.0),
    "MouthSmile": (-1.0, 1.0),
    "Brows": (-1.0, 1.0),
    "BrowsLeftY": (-1.0, 1.0),
    "BrowsRightY": (-1.0, 1.0),
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
