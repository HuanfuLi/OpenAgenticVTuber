"""Piper gateway bootstrap for Phase 3.

Pattern A is the default: open the stream against the default output device and
trust the host API to handle 22050 Hz playback. If Windows/WASAPI raises
PaErrorCode -9997, the documented fallback patterns are:
  - Pattern B: resample upstream before stream.write
  - Pattern C: force an MME device explicitly
Those fallbacks are intentionally not implemented here; 03-02/Phase 5 can apply
them if verification shows the default path is insufficient.
"""

from __future__ import annotations
from pathlib import Path

import sounddevice as sd
from loguru import logger

from .piper_provider import PiperTTSProvider
from .provider import TTSProvider


class TTSGateway:
    """Owns PiperVoice + global OutputStream. Constructed once at sidecar
    boot (FastAPI lifespan startup) BEFORE [READY] emits. Stream stays open
    for sidecar lifetime; closed in lifespan shutdown.

    D-06: warmup BEFORE [READY].
    D-07: warmup scope = piper model + ORT JIT + sounddevice OutputStream.
    D-08: warmup audio is synth-and-discard (not written to OutputStream).
    """

    def __init__(self, model_path: Path, provider: TTSProvider | None = None) -> None:
        self.model_path = model_path
        self.provider = provider or PiperTTSProvider(model_path)
        self.stream: sd.OutputStream | None = None
        self.sample_rate: int = 0  # populated after voice load

    @property
    def voice(self):
        return getattr(self.provider, "voice", None)

    def boot(self) -> None:
        """Synchronous; called from FastAPI lifespan startup BEFORE [READY]."""
        self.provider.boot()
        self.sample_rate = self.provider.sample_rate

        # D-07: open + start the long-lived stream. latency='high' (default) for
        # spike-tolerance per Pitfall 5. dtype='int16' matches piper output.
        # No device= → trust default (likely MME on Windows; resamples 22050 if
        # WASAPI is selected — see Pitfall 4).
        self.stream = sd.OutputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype="int16",
            # latency=None → 'high' default; safer than 'low' for skeleton.
        )
        self.stream.start()
        logger.info(
            f"[TTS-INIT] OutputStream open: latency={self.stream.latency:.3f}s"
        )

    def shutdown(self) -> None:
        """Close stream in lifespan shutdown (Phase 1 graceful-shutdown extension)."""
        if self.stream is not None:
            try:
                self.stream.stop()   # waits for hardware drain (sounddevice docs)
                self.stream.close()
            except Exception:
                logger.exception("[TTS-SHUTDOWN] OutputStream.close failed")
            self.stream = None
        self.provider.shutdown()


def build_tts_gateway(
    *,
    audio_config,
    repo_root: Path,
    avatar_voice_model: str,
) -> TTSGateway:
    provider_id = audio_config.tts.active_provider
    if provider_id != "piper":
        raise ValueError(f"Unsupported TTS provider for Phase 16: {provider_id}")
    configured_voice = audio_config.tts.piper.voice_model
    voice_model = configured_voice if configured_voice != "en_US-amy-medium" else avatar_voice_model
    model_path = repo_root / "sidecar" / "models" / "piper" / f"{voice_model}.onnx"
    return TTSGateway(model_path)
