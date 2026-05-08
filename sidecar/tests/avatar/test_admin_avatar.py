from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin.avatar import router as avatar_router

test_app = FastAPI()
test_app.include_router(avatar_router)
client = TestClient(test_app)

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_import_teto() -> None:
    resp = client.post("/admin/avatar/import", json={"folder": str(REPO_ROOT / "Live2D" / "重音テト")})

    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_type"] == "vts_standard"
    assert len(data["variants"]) == 14
    assert data["events"] == []
    assert data["default_plugin_action_bindings"] == []
    assert data["avatar_name"] == "重音テト"


def test_import_olvt_includes_default_plugin_action_bindings(olvt_model_dict_path) -> None:
    resp = client.post("/admin/avatar/import", json={"folder": str(olvt_model_dict_path.parent)})

    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_type"] == "olvt"
    assert [(item["action_code"], item["expression_index"]) for item in data["default_plugin_action_bindings"]] == [
        ("neutral", 0),
        ("anger", 2),
        ("disgust", 2),
        ("fear", 1),
        ("joy", 3),
        ("smirk", 3),
        ("sadness", 1),
        ("surprise", 3),
    ]


def test_import_unsupported_5_3(tmp_path) -> None:
    (tmp_path / "fake.moc3").write_bytes(b"MOC3\x06\x00\x00\x00" + b"\x00" * 56)
    (tmp_path / "fake.model3.json").write_text("{}", encoding="utf-8")

    resp = client.post("/admin/avatar/import", json={"folder": str(tmp_path)})

    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_type"] == "unsupported_cubism_5_3"
    assert any(w["kind"] == "cubism_5_3" for w in data["warnings"])


def test_import_invalid_folder() -> None:
    resp = client.post("/admin/avatar/import", json={"folder": "/nonexistent/path"})

    assert resp.status_code == 400


def test_commit_writes_yaml(tmp_path, monkeypatch) -> None:
    repo_root = tmp_path / "repo"
    runtime_avatar_dir = repo_root / "avatars" / "teto"
    runtime_avatar_dir.mkdir(parents=True)
    external_source = tmp_path / "external_source"
    external_source.mkdir()
    monkeypatch.setenv("AGENTICLLMVTUBER_REPO_ROOT", str(repo_root))

    plan = {
        "detected_type": "vts_standard",
        "avatar_id": "teto",
        "avatar_name": "teto",
        "source_rig_path": str(external_source),
        "variants": [
            {"code": "joy", "hotkey_id": "a" * 32, "source_name": "Joy", "is_placeholder": False}
        ],
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
        "voice": {"backend": "piper", "model": "en_US-amy-medium", "lipsync_mode": "our-rms"},
        "warnings": [],
        "existing_overrides": None,
    }

    resp = client.post("/admin/avatar/import/commit", json=plan)

    assert resp.status_code == 200
    assert Path(resp.json()["path"]).as_posix().endswith("avatars/teto/_avatar_overrides.yaml")
    assert resp.json()["path"] == str(runtime_avatar_dir / "_avatar_overrides.yaml")
    assert (runtime_avatar_dir / "_avatar_overrides.yaml").exists()
    assert not (external_source / "_avatar_overrides.yaml").exists()
    assert not (external_source / "_avatar_overrides.yaml.tmp").exists()
    data = yaml.safe_load((runtime_avatar_dir / "_avatar_overrides.yaml").read_text(encoding="utf-8"))
    assert data["source_rig_path"] == str(external_source)
    assert data["variants"] == [{"code": "joy", "hotkey_id": "a" * 32, "source_name": "Joy"}]
    assert data["default_plugin_action_bindings"] == [
        {
            "plugin_name": "default",
            "action_code": "joy",
            "expression_index": 3,
            "expression_name": "",
            "source": "olvt_emotionMap",
        }
    ]
    assert "is_placeholder" not in str(data)


def test_commit_validation_failure(tmp_path, monkeypatch) -> None:
    repo_root = tmp_path / "repo"
    runtime_avatar_dir = repo_root / "avatars" / "teto"
    external_source = tmp_path / "external_source"
    external_source.mkdir()
    monkeypatch.setenv("AGENTICLLMVTUBER_REPO_ROOT", str(repo_root))

    plan = {
        "detected_type": "vts_standard",
        "avatar_id": "teto",
        "avatar_name": "teto",
        "source_rig_path": str(external_source),
        "variants": [{"code": "think", "hotkey_id": "", "source_name": "X", "is_placeholder": False}],
        "events": [],
        "voice": None,
        "warnings": [],
        "existing_overrides": None,
    }

    resp = client.post("/admin/avatar/import/commit", json=plan)

    assert resp.status_code == 400
    assert not (runtime_avatar_dir / "_avatar_overrides.yaml").exists()
    assert not (runtime_avatar_dir / "_avatar_overrides.yaml.tmp").exists()
    assert not (external_source / "_avatar_overrides.yaml").exists()
    assert not (external_source / "_avatar_overrides.yaml.tmp").exists()


def test_get_current(tmp_path, monkeypatch) -> None:
    avatar_dir = tmp_path / "avatars" / "teto"
    avatar_dir.mkdir(parents=True)
    (avatar_dir / "_avatar_overrides.yaml").write_text(
        "source_rig_path: Live2D/重音テト\n"
        "voice: {backend: piper, model: en_US-amy-medium, lipsync_mode: our-rms}\n"
        "variants: []\n"
        "events: []\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("AGENTICLLMVTUBER_REPO_ROOT", str(tmp_path))

    resp = client.get("/admin/avatar/import/current?avatar_id=teto")

    assert resp.status_code == 200
    body = resp.json()
    assert body["detected_type"] == "reedit"
    assert body["existing_overrides"]["source_rig_path"] == "Live2D/重音テト"
    assert body["default_plugin_action_bindings"] == []


def test_get_current_404(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_REPO_ROOT", str(tmp_path))

    resp = client.get("/admin/avatar/import/current?avatar_id=missing")

    assert resp.status_code == 404
