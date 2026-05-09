from __future__ import annotations

from pathlib import Path

from loguru import logger
from piper import PiperVoice

from contracts import AudioProviderHealth

from .provider import TTSSynthesisRequest, TTSSynthesisResult


class PiperTTSProvider:
    provider_id = "piper"

    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self.voice: PiperVoice | None = None
        self.sample_rate = 0

    def boot(self) -> None:
        self._guard_lfs_pointer(self.model_path)
        logger.info(f"[TTS-INIT] loading PiperVoice from {self.model_path}")
        self.voice = PiperVoice.load(str(self.model_path))
        self.sample_rate = self.voice.config.sample_rate
        logger.info(f"[TTS-INIT] voice loaded; sample_rate={self.sample_rate}")
        for _ in self.voice.synthesize("."):
            pass
        logger.info("[TTS-INIT] ORT JIT warmup complete (synth-and-discard).")

    def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        if self.voice is None:
            raise RuntimeError("PiperTTSProvider is not booted.")
        pcm_chunks: list[bytes] = []
        sample_rate = self.sample_rate or self.voice.config.sample_rate
        for chunk in self.voice.synthesize(request.text):
            pcm_chunks.append(chunk.audio_int16_bytes)
            sample_rate = chunk.sample_rate
        return TTSSynthesisResult(
            pcm_int16=b"".join(pcm_chunks),
            sample_rate=sample_rate,
            provider_id=self.provider_id,
        )

    def health(self) -> AudioProviderHealth:
        if self.voice is None or self.sample_rate <= 0:
            return AudioProviderHealth(
                provider_id="piper",
                kind="tts",
                state="unavailable",
                summary="Piper provider is not booted.",
                retryable=True,
            )
        return AudioProviderHealth(
            provider_id="piper",
            kind="tts",
            state="ok",
            summary="Piper provider ready.",
            detail=f"voice={self.model_path.stem}",
            retryable=False,
        )

    def shutdown(self) -> None:
        self.voice = None

    @staticmethod
    def _guard_lfs_pointer(path: Path) -> None:
        if not path.exists():
            raise FileNotFoundError(
                f"Voice model not found at {path}. "
                f"Run `python -m piper.download_voices en_US-amy-medium` "
                f"into sidecar/models/piper/, then commit via Git LFS."
            )
        with path.open("rb") as f:
            head = f.read(64)
        if head.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise RuntimeError(
                f"Voice model at {path} is a Git LFS pointer file. "
                f"Run `git lfs install && git lfs pull` from repo root."
            )
