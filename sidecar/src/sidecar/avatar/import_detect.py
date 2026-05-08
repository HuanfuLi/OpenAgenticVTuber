"""Avatar import type detection."""

from __future__ import annotations

import json
from enum import Enum
from pathlib import Path


class AvatarType(str, Enum):
    OLVT = "olvt"
    VTS_STANDARD = "vts_standard"
    CUBISM_WITH_EXPRESSIONS = "cubism_with_expressions"
    CUBISM_BARE = "cubism_bare"
    UNSUPPORTED_CUBISM_5_3 = "unsupported_cubism_5_3"
    UNSUPPORTED_NO_MODEL3 = "unsupported_no_model3"


def is_cubism_5_3_moc(moc3: Path) -> bool:
    """Return True when the MOC3 header version byte is Cubism 5.3+."""

    try:
        with moc3.open("rb") as f:
            header = f.read(8)
    except OSError:
        return False
    if len(header) < 8 or header[:4] != b"MOC3":
        return False
    return header[4] >= 6


def _model3_has_expressions(model3_path: Path) -> bool:
    try:
        data = json.loads(model3_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return bool(data.get("FileReferences", {}).get("Expressions", []))


def detect_type(folder: Path) -> AvatarType:
    """Classify an avatar folder using the Phase 8 ordered shape ladder."""

    if (folder / "model_dict.json").exists():
        return AvatarType.OLVT

    model3 = next(folder.glob("*.model3.json"), None)
    if model3 is None:
        return AvatarType.UNSUPPORTED_NO_MODEL3

    moc3 = next(folder.glob("*.moc3"), None)
    if moc3 is not None and is_cubism_5_3_moc(moc3):
        return AvatarType.UNSUPPORTED_CUBISM_5_3

    if any(folder.glob("*.vtube.json")):
        return AvatarType.VTS_STANDARD

    if _model3_has_expressions(model3):
        return AvatarType.CUBISM_WITH_EXPRESSIONS

    return AvatarType.CUBISM_BARE
