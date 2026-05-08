"""RigCapabilities reflector - v2.0 replacement for AvatarCapabilities.

Reflects writable_param_ids + cdi3_display_names + expressions + hotkeys
from rig source files (.model3.json / .cdi3.json / .vtube.json) at boot time.
"""

from __future__ import annotations

import json
from pathlib import Path

from contracts.rig_capabilities import Expression, Hotkey, RigCapabilities
from sidecar.avatar.cdi3_reader import read_cdi3_display_names
from sidecar.avatar.overrides import AvatarOverrides


def build_rig_capabilities(overrides: AvatarOverrides, rig_dir: Path) -> RigCapabilities:
    writable_ids: set[str] = set()

    model3 = next(rig_dir.glob("*.model3.json"), None)
    if model3 is not None:
        data = json.loads(model3.read_text(encoding="utf-8"))
        for group in data.get("Groups", []):
            for param_id in group.get("Ids", []):
                writable_ids.add(str(param_id))

    vtube = next(rig_dir.glob("*.vtube.json"), None)
    if vtube is not None:
        data = json.loads(vtube.read_text(encoding="utf-8"))
        for setting in data.get("ParameterSettings", []):
            output = setting.get("OutputLive2D")
            if output:
                writable_ids.add(str(output))

    cdi3 = next(rig_dir.glob("*.cdi3.json"), None)
    cdi3_names = read_cdi3_display_names(cdi3) if cdi3 is not None else {}
    writable_ids.update(cdi3_names)
    param_ranges: dict[str, tuple[float, float] | None] = {param_id: None for param_id in writable_ids}

    expressions = [
        Expression(name=variant.code, file=variant.source_name)
        for variant in overrides.variants
    ]
    hotkeys = [
        Hotkey(name=hotkey.name, type=hotkey.type, hotkey_id=hotkey.hotkey_id)
        for hotkey in overrides.discovered_hotkeys
    ]

    return RigCapabilities(
        writable_param_ids=sorted(writable_ids),
        param_ranges=param_ranges,
        expressions=expressions,
        hotkeys=hotkeys,
        cdi3_display_names=cdi3_names,
        sign_inversions=overrides.sign_inversions,
    )


def resolve_source_rig_path(overrides: AvatarOverrides, repo_root: Path) -> Path:
    path = Path(overrides.source_rig_path)
    return path if path.is_absolute() else repo_root / path


def _rig_capabilities_tag_vocabulary(self: RigCapabilities) -> str:
    names = [item.name for item in [*self.expressions, *self.hotkeys]]
    return f"{', '.join(f'[{name}]' for name in names)}," if names else ""


RigCapabilities.tag_vocabulary = _rig_capabilities_tag_vocabulary  # type: ignore[attr-defined]
