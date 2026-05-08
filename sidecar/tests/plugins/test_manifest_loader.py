from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from sidecar.plugins.loader import discover_manifests, load_manifest, resolve_entrypoint, warn_if_manifest_changed
from sidecar.plugins.manifest import PluginManifest


def _write_manifest(plugin_dir: Path, name: str, *, code: str = "joy", api_version: str = "1.0") -> Path:
    plugin_dir.mkdir(parents=True)
    path = plugin_dir / "plugin.yaml"
    path.write_text(
        f"""
name: {name}
version: 1.0.0
entrypoint: plugin.py:Plugin
api_version: "{api_version}"
action_codes:
  - code: {code}
    description: Show joy.
""".lstrip(),
        encoding="utf-8",
    )
    (plugin_dir / "plugin.py").write_text("class Plugin: pass\n", encoding="utf-8")
    return path


def test_discover_manifests_uses_user_plugin_precedence(tmp_path: Path) -> None:
    repo_path = _write_manifest(tmp_path / "repo" / "default", "default", code="neutral")
    user_path = _write_manifest(tmp_path / "user" / "default-copy", "default", code="joy")

    discovered = discover_manifests(tmp_path / "repo", tmp_path / "user")

    assert discovered == {"default": user_path}
    assert discovered["default"] != repo_path


def test_discover_manifests_fails_on_duplicate_user_plugin_names(tmp_path: Path) -> None:
    _write_manifest(tmp_path / "user" / "one", "default", code="joy")
    _write_manifest(tmp_path / "user" / "two", "default", code="neutral")

    with pytest.raises(ValueError, match="duplicate userData plugin name"):
        discover_manifests(tmp_path / "missing-repo", tmp_path / "user")


def test_manifest_rejects_reserved_and_bracketed_action_codes() -> None:
    with pytest.raises(ValidationError, match="reserved"):
        PluginManifest.model_validate(
            {
                "name": "default",
                "version": "1.0.0",
                "entrypoint": "plugin.py:Plugin",
                "api_version": "1.0",
                "action_codes": [{"code": "system", "description": "Reserved."}],
            }
        )

    with pytest.raises(ValidationError, match="brackets"):
        PluginManifest.model_validate(
            {
                "name": "default",
                "version": "1.0.0",
                "entrypoint": "plugin.py:Plugin",
                "api_version": "1.0",
                "action_codes": [{"code": "[joy]", "description": "Bracketed."}],
            }
        )


def test_manifest_rejects_duplicate_action_codes_and_incompatible_major_api() -> None:
    with pytest.raises(ValidationError, match="duplicate action code"):
        PluginManifest.model_validate(
            {
                "name": "default",
                "version": "1.0.0",
                "entrypoint": "plugin.py:Plugin",
                "api_version": "1.0",
                "action_codes": [
                    {"code": "joy", "description": "Joy."},
                    {"code": "joy", "description": "Duplicate."},
                ],
            }
        )

    with pytest.raises(ValidationError, match="incompatible"):
        PluginManifest.model_validate(
            {
                "name": "default",
                "version": "1.0.0",
                "entrypoint": "plugin.py:Plugin",
                "api_version": "2.0",
                "action_codes": [{"code": "joy", "description": "Joy."}],
            }
        )


def test_load_manifest_and_resolve_entrypoint(tmp_path: Path) -> None:
    manifest_path = _write_manifest(tmp_path / "default", "default")

    manifest = load_manifest(manifest_path)
    entrypoint_path, class_name = resolve_entrypoint(manifest_path, manifest.entrypoint)

    assert manifest.name == "default"
    assert entrypoint_path == manifest_path.parent / "plugin.py"
    assert class_name == "Plugin"


def test_warn_if_manifest_changed_for_prompt_affecting_changes() -> None:
    current = PluginManifest.model_validate(
        {
            "name": "default",
            "version": "1.0.0",
            "entrypoint": "plugin.py:Plugin",
            "api_version": "1.0",
            "action_codes": [{"code": "joy", "description": "Joy."}],
        }
    )
    changed = PluginManifest.model_validate(
        {
            "name": "default",
            "version": "1.0.0",
            "entrypoint": "plugin.py:Plugin",
            "api_version": "1.0",
            "action_codes": [{"code": "joy", "description": "Different."}],
        }
    )

    assert warn_if_manifest_changed(current, changed) is True
