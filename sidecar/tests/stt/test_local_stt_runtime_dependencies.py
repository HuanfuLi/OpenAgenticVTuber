from __future__ import annotations

from importlib import metadata


def test_local_stt_runtime_dependencies_are_installed() -> None:
    for package_name in ("faster-whisper", "funasr", "torch", "torchaudio"):
        assert metadata.version(package_name)
