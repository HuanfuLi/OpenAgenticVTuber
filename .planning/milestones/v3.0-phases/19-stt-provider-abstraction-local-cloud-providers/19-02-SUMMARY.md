# Phase 19-02 Summary: Local STT Providers And Model Cache Controls

## Completed

- Added lazy FunASR/SenseVoiceSmall and faster-whisper provider adapters with no provider-specific imports at sidecar boot.
- Added app-managed local model cache prepare/remove/status behavior.
- Extended the STT admin test path to block local tests when the selected local model is not present in app-managed cache.
- Wired successful local test transcription into readiness with a non-empty transcript gate.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/stt/test_funasr_provider.py sidecar/tests/stt/test_faster_whisper_provider.py sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/stt/test_model_cache.py sidecar/tests/stt/test_stt_registry.py -q`

