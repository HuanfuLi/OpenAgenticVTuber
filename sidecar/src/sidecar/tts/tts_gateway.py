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
from piper import PiperVoice


class TTSGateway:
    """Owns PiperVoice + global OutputStream. Constructed once at sidecar
    boot (FastAPI lifespan startup) BEFORE [READY] emits. Stream stays open
    for sidecar lifetime; closed in lifespan shutdown.

    D-06: warmup BEFORE [READY].
    D-07: warmup scope = piper model + ORT JIT + sounddevice OutputStream.
    D-08: warmup audio is synth-and-discard (not written to OutputStream).
    """

    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self.voice: PiperVoice | None = None
        self.stream: sd.OutputStream | None = None
        self.sample_rate: int = 0  # populated after voice load

    def boot(self) -> None:
        """Synchronous; called from FastAPI lifespan startup BEFORE [READY]."""
        self._guard_lfs_pointer(self.model_path)  # Pitfall 3 mitigation
        logger.info(f"[TTS-INIT] loading PiperVoice from {self.model_path}")
        self.voice = PiperVoice.load(str(self.model_path))  # auto-loads .onnx.json
        self.sample_rate = self.voice.config.sample_rate    # 22050 for amy-medium
        logger.info(f"[TTS-INIT] voice loaded; sample_rate={self.sample_rate}")

        # D-08: synth-and-discard one token to warm ORT JIT.
        # voice.synthesize() yields AudioChunk; iterate to force inference.
        for _ in self.voice.synthesize("."):
            pass
        logger.info("[TTS-INIT] ORT JIT warmup complete (synth-and-discard).")

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

    @staticmethod
    def _guard_lfs_pointer(path: Path) -> None:
        """Pitfall 3: detect Git LFS pointer file masquerading as the .onnx."""
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
