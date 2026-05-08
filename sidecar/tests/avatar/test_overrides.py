from pathlib import Path

from sidecar.avatar.overrides import (
    BodySwayStrategyName,
    DiscoveredHotkey,
    ParamProbeResult,
    TetoOverrides,
    load_overrides,
    save_overrides,
)


def test_default_overrides_have_head_only_strategy():
    """D-03: hardcoded compositor default body_sway_strategy is 'head_only'."""

    o = TetoOverrides()
    assert o.body_sway_strategy == "head_only"
    assert o.proxy_body_param is None
    assert o.exp3_body_pose is None
    assert o.param_probes == []
    assert o.discovered_hotkeys == []


def test_load_missing_file_returns_default(tmp_path):
    """Tolerant loader: missing teto_overrides.yaml returns default TetoOverrides."""

    o = load_overrides(tmp_path)
    assert o.body_sway_strategy == "head_only"


def test_save_load_roundtrip(tmp_path):
    o = TetoOverrides(
        body_sway_strategy="proxy_param",
        proxy_body_param="Lean Forward",
        param_probes=[
            ParamProbeResult(
                name="Lean Forward",
                wrote=1.0,
                readback=0.98,
                visible=True,
                orphan_face_tracker=False,
                blend_partial=False,
            ),
        ],
        discovered_hotkeys=[
            DiscoveredHotkey(
                hotkey_id="abc123",
                name="Star Eye [7]",
                type="ToggleExpression",
                file="Star Eye.exp3.json",
                is_meta=False,
                llm_emittable=True,
            ),
        ],
    )
    save_overrides(tmp_path, o)
    loaded = load_overrides(tmp_path)
    assert loaded.model_dump() == o.model_dump()


def test_committed_imported_avatar_overrides_yaml_validates():
    """The committed imported avatar override YAML is the canonical v2 runtime file."""

    repo_root = Path(__file__).resolve().parents[3]
    avatar_dir = repo_root / "avatars" / "重音テト"
    o = load_overrides(avatar_dir)
    assert o.body_sway_strategy in ("head_only", "proxy_param", "exp3_modulation")
    assert len(o.variants) >= 13
    assert o.source_rig_path
    assert (avatar_dir / "_avatar_overrides.yaml").exists()


def test_legacy_teto_overrides_yaml_still_loads_as_fallback(tmp_path):
    legacy = tmp_path / "teto_overrides.yaml"
    legacy.write_text(
        "body_sway_strategy: head_only\n"
        "discovered_hotkeys:\n"
        "- hotkey_id: abc123\n"
        "  name: Star Eye [7]\n"
        "  type: ToggleExpression\n"
        "  file: Star Eye.exp3.json\n"
        "  is_meta: false\n"
        "  llm_emittable: true\n",
        encoding="utf-8",
    )

    o = load_overrides(tmp_path)
    assert o.body_sway_strategy == "head_only"
    assert len(o.discovered_hotkeys) == 1


def test_meta_hotkeys_are_not_llm_emittable():
    h = DiscoveredHotkey(
        hotkey_id="x",
        name="Remove All Toggles",
        type="RemoveAllExpressions",
        file="",
        is_meta=True,
        llm_emittable=False,
    )
    assert not h.llm_emittable


def test_body_sway_strategy_type_importable():
    assert BodySwayStrategyName is not None
