"""Tests for TTSGateway boot, pointer guards, and shutdown behavior."""

from __future__ import annotations

from pathlib import Path

import pytest

from sidecar.tts.tts_gateway import TTSGateway


def _model_path() -> Path:
    return Path(__file__).resolve().parents[1] / "models" / "piper" / "en_US-amy-medium.onnx"


def _is_lfs_pointer(path: Path) -> bool:
    if not path.exists():
        return False
    with path.open("rb") as f:
        return f.read(64).startswith(b"version https://git-lfs.github.com/spec/v1")


def test_boot_raises_filenotfound_for_missing_path():
    gateway = TTSGateway(Path("does/not/exist.onnx"))
    with pytest.raises(FileNotFoundError, match="piper.download_voices"):
        gateway.boot()


def test_boot_raises_runtimeerror_for_lfs_pointer(tmp_path: Path):
    pointer_path = tmp_path / "pointer.onnx"
    pointer_path.write_bytes(
        b"version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 100\n"
    )

    gateway = TTSGateway(pointer_path)
    with pytest.raises(RuntimeError, match="git lfs install && git lfs pull"):
        gateway.boot()


def test_shutdown_idempotent_when_stream_none():
    gateway = TTSGateway(Path("does/not/exist.onnx"))
    gateway.shutdown()
    gateway.shutdown()


@pytest.mark.skipif(
    not _model_path().exists() or _is_lfs_pointer(_model_path()),
    reason="model not pulled",
)
def test_real_voice_boot():
    gateway = TTSGateway(_model_path())
    try:
        gateway.boot()
        assert gateway.voice is not None
        assert gateway.sample_rate == 22050
        assert gateway.stream is not None
        assert gateway.stream.active is True
    finally:
        gateway.shutdown()
