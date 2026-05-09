from __future__ import annotations

from pathlib import Path

from contracts import AvatarOverrides, EventEntry, VariantEntry
from sidecar.plugins.loader import build_action_codes_section, build_dispatch_codes_section
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


def _dispatch_manifest() -> PluginManifest:
    return PluginManifest.model_validate(
        {
            "name": "default",
            "version": "1.0.0",
            "entrypoint": "plugin.py:Plugin",
            "api_version": "1.0",
            "action_codes": [
                {"code": "smirk", "description": "Show a sly smile."},
                {"code": "neutral", "description": "Return to a neutral expression."},
            ],
        }
    )


def test_build_dispatch_codes_section_lists_all_categories_in_sorted_order() -> None:
    overrides = AvatarOverrides(
        variants=[
            VariantEntry(
                code="heart-eye",
                hotkey_id="hk-v",
                source_name="Heart Eye",
            )
        ],
        events=[
            EventEntry(
                code="wave",
                hotkey_id="hk-e",
                motion_file="wave.motion3.json",
                duration_seconds=1.5,
            )
        ],
    )

    section = build_dispatch_codes_section(_dispatch_manifest(), overrides)

    assert section == (
        "## Available Dispatch Codes\n"
        "### Plugin Actions\n"
        "[neutral] - Return to a neutral expression.\n"
        "[smirk] - Show a sly smile.\n"
        "### Avatar Variants\n"
        "{heart-eye} - Heart Eye\n"
        "### Avatar Events\n"
        "<wave> - wave.motion3.json (duration: 1.5s)"
    )


def test_build_dispatch_codes_section_reports_empty_event_catalog() -> None:
    overrides = AvatarOverrides(
        variants=[
            VariantEntry(
                code="heart-eye",
                hotkey_id="hk-v",
                source_name="Heart Eye",
            )
        ],
        events=[],
    )

    section = build_dispatch_codes_section(_dispatch_manifest(), overrides)

    assert "No avatar event codes are declared for the active avatar." in section
    assert "{heart-eye} - Heart Eye" in section
    assert "[smirk] - Show a sly smile." in section


def test_live2d_prompt_does_not_advertise_joy_or_mandatory_emotion_tags() -> None:
    prompt = PROMPT_PATH.read_text(encoding="utf-8")

    assert "[joy]" not in prompt
    assert "[anger]" not in prompt
    assert "Always begin every response with an emotion tag" not in prompt
    assert "Every response must start with an emotion tag" not in prompt


def test_live2d_prompt_uses_dispatch_catalog_placeholder_and_all_delimiters() -> None:
    prompt = PROMPT_PATH.read_text(encoding="utf-8")

    assert "[<insert_dispatch_codes_section>]" in prompt
    assert "[<insert_action_codes_section>]" not in prompt
    assert "[action]" in prompt
    assert "{variant}" in prompt
    assert "<event>" in prompt
    assert "Do not invent action codes or use labels that are not listed above." in prompt
    assert (
        "Do not add model variant or event tags unless they are explicitly provided by another instruction."
        not in prompt
    )
