# 20-06 Summary: Truthful STT Model Cache And VAD Copy

## Completed

- Removed fake placeholder-download semantics from the sidecar STT model-cache endpoint.
- Changed model-cache catalog status so empty directories and marker-only directories are `incomplete`, not `downloaded`.
- Allowed explicit local model path overrides to count as downloaded only when the path contains real non-empty model contents.
- Updated Settings copy to label the cache as `STT local model cache` and clarify that VAD is browser volume/silence detection with no downloadable model.
- Updated Settings behavior and tests so the model action reports automatic download as unavailable/manual setup instead of instant success.

## Verification

- `cd sidecar; uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt -q`
- `npm --workspace apps/renderer run test -- --run Settings`
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput`
- `npm --workspace apps/renderer run typecheck`
- `npm run check:contracts`

All checks passed.

## Notes

- This is the conservative Phase 20 gap closure. It does not implement provider-specific model downloads; it prevents false success and keeps local voice input blocked until real model files or a valid explicit local model path exist.
