from __future__ import annotations

import sys

from contracts import STTProviderConfig
from sidecar.stt.registry import STTProviderRegistry


def test_registry_catalog_is_lightweight_and_marks_defaults() -> None:
    before = set(sys.modules)
    catalog = STTProviderRegistry().catalog()
    after = set(sys.modules)
    providers = {provider.provider_id: provider for provider in catalog.providers}

    assert providers["funasr"].recommended is True
    assert providers["funasr"].default_model_id == "iic/SenseVoiceSmall"
    assert providers["faster_whisper"].local is True
    assert providers["openai"].requires_consent is True
    assert "sidecar.stt.providers.funasr_provider" not in after - before
    assert "sidecar.stt.providers.faster_whisper_provider" not in after - before


def test_registry_blocks_cloud_without_consent_or_key() -> None:
    cfg = STTProviderConfig(active_provider="openai")
    health = STTProviderRegistry().health(cfg)
    assert health.state == "misconfigured"

    cfg.cloud["openai"].consent_granted = True
    health = STTProviderRegistry().health(cfg)
    assert health.state == "missing_credential"


def test_registry_imports_provider_only_when_building(monkeypatch) -> None:
    imported: list[str] = []

    def fake_import(name: str):
        imported.append(name)

        class _Provider:
            def __init__(self, config):
                self.config = config

        return type("_Module", (), {"FunASRSTTProvider": _Provider})

    monkeypatch.setattr("sidecar.stt.registry.importlib.import_module", fake_import)
    provider = STTProviderRegistry().build_provider(STTProviderConfig(active_provider="funasr"))

    assert imported == ["sidecar.stt.providers.funasr_provider"]
    assert provider.config.active_provider == "funasr"
