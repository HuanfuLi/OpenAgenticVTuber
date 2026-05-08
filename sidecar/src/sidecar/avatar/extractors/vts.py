"""VTube Studio .vtube.json extractor."""

from __future__ import annotations

import json
from pathlib import Path

from contracts.avatar_import_plan import ImportWarning
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry
from sidecar.avatar.normalize import is_placeholder_code, slug_from_hotkey_name


def extract_vts(folder: Path) -> tuple[list[VariantEntry], list[EventEntry], list[ImportWarning]]:
    vtube_path = next(folder.glob("*.vtube.json"))
    data = json.loads(vtube_path.read_text(encoding="utf-8"))
    variants: list[VariantEntry] = []
    warnings: list[ImportWarning] = []

    for hotkey in data.get("Hotkeys", []):
        if hotkey.get("Action") != "ToggleExpression":
            continue
        source_name = str(hotkey.get("Name", ""))
        code = slug_from_hotkey_name(source_name)
        hotkey_id = str(hotkey.get("HotkeyID") or hotkey.get("hotkeyID") or "")
        variants.append(
            VariantEntry(
                code=code,
                hotkey_id=hotkey_id,
                source_name=source_name,
                is_placeholder=is_placeholder_code(code),
            )
        )

    return variants, [], warnings
