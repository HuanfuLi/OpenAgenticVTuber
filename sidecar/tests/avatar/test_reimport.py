import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin.avatar import router as avatar_router

test_app = FastAPI()
test_app.include_router(avatar_router)
client = TestClient(test_app)


def test_preserves_carryover(tmp_path) -> None:
    (tmp_path / "existing.model3.json").write_text("{}", encoding="utf-8")
    (tmp_path / "_avatar_overrides.yaml").write_text(
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
        f"source_rig_path: {tmp_path}\n",
        encoding="utf-8",
    )

    import_resp = client.post("/admin/avatar/import", json={"folder": str(tmp_path)})
    assert import_resp.status_code == 200
    plan = import_resp.json()
    plan["variants"] = [{"code": "new-joy", "hotkey_id": "", "source_name": "New Joy"}]

    commit_resp = client.post("/admin/avatar/import/commit", json=plan)

    assert commit_resp.status_code == 200
    data = yaml.safe_load((tmp_path / "_avatar_overrides.yaml").read_text(encoding="utf-8"))
    assert data["variants"] == [{"code": "new-joy", "hotkey_id": "", "source_name": "New Joy"}]
    assert data["body_sway_strategy"] == "proxy_param"
    assert data["proxy_body_param"] == "ParamBodyAngleX"
    assert data["exp3_body_pose"] == "body.exp3.json"
    assert data["sign_inversions"] == ["ParamAngleX"]
    assert data["notes"] == {"body_sway_rationale": "kept"}
    assert data["discovered_hotkeys"][0]["name"] == "Old Joy"
