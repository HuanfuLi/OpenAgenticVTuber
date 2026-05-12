# 20-07 Summary: Phase 19/20 STT Runtime Integration Fixes

## Completed

- Updated Voice settings copy so the local STT model action reflects real explicit download behavior instead of saying automatic download is unavailable.
- Added cache-root-aware STT model download/remove requests without sending full STT config or cloud credentials.
- Made sidecar voice-input readiness re-check local model availability so Chat PTT blocks before recording when a previously ready local model disappears.
- Invalidated local Settings readiness after model removal and refreshed Chat readiness after model download/remove actions.
- Changed preview transcription to encode accumulated MediaRecorder chunks instead of assuming each timeslice chunk is independently decodable.
- Added regression coverage for missing-model readiness, custom cache-root model operations, operation payload privacy, Settings copy, and resilient preview/final transcription.

## Verification

- `cd sidecar; uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_model_cache.py -q`
- `npm --workspace apps/renderer run test -- --run voice-capture voice-input-store ChatVoiceInput Settings`
- `npm --workspace apps/electron-main run test -- --run ipc-voice-input`

## Manual Follow-Up

- Live microphone/STT UAT is still pending: real model download, Settings STT test/save, Chat PTT, VAD, active-turn queueing, and preview/final submission should be retested in the app.
