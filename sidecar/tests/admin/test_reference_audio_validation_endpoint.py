from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin import audio as audio_module


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(audio_module.router)
    return TestClient(app)


def _payload(path: Path, basename: str = "voice.wav") -> dict[str, str]:
    return {
        "managed_path": str(path),
        "display_basename": basename,
        "transcript_text": "hello reference",
        "language": "en",
    }


def test_reference_audio_validation_rejects_missing_file(tmp_path: Path) -> None:
    missing = tmp_path / "missing.wav"
    with _client() as client:
        body = client.post("/admin/audio/reference-audio/validate", json=_payload(missing)).json()

    assert body["ok"] is False
    assert body["errors"] == [{"code": "missing_file", "message": "Reference audio file does not exist."}]
    assert str(tmp_path) not in body["redacted_diagnostics"]


def test_reference_audio_validation_rejects_unsupported_extension(tmp_path: Path) -> None:
    candidate = tmp_path / "voice.txt"
    candidate.write_text("not audio", encoding="utf-8")

    with _client() as client:
        body = client.post("/admin/audio/reference-audio/validate", json=_payload(candidate, "voice.txt")).json()

    assert body["ok"] is False
    assert body["errors"][0]["code"] == "unsupported_format"


def test_reference_audio_validation_rejects_unreadable_metadata(
    tmp_path: Path, monkeypatch
) -> None:
    candidate = tmp_path / "voice.wav"
    candidate.write_bytes(b"not a wav")

    def _raise(_path: str):
        raise RuntimeError(f"cannot read {candidate}")

    monkeypatch.setattr(audio_module.soundfile, "info", _raise)

    with _client() as client:
        body = client.post("/admin/audio/reference-audio/validate", json=_payload(candidate)).json()

    assert body["ok"] is False
    assert body["errors"][0]["code"] == "unreadable_metadata"
    assert str(candidate) not in body["redacted_diagnostics"]


def test_reference_audio_validation_rejects_duration_outside_bounds(
    tmp_path: Path, monkeypatch
) -> None:
    too_short = tmp_path / "short.wav"
    too_short.write_bytes(b"audio")
    too_long = tmp_path / "long.wav"
    too_long.write_bytes(b"audio")

    monkeypatch.setattr(
        audio_module.soundfile,
        "info",
        lambda path: SimpleNamespace(
            format="WAV",
            duration=0.5 if str(path).endswith("short.wav") else 31.0,
            samplerate=24_000,
            channels=1,
        ),
    )

    with _client() as client:
        short_body = client.post("/admin/audio/reference-audio/validate", json=_payload(too_short)).json()
        long_body = client.post("/admin/audio/reference-audio/validate", json=_payload(too_long)).json()

    assert short_body["ok"] is False
    assert short_body["errors"][0]["code"] == "duration_too_short"
    assert long_body["ok"] is False
    assert long_body["errors"][0]["code"] == "duration_too_long"


def test_reference_audio_validation_accepts_soundfile_readable_supported_formats(
    tmp_path: Path, monkeypatch
) -> None:
    candidates = [tmp_path / f"voice.{ext}" for ext in ("wav", "flac", "mp3", "ogg")]
    for candidate in candidates:
        candidate.write_bytes(b"audio")

    monkeypatch.setattr(
        audio_module.soundfile,
        "info",
        lambda path: SimpleNamespace(format=Path(path).suffix[1:].upper(), duration=3.25, samplerate=24_000, channels=1),
    )

    with _client() as client:
        bodies = [client.post("/admin/audio/reference-audio/validate", json=_payload(candidate)).json() for candidate in candidates]

    assert [body["ok"] for body in bodies] == [True, True, True, True]
    assert [body["format"] for body in bodies] == ["wav", "flac", "mp3", "ogg"]
    assert bodies[0]["duration_seconds"] == 3.25
    assert bodies[0]["sample_rate"] == 24_000
    assert bodies[0]["channels"] == 1
    assert str(tmp_path) not in bodies[0]["redacted_diagnostics"]
