from __future__ import annotations

from pathlib import Path

from sidecar.plugins.loader import build_action_codes_section
from sidecar.plugins.manifest import PluginManifest


REPO_ROOT = Path(__file__).resolve().parents[3]
PROMPT_PATH = REPO_ROOT / "sidecar" / "src" / "sidecar" / "orchestrator" / "prompts" / "live2d_expression_prompt.txt"


def test_build_action_codes_section_is_sorted_and_stable() -> None:
    manifest = PluginManifest.model_validate(
        {
            "name": "default",
            "version": "1.0.0",
            "entrypoint": "plugin.py:Plugin",
            "api_version": "1.0",
            "action_codes": [
                {"code": "anger", "description": "Show anger through head, eye, and face motion."},
                {"code": "surprise", "description": "Show surprise through head, eye, and face motion."},
            ],
        }
    )

    first = build_action_codes_section(manifest)
    second = build_action_codes_section(manifest)

    assert first == second
    assert first == (
        "## Available Actions (plugin: default v1.0.0)\n"
        "[anger] - Show anger through head, eye, and face motion.\n"
        "[surprise] - Show surprise through head, eye, and face motion."
    )


def test_live2d_prompt_does_not_advertise_joy_or_mandatory_emotion_tags() -> None:
    prompt = PROMPT_PATH.read_text(encoding="utf-8")

    assert "[joy]" not in prompt
    assert "[anger]" not in prompt
    assert "Always begin every response with an emotion tag" not in prompt
    assert "Every response must start with an emotion tag" not in prompt
