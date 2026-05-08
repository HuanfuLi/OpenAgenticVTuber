from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins.api import BodyMotionPlugin
from sidecar.plugins.loader import discover_manifests, load_manifest, resolve_entrypoint


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PLUGIN_DIR = REPO_ROOT / "plugins" / "default"


def _load_default_plugin_class() -> type[BodyMotionPlugin]:
    manifests = discover_manifests(REPO_ROOT / "plugins", None)
    manifest_path = manifests["default"]
    manifest = load_manifest(manifest_path)
    entrypoint_path, class_name = resolve_entrypoint(manifest_path, manifest.entrypoint)

    spec = importlib.util.spec_from_file_location("test_default_plugin_entrypoint", entrypoint_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    plugin_class = getattr(module, class_name)
    assert issubclass(plugin_class, BodyMotionPlugin)
    return plugin_class


def test_default_manifest_declares_olvt_action_codes() -> None:
    manifest = load_manifest(DEFAULT_PLUGIN_DIR / "plugin.yaml")

    assert manifest.name == "default"
    assert manifest.version == "1.0.0"
    assert manifest.entrypoint == "__init__.py:DefaultPlugin"
    assert [action.code for action in manifest.action_codes] == [
        "anger",
        "disgust",
        "fear",
        "joy",
        "neutral",
        "sadness",
        "smirk",
        "surprise",
    ]


@pytest.mark.asyncio
async def test_default_plugin_loads_from_file_path_without_install_step() -> None:
    plugin_class = _load_default_plugin_class()
    plugin = plugin_class()

    capabilities = RigCapabilities(writable_param_ids=["FaceAngleZ"])
    overrides = AvatarOverrides()
    plugin.on_load(capabilities, overrides)

    assert plugin.capabilities is capabilities
    assert plugin.overrides is overrides
    assert [frame async for frame in plugin.on_token_stream("plain sentence")] == []

    plugin.on_unload()
    assert plugin.capabilities is None
    assert plugin.overrides is None
