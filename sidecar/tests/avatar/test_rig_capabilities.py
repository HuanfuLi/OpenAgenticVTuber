from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_build_from_teto(teto_dir) -> None:
    from sidecar.avatar.overrides import load_avatar_overrides
    from sidecar.avatar.rig_capabilities import build_rig_capabilities

    overrides = load_avatar_overrides(REPO_ROOT / "avatars" / "teto")
    caps = build_rig_capabilities(overrides, teto_dir)
    assert len(caps.writable_param_ids) > 50
    assert len(caps.cdi3_display_names) > 50
    assert "ParamMouthOpenY" in caps.writable_param_ids
    assert all(isinstance(r, type(None)) or isinstance(r, tuple) for r in caps.param_ranges.values())
    assert caps.sign_inversions == overrides.sign_inversions
