# Phase 18-02 Summary: Voice Output And Voice Input Settings UI

## Completed

- Kept the existing GPT-SoVITS/Piper voice-output section as the source of truth rather than duplicating it.
- Replaced the old Voice in placeholder with a functional settings section for STT provider selection, input mode, language mode, capture timeout, and cloud STT consent/API key fields.
- Added provider capability labels from the sidecar provider catalog.
- Ensured the cloud STT diagnostic action is disabled until consent and an API key are present.

## Verification

- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run build`

