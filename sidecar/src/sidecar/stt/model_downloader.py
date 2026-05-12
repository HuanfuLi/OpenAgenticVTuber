from __future__ import annotations

import importlib
import shutil
from pathlib import Path


class STTModelDownloadError(Exception):
    def __init__(self, summary: str, *, retryable: bool = True) -> None:
        super().__init__(summary)
        self.summary = summary
        self.retryable = retryable


def download_local_stt_model(provider_id: str, model_id: str, destination: str | Path) -> Path:
    destination_path = Path(destination).resolve()
    temp_path = destination_path.with_name(f"{destination_path.name}.partial")
    if temp_path.exists():
        shutil.rmtree(temp_path)
    temp_path.mkdir(parents=True, exist_ok=True)
    try:
        if provider_id == "funasr":
            _download_modelscope(model_id, temp_path)
        elif provider_id == "faster_whisper":
            _download_huggingface(_faster_whisper_repo(model_id), temp_path)
        else:
            raise STTModelDownloadError(f"Unsupported local STT provider: {provider_id}", retryable=False)
        if not _has_model_contents(temp_path):
            raise STTModelDownloadError("STT model download finished but no usable model files were found.", retryable=True)
        if destination_path.exists():
            shutil.rmtree(destination_path)
        shutil.move(str(temp_path), str(destination_path))
        return destination_path
    except STTModelDownloadError:
        raise
    except Exception as exc:
        raise STTModelDownloadError(f"STT model download failed: {type(exc).__name__}", retryable=True) from exc
    finally:
        if temp_path.exists():
            shutil.rmtree(temp_path, ignore_errors=True)


def _download_modelscope(model_id: str, destination: Path) -> None:
    try:
        module = importlib.import_module("modelscope")
    except ImportError as exc:
        raise STTModelDownloadError("ModelScope is not installed; cannot download the FunASR model.", retryable=False) from exc
    snapshot_download = getattr(module, "snapshot_download", None)
    if snapshot_download is None:
        raise STTModelDownloadError("ModelScope snapshot_download is unavailable.", retryable=False)
    snapshot_download(model_id, local_dir=str(destination))


def _download_huggingface(repo_id: str, destination: Path) -> None:
    try:
        module = importlib.import_module("huggingface_hub")
    except ImportError as exc:
        raise STTModelDownloadError("huggingface_hub is not installed; cannot download the faster-whisper model.", retryable=False) from exc
    snapshot_download = getattr(module, "snapshot_download", None)
    if snapshot_download is None:
        raise STTModelDownloadError("Hugging Face snapshot_download is unavailable.", retryable=False)
    snapshot_download(repo_id=repo_id, local_dir=str(destination), local_dir_use_symlinks=False)


def _faster_whisper_repo(model_id: str) -> str:
    if "/" in model_id:
        return model_id
    return f"Systran/faster-whisper-{model_id}"


def _has_model_contents(path: Path) -> bool:
    if not path.exists():
        return False
    for child in path.rglob("*"):
        if child.is_file() and child.stat().st_size > 0:
            return True
    return False
