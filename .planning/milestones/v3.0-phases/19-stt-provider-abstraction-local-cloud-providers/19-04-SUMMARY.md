# Phase 19-04 Summary: Settings STT Test Recorder, Cache UI, And Enablement Gate

## Completed

- Added Electron/preload STT model cache methods for status, download/prepare, and remove operations.
- Extended Settings Voice in with local model cache status, download/remove controls, and immediate transcript display for Settings-only tests.
- Added a Settings-only microphone recording helper that requests microphone access only when the user starts a provider test and stops tracks after recording.
- Kept STT testing out of chat submission and conversation history.

## Verification

- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run build`
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts safe-storage.test.ts`
- `uv run --project sidecar python -m pytest sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/stt -q`

