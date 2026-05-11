# 20-05 Summary: Voice Input Readiness Recovery

## Completed

- Made `sidecar_unavailable` readiness recoverable instead of storing it as a sticky voice-input error.
- Refreshed Chat voice readiness after sidecar-ready, renderer websocket reconnect, and Voice settings saves.
- Persisted successful Settings STT test readiness into the saved STT config so Chat can pass the Phase 19 readiness gate after a valid test.
- Added regression coverage for startup sidecar recovery, PTT enablement after readiness refresh, and STT readiness persistence on save.

## Verification

- `npm --workspace apps/renderer run test -- --run voice-input-store`
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput`
- `npm --workspace apps/renderer run test -- --run Settings`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run test -- --run voice-input`

All checks passed.

## Notes

- This does not bypass readiness. Current STT disabled, untested, missing-model, permission-denied, and credential blockers still remain visible until a fresh readiness response clears them.
