from __future__ import annotations

import inspect
from pathlib import Path
from types import SimpleNamespace

from sidecar.plugins import loader
from sidecar.plugins.loader import load_manifest


def _write_manifest(plugin_dir: Path, *, description: str = "Show joy.") -> Path:
    plugin_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = plugin_dir / "plugin.yaml"
    manifest_path.write_text(
        f"""
name: default
version: 1.0.0
entrypoint: plugin.py:Plugin
api_version: "1.0"
action_codes:
  - code: joy
    description: {description}
""".lstrip(),
        encoding="utf-8",
    )
    return manifest_path


def test_manifest_change_handler_warns_for_action_description_change(tmp_path: Path, caplog) -> None:
    manifest_path = _write_manifest(tmp_path / "default", description="Show joy.")
    boot_manifest = load_manifest(manifest_path)
    manifest_path.write_text(
        """
name: default
version: 1.0.0
entrypoint: plugin.py:Plugin
api_version: "1.0"
action_codes:
  - code: joy
    description: Stronger joy.
""".lstrip(),
        encoding="utf-8",
    )
    handler = loader._ManifestFileEventHandler(manifest_path, boot_manifest)

    with caplog.at_level("WARNING"):
        handler.on_modified(SimpleNamespace(src_path=str(manifest_path), is_directory=False))

    assert "restart sidecar to apply" in caplog.text


def test_manifest_change_handler_ignores_unrelated_file(tmp_path: Path, caplog) -> None:
    manifest_path = _write_manifest(tmp_path / "default")
    boot_manifest = load_manifest(manifest_path)
    handler = loader._ManifestFileEventHandler(manifest_path, boot_manifest)

    with caplog.at_level("WARNING"):
        handler.on_modified(SimpleNamespace(src_path=str(tmp_path / "other.yaml"), is_directory=False))

    assert caplog.text == ""


def test_manifest_change_handler_logs_invalid_yaml_without_raising(tmp_path: Path, caplog) -> None:
    manifest_path = _write_manifest(tmp_path / "default")
    boot_manifest = load_manifest(manifest_path)
    manifest_path.write_text("name: [", encoding="utf-8")
    handler = loader._ManifestFileEventHandler(manifest_path, boot_manifest)

    with caplog.at_level("WARNING"):
        handler.on_modified(SimpleNamespace(src_path=str(manifest_path), is_directory=False))

    assert "[PLUGIN-MANIFEST-WATCH]" in caplog.text


def test_manifest_watcher_helper_does_not_rebuild_prompt() -> None:
    source = inspect.getsource(loader.start_manifest_change_watcher)

    assert "build_action_codes_section" not in source
    assert "warn_if_manifest_changed" in inspect.getsource(loader._ManifestFileEventHandler)
