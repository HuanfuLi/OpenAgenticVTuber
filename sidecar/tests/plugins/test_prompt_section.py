from __future__ import annotations

from sidecar.plugins.loader import build_action_codes_section
from sidecar.plugins.manifest import PluginManifest


def test_build_action_codes_section_is_sorted_and_stable() -> None:
    manifest = PluginManifest.model_validate(
        {
            "name": "default",
            "version": "1.0.0",
            "entrypoint": "plugin.py:Plugin",
            "api_version": "1.0",
            "action_codes": [
                {"code": "joy", "description": "Show joy through head, eye, and face motion."},
                {"code": "anger", "description": "Show anger through head, eye, and face motion."},
            ],
        }
    )

    first = build_action_codes_section(manifest)
    second = build_action_codes_section(manifest)

    assert first == second
    assert first == (
        "## Available Actions (plugin: default v1.0.0)\n"
        "[anger] - Show anger through head, eye, and face motion.\n"
        "[joy] - Show joy through head, eye, and face motion."
    )
