from __future__ import annotations

from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
TETO_OVERRIDES_PATH = REPO_ROOT / "avatars" / "重音テト" / "_avatar_overrides.yaml"


def test_active_teto_catalog_uses_model_owned_variants_without_joy() -> None:
    overrides = yaml.safe_load(TETO_OVERRIDES_PATH.read_text(encoding="utf-8"))

    variant_codes = {variant["code"] for variant in overrides["variants"]}

    assert {"heart-eye", "star-eye"}.issubset(variant_codes)
    assert "joy" not in variant_codes


def test_active_teto_catalog_keeps_default_plugin_bindings_empty() -> None:
    overrides = yaml.safe_load(TETO_OVERRIDES_PATH.read_text(encoding="utf-8"))

    assert overrides["default_plugin_action_bindings"] == []
