import yaml
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def _drop_default_false_flags(value):
    if isinstance(value, dict):
        return {
            key: _drop_default_false_flags(item)
            for key, item in value.items()
            if not (key == "is_placeholder" and item is False)
        }
    if isinstance(value, list):
        return [_drop_default_false_flags(item) for item in value]
    return value


def test_canonical_imported_avatar_round_trip() -> None:
    from sidecar.avatar.overrides import AvatarOverrides

    raw = yaml.safe_load((REPO_ROOT / "avatars" / "重音テト" / "_avatar_overrides.yaml").read_text(encoding="utf-8"))
    overrides = AvatarOverrides.model_validate(raw)
    dumped = _drop_default_false_flags(overrides.model_dump(mode="json"))

    for field in [
        "sign_inversions",
        "body_sway_strategy",
        "proxy_body_param",
        "exp3_body_pose",
        "orphan_params",
        "physics_chain_proxies",
        "param_probes",
        "discovered_hotkeys",
        "notes",
        "voice",
        "variants",
        "events",
        "default_plugin_action_bindings",
        "source_rig_path",
    ]:
        assert dumped[field] == raw[field]


def test_new_v2_fields() -> None:
    from sidecar.avatar.overrides import AvatarOverrides, Voice

    overrides = AvatarOverrides()
    assert overrides.variants == []
    assert overrides.events == []
    assert overrides.voice == Voice()
    assert overrides.source_rig_path == ""


def test_imported_avatar_yaml_via_new_loader() -> None:
    from sidecar.avatar.overrides import load_avatar_overrides

    overrides = load_avatar_overrides(REPO_ROOT / "avatars" / "重音テト")
    assert overrides.body_sway_strategy == "head_only"
    assert len(overrides.variants) >= 13
    assert overrides.source_rig_path
