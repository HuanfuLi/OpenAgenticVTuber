"""Cubism model3.json extractor for rigs with named expressions."""

from __future__ import annotations

import json
from pathlib import Path

from contracts.avatar_import_plan import ImportWarning
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry
from sidecar.avatar.normalize import is_placeholder_code


def extract_cubism_named(folder: Path) -> tuple[list[VariantEntry], list[EventEntry], list[ImportWarning]]:
    model3_path = next(folder.glob("*.model3.json"))
    data = json.loads(model3_path.read_text(encoding="utf-8"))
    variants = [
        VariantEntry(
            code=str(expr.get("Name", "")).lower(),
            hotkey_id="",
            source_name=str(expr.get("Name", "")),
            is_placeholder=is_placeholder_code(str(expr.get("Name", ""))),
        )
        for expr in data.get("FileReferences", {}).get("Expressions", [])
    ]
    return variants, [], []
