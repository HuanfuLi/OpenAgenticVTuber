import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin.avatar import router as avatar_router

test_app = FastAPI()
test_app.include_router(avatar_router)
client = TestClient(test_app)


def test_preserves_carryover(tmp_path, monkeypatch) -> None:
    repo_root = tmp_path / "repo"
    external_source = tmp_path / "external_source"
    runtime_avatar_dir = repo_root / "avatars" / "teto"
    external_source.mkdir()
    runtime_avatar_dir.mkdir(parents=True)
    monkeypatch.setenv("AGENTICLLMVTUBER_REPO_ROOT", str(repo_root))
    (runtime_avatar_dir / "_avatar_overrides.yaml").write_text(
        "body_sway_strategy: proxy_param\n"
        "proxy_body_param: ParamBodyAngleX\n"
        "exp3_body_pose: body.exp3.json\n"
        "sign_inversions: [ParamAngleX]\n"
        "notes:\n"
        "  body_sway_rationale: kept\n"
        "discovered_hotkeys:\n"
        "  - hotkey_id: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n"
        "    name: Old Joy\n"
        "    type: ToggleExpression\n"
        "voice: {backend: piper, model: en_US-amy-medium, lipsync_mode: our-rms}\n"
        "variants: []\n"
        "events: []\n"
        f"source_rig_path: {external_source}\n",
        encoding="utf-8",
    )

    import_resp = client.get("/admin/avatar/import/current?avatar_id=teto")
    assert import_resp.status_code == 200
    plan = import_resp.json()
    assert plan["variants"] == []
    assert plan["events"] == []
    plan["variants"] = [{"code": "new-joy", "hotkey_id": "", "source_name": "New Joy"}]
    plan["events"] = [
        {
            "code": "saved-wave",
            "hotkey_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "motion_file": "wave.motion3.json",
            "duration_seconds": 1.2,
            "duration_is_fallback": False,
            "is_loop": False,
        }
    ]

    commit_resp = client.post("/admin/avatar/import/commit", json=plan)

    assert commit_resp.status_code == 200
    assert commit_resp.json()["path"] == str(runtime_avatar_dir / "_avatar_overrides.yaml")
    assert not (external_source / "_avatar_overrides.yaml").exists()
    data = yaml.safe_load((runtime_avatar_dir / "_avatar_overrides.yaml").read_text(encoding="utf-8"))
    assert data["source_rig_path"] == str(external_source)
    assert data["variants"] == [{"code": "new-joy", "hotkey_id": "", "source_name": "New Joy"}]
    assert data["events"] == [
        {
            "code": "saved-wave",
            "hotkey_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "motion_file": "wave.motion3.json",
            "duration_seconds": 1.2,
            "duration_is_fallback": False,
            "is_loop": False,
        }
    ]
    assert data["body_sway_strategy"] == "proxy_param"
    assert data["proxy_body_param"] == "ParamBodyAngleX"
    assert data["exp3_body_pose"] == "body.exp3.json"
    assert data["sign_inversions"] == ["ParamAngleX"]
    assert data["notes"] == {"body_sway_rationale": "kept"}
    assert data["discovered_hotkeys"][0]["name"] == "Old Joy"
