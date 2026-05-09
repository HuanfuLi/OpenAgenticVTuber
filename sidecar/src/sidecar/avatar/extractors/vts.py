"""VTube Studio .vtube.json extractor."""

from __future__ import annotations

import json
import math
from pathlib import Path

from contracts.avatar_import_plan import ImportWarning
from contracts.event_entry import EventEntry
from contracts.variant_entry import VariantEntry
from sidecar.avatar.motion3_meta import read_motion3_meta
from sidecar.avatar.normalize import is_placeholder_code, slug_from_hotkey_name

FALLBACK_DURATION_SECONDS = 10.0


def _trigger_animation_duration(folder: Path, motion_file: str) -> tuple[float, bool, bool]:
    try:
        duration_seconds, is_loop = read_motion3_meta(folder / motion_file)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return FALLBACK_DURATION_SECONDS, True, False
    if (
        not math.isfinite(duration_seconds)
        or duration_seconds <= 0
        or duration_seconds > FALLBACK_DURATION_SECONDS
    ):
        return FALLBACK_DURATION_SECONDS, True, False
    return duration_seconds, False, is_loop


def extract_vts(folder: Path) -> tuple[list[VariantEntry], list[EventEntry], list[ImportWarning]]:
    vtube_path = next(folder.glob("*.vtube.json"))
    data = json.loads(vtube_path.read_text(encoding="utf-8"))
    variants: list[VariantEntry] = []
    events: list[EventEntry] = []
    warnings: list[ImportWarning] = []

    for hotkey in data.get("Hotkeys", []):
        action = hotkey.get("Action")
        if action == "ToggleExpression":
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
            continue

        if action == "TriggerAnimation":
            source_name = str(hotkey.get("Name", ""))
            code = slug_from_hotkey_name(source_name)
            motion_file = str(hotkey.get("File") or "")
            duration_seconds, duration_is_fallback, is_loop = _trigger_animation_duration(
                folder, motion_file
            )
            events.append(
                EventEntry(
                    code=code,
                    hotkey_id=str(hotkey.get("HotkeyID") or hotkey.get("hotkeyID") or ""),
                    motion_file=motion_file,
                    duration_seconds=duration_seconds,
                    duration_is_fallback=duration_is_fallback,
                    is_loop=is_loop,
                    is_placeholder=is_placeholder_code(code),
                )
            )
            continue

    return variants, events, warnings
