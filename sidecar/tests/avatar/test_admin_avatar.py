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
    assert data["avatar_name"] == "重音テト"


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


def test_commit_writes_yaml(tmp_path) -> None:
    plan = {
        "detected_type": "vts_standard",
        "avatar_id": "test",
        "avatar_name": "test",
        "source_rig_path": str(tmp_path),
        "variants": [
            {"code": "joy", "hotkey_id": "a" * 32, "source_name": "Joy", "is_placeholder": False}
        ],
        "events": [],
        "voice": {"backend": "piper", "model": "en_US-amy-medium", "lipsync_mode": "our-rms"},
        "warnings": [],
        "existing_overrides": None,
    }

    resp = client.post("/admin/avatar/import/commit", json=plan)

    assert resp.status_code == 200
    data = yaml.safe_load((tmp_path / "_avatar_overrides.yaml").read_text(encoding="utf-8"))
    assert data["variants"] == [{"code": "joy", "hotkey_id": "a" * 32, "source_name": "Joy"}]


def test_commit_validation_failure(tmp_path) -> None:
    plan = {
        "detected_type": "vts_standard",
        "avatar_id": "test",
        "avatar_name": "test",
        "source_rig_path": str(tmp_path),
        "variants": [{"code": "think", "hotkey_id": "", "source_name": "X", "is_placeholder": False}],
        "events": [],
        "voice": None,
        "warnings": [],
        "existing_overrides": None,
    }

    resp = client.post("/admin/avatar/import/commit", json=plan)

    assert resp.status_code == 400
    assert not (tmp_path / "_avatar_overrides.yaml").exists()
    assert not (tmp_path / "_avatar_overrides.yaml.tmp").exists()


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


def test_get_current_404(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_REPO_ROOT", str(tmp_path))

    resp = client.get("/admin/avatar/import/current?avatar_id=missing")

    assert resp.status_code == 404
