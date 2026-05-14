# Phase 19-01 Summary: STT Contracts, Registry, Cache, And Readiness Foundation

## Completed

- Extended audio contracts with STT model cache metadata, readiness gates, readiness invalidation reasons, provider catalog recommendation/default-model fields, and test transcription payload/result fields.
- Added dependency-free sidecar STT foundation modules:
  - `sidecar.stt.provider` for provider protocol, request/result, and typed provider errors.
  - `sidecar.stt.registry` for lightweight provider catalog/health and lazy provider construction.
  - `sidecar.stt.model_cache` for app-managed model cache metadata and safe remove behavior.
  - `sidecar.stt.readiness` for stable readiness fingerprints and readiness validation.
- Extended admin audio routes with STT model status/download/remove skeletons, health/readiness/enable skeletons, and richer STT test diagnostics.
- Wired lightweight STT registry/cache objects into sidecar startup without importing provider libraries or loading models.

## Verification

- `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q`
- `uv run --project sidecar python -m pytest sidecar/tests/stt/test_model_cache.py sidecar/tests/stt/test_stt_registry.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/test_audio_config.py -q`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run build`
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts safe-storage.test.ts`

