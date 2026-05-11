from __future__ import annotations

import os
import shutil
from pathlib import Path

from contracts import STTModelCacheCatalog, STTModelCacheOperationResult, STTModelCatalogEntry

MODEL_CACHE_MARKER = ".agenticllmvtuber-model-cache.json"
DOWNLOAD_UNAVAILABLE_SUMMARY = (
    "Automatic STT model download is not implemented yet. Place real model files in the "
    "app-managed cache or configure a local model path."
)

LOCAL_MODEL_DEFINITIONS = [
    {
        "provider_id": "funasr",
        "model_id": "iic/SenseVoiceSmall",
        "display_name": "SenseVoiceSmall",
        "source_label": "ModelScope",
        "size_label": "approximately 1 GB",
        "recommended": True,
    },
    {
        "provider_id": "faster_whisper",
        "model_id": "small",
        "display_name": "faster-whisper small",
        "source_label": "Hugging Face",
        "size_label": "approximately 500 MB",
        "recommended": False,
    },
]


class STTModelCache:
    def __init__(self, cache_root: str | Path | None = None, user_data: str | Path | None = None) -> None:
        root = cache_root or Path(user_data or os.environ.get("AGENTICLLMVTUBER_USER_DATA", ".")) / "stt-models"
        self.cache_root = Path(root).resolve()

    def model_path(self, provider_id: str, model_id: str) -> Path:
        safe_model = model_id.replace("/", "__").replace("\\", "__").replace("..", "__")
        return (self.cache_root / provider_id / safe_model).resolve()

    def _is_under_cache_root(self, candidate: Path) -> bool:
        try:
            candidate.resolve().relative_to(self.cache_root)
            return True
        except ValueError:
            return False

    @staticmethod
    def has_model_contents(path: str | Path | None) -> bool:
        if path is None:
            return False
        candidate = Path(path)
        if not candidate.exists():
            return False
        if candidate.is_file():
            return candidate.name != MODEL_CACHE_MARKER and candidate.stat().st_size > 0
        if not candidate.is_dir():
            return False
        for child in candidate.rglob("*"):
            if child.is_file() and child.name != MODEL_CACHE_MARKER and child.stat().st_size > 0:
                return True
        return False

    @staticmethod
    def model_status_for_path(path: str | Path | None) -> str:
        if path is None:
            return "missing"
        candidate = Path(path)
        if not candidate.exists():
            return "missing"
        return "downloaded" if STTModelCache.has_model_contents(candidate) else "incomplete"

    def catalog(self) -> STTModelCacheCatalog:
        models: list[STTModelCatalogEntry] = []
        for definition in LOCAL_MODEL_DEFINITIONS:
            path = self.model_path(definition["provider_id"], definition["model_id"])
            exists = path.exists()
            status = self.model_status_for_path(path) if exists else "not_downloaded"
            models.append(
                STTModelCatalogEntry(
                    provider_id=definition["provider_id"],
                    model_id=definition["model_id"],
                    display_name=definition["display_name"],
                    source_label=definition["source_label"],
                    size_label=definition["size_label"],
                    cache_path_display=str(path),
                    status=status,
                    app_managed=True,
                    removable=exists,
                    loaded=False,
                    recommended=definition["recommended"],
                    summary=(
                        "Model is present in the app-managed cache."
                        if status == "downloaded"
                        else "Model cache entry exists but does not contain usable model files."
                        if status == "incomplete"
                        else "Model has not been downloaded."
                    ),
                )
            )
        return STTModelCacheCatalog(cache_root_display=str(self.cache_root), models=models)

    def remove(self, provider_id: str, model_id: str) -> STTModelCacheOperationResult:
        path = self.model_path(provider_id, model_id)
        if not self._is_under_cache_root(path):
            return STTModelCacheOperationResult(
                ok=False,
                provider_id=provider_id,
                model_id=model_id,
                status="missing",
                summary="Refused to remove a path outside the app-managed STT model cache.",
                cache_path_display=str(path),
            )
        if not path.exists():
            return STTModelCacheOperationResult(
                ok=True,
                provider_id=provider_id,
                model_id=model_id,
                status="not_downloaded",
                summary="Model is not present in the app-managed cache.",
                cache_path_display=str(path),
            )
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        return STTModelCacheOperationResult(
            ok=True,
            provider_id=provider_id,
            model_id=model_id,
            status="not_downloaded",
            summary="Model removed from the app-managed cache.",
            cache_path_display=str(path),
        )

    def download_unavailable(self, provider_id: str, model_id: str) -> STTModelCacheOperationResult:
        path = self.model_path(provider_id, model_id)
        return STTModelCacheOperationResult(
            ok=False,
            provider_id=provider_id,
            model_id=model_id,
            status="manual_path_required",
            summary=DOWNLOAD_UNAVAILABLE_SUMMARY,
            cache_path_display=str(path),
        )
