"""OpenLLM-VTuber model_dict.json extractor."""

from __future__ import annotations

import json
from pathlib import Path

from contracts.action_binding import DefaultPluginActionBinding
from contracts.avatar_import_plan import ImportWarning
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry
from sidecar.avatar.normalize import is_placeholder_code, slug_from_hotkey_name


def extract_olvt(
    path: Path,
) -> tuple[
    list[VariantEntry],
    list[EventEntry],
    list[DefaultPluginActionBinding],
    list[ImportWarning],
]:
    model_dict_path = path / "model_dict.json" if path.is_dir() else path
    data = json.loads(model_dict_path.read_text(encoding="utf-8"))
    variants: list[VariantEntry] = []
    bindings: list[DefaultPluginActionBinding] = []

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
        for code, expression_index in (model.get("emotionMap") or {}).items():
            bindings.append(
                DefaultPluginActionBinding(
                    action_code=str(code),
                    expression_index=int(expression_index),
                    expression_name="",
                    source="olvt_emotionMap",
                    plugin_name="default",
                )
            )
        break

    return variants, [], bindings, []
