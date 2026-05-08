import yaml
import jsonschema
import pytest

from sidecar.avatar.overrides_writer import write_avatar_overrides_atomic


def _valid_overrides() -> dict:
    return {
        "orphan_params": [],
        "physics_chain_proxies": {},
        "sign_inversions": [],
        "body_sway_strategy": "head_only",
        "proxy_body_param": None,
        "exp3_body_pose": None,
        "param_probes": [],
        "discovered_hotkeys": [],
        "notes": {},
        "voice": {
            "backend": "piper",
            "model": "en_US-amy-medium",
            "lipsync_mode": "our-rms",
        },
        "variants": [{"code": "joy", "hotkey_id": "", "source_name": "Joy"}],
        "events": [],
        "default_plugin_action_bindings": [
            {
                "plugin_name": "default",
                "action_code": "joy",
                "expression_index": 3,
                "expression_name": "",
                "source": "olvt_emotionMap",
            }
        ],
        "source_rig_path": "Live2D/test",
    }


def test_atomic_write(tmp_path) -> None:
    target = tmp_path / "_avatar_overrides.yaml"
    write_avatar_overrides_atomic(target, _valid_overrides())

    assert target.exists()
    assert not (tmp_path / "_avatar_overrides.yaml.tmp").exists()
    assert yaml.safe_load(target.read_text(encoding="utf-8"))["variants"][0]["code"] == "joy"
    assert yaml.safe_load(target.read_text(encoding="utf-8"))["default_plugin_action_bindings"][0]["action_code"] == "joy"


def test_validation_failure_leaves_no_tmp(tmp_path) -> None:
    target = tmp_path / "_avatar_overrides.yaml"
    invalid = _valid_overrides()
    invalid["variants"] = [{"code": "think", "hotkey_id": "", "source_name": "Think"}]

    with pytest.raises(jsonschema.ValidationError):
        write_avatar_overrides_atomic(target, invalid)

    assert not target.exists()
    assert not (tmp_path / "_avatar_overrides.yaml.tmp").exists()


def test_replaces_existing(tmp_path) -> None:
    target = tmp_path / "_avatar_overrides.yaml"
    target.write_text("variants: []\n", encoding="utf-8")

    write_avatar_overrides_atomic(target, _valid_overrides())

    data = yaml.safe_load(target.read_text(encoding="utf-8"))
    assert data["variants"] == [{"code": "joy", "hotkey_id": "", "source_name": "Joy"}]
