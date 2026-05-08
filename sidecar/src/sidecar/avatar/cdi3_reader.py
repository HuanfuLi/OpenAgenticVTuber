"""Read Cubism .cdi3.json display names."""

from __future__ import annotations

import json
from pathlib import Path


def read_cdi3_display_names(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        str(entry["Id"]): str(entry.get("Name", ""))
        for entry in data.get("Parameters", [])
        if entry.get("Id")
    }
