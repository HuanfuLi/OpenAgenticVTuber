from __future__ import annotations

from pathlib import Path

import yaml
from loguru import logger

from sidecar.plugins.manifest import PluginManifest


def load_manifest(path: Path) -> PluginManifest:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return PluginManifest.model_validate(raw)


def _manifest_paths(root: Path | None) -> list[Path]:
    if root is None or not root.exists():
        return []
    return sorted(root.glob("*/plugin.yaml"))


def discover_manifests(repo_plugins_dir: Path, user_plugins_dir: Path | None) -> dict[str, Path]:
    discovered: dict[str, Path] = {}

    for manifest_path in _manifest_paths(repo_plugins_dir):
        manifest = load_manifest(manifest_path)
        discovered[manifest.name] = manifest_path

    user_seen: dict[str, Path] = {}
    for manifest_path in _manifest_paths(user_plugins_dir):
        manifest = load_manifest(manifest_path)
        if manifest.name in user_seen:
            raise ValueError(
                f"duplicate userData plugin name: {manifest.name} "
                f"({user_seen[manifest.name]} and {manifest_path})"
            )
        user_seen[manifest.name] = manifest_path
        if manifest.name in discovered:
            logger.warning(
                "[PLUGIN-DISCOVERY] userData plugin overrides repo plugin name={} repo_path={} user_path={}",
                manifest.name,
                discovered[manifest.name],
                manifest_path,
            )
        discovered[manifest.name] = manifest_path

    return discovered


def resolve_entrypoint(manifest_path: Path, entrypoint: str) -> tuple[Path, str]:
    module_path, _, class_name = entrypoint.partition(":")
    if not module_path or not class_name:
        raise ValueError("entrypoint must use path.py:ClassName")
    return manifest_path.parent / module_path, class_name


def build_action_codes_section(manifest: PluginManifest) -> str:
    lines = [f"## Available Actions (plugin: {manifest.name} v{manifest.version})"]
    for action_code in sorted(manifest.action_codes, key=lambda item: item.code):
        lines.append(f"[{action_code.code}] - {action_code.description}")
    return "\n".join(lines)


def warn_if_manifest_changed(current: PluginManifest, reloaded: PluginManifest) -> bool:
    current_actions = {action.code: action.description for action in current.action_codes}
    reloaded_actions = {action.code: action.description for action in reloaded.action_codes}
    if current_actions == reloaded_actions:
        return False

    logger.warning(
        "plugin.yaml changed -- restart sidecar to apply "
        "(current session uses boot-time vocabulary)."
    )
    return True
