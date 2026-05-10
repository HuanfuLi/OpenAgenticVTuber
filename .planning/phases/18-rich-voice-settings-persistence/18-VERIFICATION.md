# Phase 18 Verification: Rich Voice Settings + Persistence

## Verdict

PASS

## Success Criteria

1. Provider capability labels are visible for TTS/STT providers.
   - PASS: `/admin/audio/providers` returns local/cloud/API-key/external-service/test capability metadata, and Settings renders those labels in Voice in.

2. Cloud STT providers remain disabled by default and require explicit credentials and consent before audio can be sent.
   - PASS: default audio config stores cloud consent as false with null keys; Settings disables cloud STT diagnostics until consent and key are present; sidecar rejects cloud STT tests without consent/key and performs no network call in Phase 18.

3. Settings, logs, and diagnostics redact STT credentials, reference-audio paths, transcripts, and provider errors where appropriate.
   - PASS: sidecar redaction covers secrets, bearer/API keys, user paths, and transcript-like fields; tests assert secrets and user paths do not appear in diagnostic responses.

4. User can inspect TTS/STT latency, timeout, and provider-failure diagnostics without exposing secrets.
   - PASS: existing TTS health remains available; STT diagnostic tests return typed provider failures and redacted diagnostics; Voice in exposes capture timeout and provider test status.

## Verification Commands

- `uv run --project sidecar python -m pytest sidecar/tests/test_audio_config.py sidecar/tests/test_audio_redaction.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_audio_test_tts_endpoint.py -q`
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts ipc-gpt-sovits-process.test.ts safe-storage.test.ts`
- `npm --workspace apps/electron-main run build`

## Notes

- `npm run check:contracts` was run before commit and reported the expected generated-contract diff. It should be rerun after the Phase 18 commit.
- Phase 18 intentionally does not implement real STT adapters, microphone capture, PTT/VAD preview, or chat voice submission.

