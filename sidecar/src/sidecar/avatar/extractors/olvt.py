"""OpenLLM-VTuber model_dict.json extractor.

Pinned to OpenLLM_Vtuber 12d42d7 (2026-05-05). Per Phase 8 D-A2-3,
emotionMap is intentionally ignored; only actionMap produces variants.
"""

from __future__ import annotations

import json
from pathlib import Path

from contracts.avatar_import_plan import ImportWarning
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry
from sidecar.avatar.normalize import is_placeholder_code, slug_from_hotkey_name


def extract_olvt(path: Path) -> tuple[list[VariantEntry], list[EventEntry], list[ImportWarning]]:
    model_dict_path = path / "model_dict.json" if path.is_dir() else path
    data = json.loads(model_dict_path.read_text(encoding="utf-8"))
    variants: list[VariantEntry] = []

    for model in data:
        action_map = model.get("actionMap")
        if not action_map:
            continue
        for code, source_name in action_map.items():
            normalized = slug_from_hotkey_name(str(code))
            variants.append(
                VariantEntry(
                    code=normalized,
                    hotkey_id="",
                    source_name=str(source_name),
                    is_placeholder=is_placeholder_code(normalized),
                )
            )
        break

    return variants, [], []
