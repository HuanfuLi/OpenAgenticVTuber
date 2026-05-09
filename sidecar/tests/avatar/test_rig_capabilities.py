from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_build_from_teto(teto_dir) -> None:
    from sidecar.avatar.overrides import load_avatar_overrides
    from sidecar.avatar.rig_capabilities import build_rig_capabilities

    overrides = load_avatar_overrides(REPO_ROOT / "avatars" / "teto")
    caps = build_rig_capabilities(overrides, teto_dir)
    assert len(caps.writable_param_ids) > 50
    assert len(caps.cdi3_display_names) > 50
    assert "FaceAngleX" in caps.writable_param_ids
    assert "ParamMouthOpenY" in caps.writable_param_ids
    assert caps.param_ranges["FaceAngleX"] == (-30.0, 30.0)
    assert all(
        isinstance(r, type(None)) or isinstance(r, tuple)
        for r in caps.param_ranges.values()
    )
    assert caps.sign_inversions == overrides.sign_inversions
    assert caps.default_plugin_action_bindings == overrides.default_plugin_action_bindings


def test_build_copies_default_plugin_action_bindings(teto_dir) -> None:
    from contracts.action_binding import DefaultPluginActionBinding
    from sidecar.avatar.overrides import AvatarOverrides
    from sidecar.avatar.rig_capabilities import build_rig_capabilities

    overrides = AvatarOverrides(
        default_plugin_action_bindings=[
            DefaultPluginActionBinding(action_code="joy", expression_index=3)
        ]
    )

    caps = build_rig_capabilities(overrides, teto_dir)

    assert caps.default_plugin_action_bindings == overrides.default_plugin_action_bindings
