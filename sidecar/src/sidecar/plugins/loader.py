from __future__ import annotations

from pathlib import Path

import yaml
from loguru import logger
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer
from watchdog.observers.api import BaseObserver

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


class _ManifestFileEventHandler(FileSystemEventHandler):
    def __init__(self, manifest_path: Path, boot_manifest: PluginManifest) -> None:
        self._manifest_path = manifest_path.resolve()
        self._boot_manifest = boot_manifest

    def on_created(self, event: FileSystemEvent) -> None:
        self._handle_event(event)

    def on_modified(self, event: FileSystemEvent) -> None:
        self._handle_event(event)

    def on_moved(self, event: FileSystemEvent) -> None:
        self._handle_event(event)

    def _handle_event(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if not self._matches_active_manifest(event):
            return

        try:
            reloaded = load_manifest(self._manifest_path)
        except Exception as exc:  # noqa: BLE001 -- watcher must stay alive on malformed edits
            logger.warning("[PLUGIN-MANIFEST-WATCH] failed to reload {}: {}", self._manifest_path, exc)
            return
        warn_if_manifest_changed(self._boot_manifest, reloaded)

    def _matches_active_manifest(self, event: FileSystemEvent) -> bool:
        paths = [Path(str(event.src_path))]
        dest_path = getattr(event, "dest_path", None)
        if dest_path:
            paths.append(Path(str(dest_path)))
        return any(path.resolve() == self._manifest_path for path in paths)


class ManifestChangeWatcher:
    def __init__(self, observer: BaseObserver) -> None:
        self._observer = observer

    def stop(self) -> None:
        self._observer.stop()
        self._observer.join()


def start_manifest_change_watcher(
    manifest_path: Path,
    boot_manifest: PluginManifest,
) -> ManifestChangeWatcher:
    active_manifest_path = manifest_path.resolve()
    handler = _ManifestFileEventHandler(active_manifest_path, boot_manifest)
    observer = Observer()
    observer.schedule(handler, str(active_manifest_path.parent), recursive=False)
    observer.start()
    return ManifestChangeWatcher(observer)
