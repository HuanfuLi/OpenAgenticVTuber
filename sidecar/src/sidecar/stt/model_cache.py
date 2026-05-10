from __future__ import annotations

import os
import shutil
from pathlib import Path

from contracts import STTModelCacheCatalog, STTModelCacheOperationResult, STTModelCatalogEntry


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

    def catalog(self) -> STTModelCacheCatalog:
        models: list[STTModelCatalogEntry] = []
        for definition in LOCAL_MODEL_DEFINITIONS:
            path = self.model_path(definition["provider_id"], definition["model_id"])
            exists = path.exists()
            models.append(
                STTModelCatalogEntry(
                    provider_id=definition["provider_id"],
                    model_id=definition["model_id"],
                    display_name=definition["display_name"],
                    source_label=definition["source_label"],
                    size_label=definition["size_label"],
                    cache_path_display=str(path),
                    status="downloaded" if exists else "not_downloaded",
                    app_managed=True,
                    removable=exists,
                    loaded=False,
                    recommended=definition["recommended"],
                    summary="Model is present in the app-managed cache." if exists else "Model has not been downloaded.",
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

    def download_placeholder(self, provider_id: str, model_id: str) -> STTModelCacheOperationResult:
        path = self.model_path(provider_id, model_id)
        return STTModelCacheOperationResult(
            ok=False,
            provider_id=provider_id,
            model_id=model_id,
            status="operation_pending",
            summary="Provider-specific model download is implemented in the local adapter phase.",
            cache_path_display=str(path),
        )

