import yaml

from sidecar.tests.avatar.conftest import REPO_ROOT


def test_round_trip() -> None:
    from sidecar.avatar.overrides import AvatarOverrides

    raw = yaml.safe_load((REPO_ROOT / "avatars" / "teto" / "teto_overrides.yaml").read_text(encoding="utf-8"))
    overrides = AvatarOverrides.model_validate(raw)
    dumped = overrides.model_dump(mode="json")

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
    ]:
        assert dumped[field] == raw[field]


def test_new_v2_fields() -> None:
    from sidecar.avatar.overrides import AvatarOverrides, Voice

    overrides = AvatarOverrides()
    assert overrides.variants == []
    assert overrides.events == []
    assert overrides.voice == Voice()
    assert overrides.source_rig_path == ""


def test_legacy_teto_yaml_via_new_loader() -> None:
    from sidecar.avatar.overrides import load_avatar_overrides

    overrides = load_avatar_overrides(REPO_ROOT / "avatars" / "teto")
    assert overrides.body_sway_strategy == "head_only"
    assert len(overrides.discovered_hotkeys) >= 14
