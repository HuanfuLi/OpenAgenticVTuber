"""Read small metadata fields from Live2D .motion3.json files."""

from __future__ import annotations

import json
from pathlib import Path


def read_motion3_meta(path: Path) -> tuple[float, bool]:
    data = json.loads(path.read_text(encoding="utf-8"))
    meta = data.get("Meta", {})
    duration = float(meta.get("Duration", 0.0))
    if duration > 60:
        raise ValueError(f"motion duration exceeds 60s: {path}")
    return duration, bool(meta.get("Loop", False))
