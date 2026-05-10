# Phase 18-01 Summary: Audio Settings Persistence, Consent, And Redaction

## Completed

- Extended shared audio contracts with STT input mode, recognition language, cloud STT provider settings, explicit consent, and diagnostic redaction configuration.
- Updated Electron and renderer default audio config builders so schemaVersion 1/older schemaVersion 2 configs hydrate the new Phase 18 fields safely.
- Added recursive audio diagnostic redaction for API keys, authorization tokens, user paths, and transcript text.
- Added sidecar STT diagnostic test behavior that blocks cloud STT unless consent and credentials are saved, and never sends a real network request in Phase 18.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/test_audio_config.py sidecar/tests/test_audio_redaction.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_audio_test_tts_endpoint.py -q`
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts ipc-gpt-sovits-process.test.ts safe-storage.test.ts`

