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

