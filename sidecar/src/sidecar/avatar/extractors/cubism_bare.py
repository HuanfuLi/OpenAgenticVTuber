"""Cubism model3.json extractor for rigs without expression names."""

from __future__ import annotations

import json
from pathlib import Path

from contracts.avatar_import_plan import ImportWarning
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry
from sidecar.avatar.motion3_meta import read_motion3_meta
from sidecar.avatar.normalize import slug_from_hotkey_name


def extract_cubism_bare(folder: Path) -> tuple[list[VariantEntry], list[EventEntry], list[ImportWarning]]:
    model3_path = next(folder.glob("*.model3.json"))
    data = json.loads(model3_path.read_text(encoding="utf-8"))
    events: list[EventEntry] = []

    for group, entries in data.get("FileReferences", {}).get("Motions", {}).items():
        if group.lower() == "idle":
            continue
        for entry in entries:
            motion_file = str(entry.get("File", ""))
            motion_path = folder / motion_file
            duration, is_loop = read_motion3_meta(motion_path)
            code_source = group or Path(motion_file).stem
            events.append(
                EventEntry(
                    code=slug_from_hotkey_name(code_source),
                    motion_file=motion_file,
                    duration_seconds=duration,
                    is_loop=is_loop,
                    is_placeholder=False,
                )
            )

    return [], events, []
