from __future__ import annotations

from sidecar.stt.model_cache import STTModelCache


def test_model_cache_reports_app_managed_status_and_remove(tmp_path) -> None:
    cache = STTModelCache(cache_root=tmp_path / "stt-models")
    catalog = cache.catalog()
    funasr = next(model for model in catalog.models if model.provider_id == "funasr")

    assert catalog.cache_root_display.endswith("stt-models")
    assert funasr.status == "not_downloaded"
    assert funasr.recommended is True

    path = cache.model_path("funasr", "iic/SenseVoiceSmall")
    path.mkdir(parents=True)
    (path / "model.bin").write_bytes(b"model")
    assert next(model for model in cache.catalog().models if model.provider_id == "funasr").status == "downloaded"

    result = cache.remove("funasr", "iic/SenseVoiceSmall")

    assert result.ok is True
    assert result.status == "not_downloaded"
    assert not path.exists()


def test_model_cache_sanitizes_model_ids_under_cache_root(tmp_path) -> None:
    cache = STTModelCache(cache_root=tmp_path / "cache")
    path = cache.model_path("funasr", "../../secret")

    assert path.is_relative_to((tmp_path / "cache").resolve())
    assert ".." not in path.name


def test_model_cache_does_not_treat_empty_or_placeholder_directory_as_downloaded(tmp_path) -> None:
    cache = STTModelCache(cache_root=tmp_path / "cache")
    path = cache.model_path("funasr", "iic/SenseVoiceSmall")
    path.mkdir(parents=True)

    model = next(model for model in cache.catalog().models if model.provider_id == "funasr")
    assert model.status == "incomplete"
    assert "does not contain usable model files" in model.summary

    (path / ".agenticllmvtuber-model-cache.json").write_text('{"status":"downloaded"}', encoding="utf-8")

    model = next(model for model in cache.catalog().models if model.provider_id == "funasr")
    assert model.status == "incomplete"


def test_model_cache_download_writes_real_model_files(tmp_path, monkeypatch) -> None:
    cache = STTModelCache(cache_root=tmp_path / "cache")
    path = cache.model_path("funasr", "iic/SenseVoiceSmall")

    def fake_download(provider_id: str, model_id: str, destination) -> None:
        assert provider_id == "funasr"
        assert model_id == "iic/SenseVoiceSmall"
        destination.mkdir(parents=True)
        (destination / "model.bin").write_bytes(b"model")

    monkeypatch.setattr("sidecar.stt.model_cache.download_local_stt_model", fake_download)
    result = cache.download("funasr", "iic/SenseVoiceSmall")

    assert result.ok is True
    assert result.status == "downloaded"
    assert path.exists()
    assert "downloaded" in result.summary


def test_model_cache_download_failure_never_reports_downloaded(tmp_path, monkeypatch) -> None:
    cache = STTModelCache(cache_root=tmp_path / "cache")

    def fake_download(_provider_id: str, _model_id: str, _destination) -> None:
        raise RuntimeError("network down")

    monkeypatch.setattr("sidecar.stt.model_cache.download_local_stt_model", fake_download)
    result = cache.download("funasr", "iic/SenseVoiceSmall")

    assert result.ok is False
    assert result.status == "not_downloaded"
    assert "STT model download failed" in result.summary
