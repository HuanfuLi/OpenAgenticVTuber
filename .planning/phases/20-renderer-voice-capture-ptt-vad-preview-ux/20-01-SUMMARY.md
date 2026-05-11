---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-01
subsystem: audio-input
tags: [electron, ipc, preload, fastapi, stt, contracts]
requires:
  - phase: 19-stt-provider-abstraction-local-cloud-providers
    provides: STTProviderConfig, STTProviderReadiness, STTProviderRegistry, and readiness-gated provider transcription.
provides:
  - Runtime voice input readiness and preview/final transcription contracts.
  - Electron microphone permission handlers scoped to renderer origin and media/audio permission.
  - Preload IPC methods for microphone permission, voice readiness, and runtime transcription.
  - Sidecar /admin/audio/voice-input readiness and transcription endpoints gated by Phase 19 STT readiness.
affects: [20-02, 20-03, 20-04, renderer voice capture, chat voice input]
tech-stack:
  added: []
  patterns: [preload-mediated voice input bridge, readiness-gated sidecar runtime STT endpoint]
key-files:
  created:
    - apps/electron-main/src/voice-input-permissions.ts
    - apps/electron-main/tests/ipc-voice-input.test.ts
    - sidecar/tests/admin/test_audio_voice_input_endpoint.py
  modified:
    - packages/contracts/py/contracts/audio_provider.py
    - packages/contracts/ts/audio-provider.ts
    - packages/contracts/generated/json-schema/audio-provider.schema.json
    - apps/electron-main/src/ipc.ts
    - apps/electron-main/preload/index.ts
    - sidecar/src/sidecar/admin/audio.py
key-decisions:
  - "Runtime voice input uses Phase 19 STTProviderConfig and STTProviderReadiness rather than a separate provider API."
  - "Electron permission handling allows only renderer-origin media/audio requests and denies unrelated origins or permissions."
requirements-completed: [VIN-01, VIN-02, VIN-04, VIN-05]
duration: 12min
completed: 2026-05-11
---

# Phase 20 Plan 20-01: Voice Input Contracts, Permission, And Transcription Bridge Summary

**Runtime voice input bridge with readiness-gated STT transcription, narrow Electron microphone permission handling, and preview/final contracts.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-11T04:50:26Z
- **Completed:** 2026-05-11T05:01:21Z
- **Tasks:** 6
- **Files modified:** 13

## Accomplishments

- Added generated voice input contracts for capture status, microphone permission state, readiness, preview/final transcription requests, and runtime transcription results.
- Added Electron main permission handlers for media/audio requests scoped to the app renderer origin, plus preload IPC methods for readiness, permission status, and transcription.
- Added sidecar `/admin/audio/voice-input/readiness` and `/admin/audio/voice-input` endpoints that refuse disabled/unready STT and dispatch only to the selected Phase 19 provider.
- Added focused contract, Electron, and sidecar tests for permission scoping, typed unavailable states, readiness refusal, selected-provider dispatch, and preview/final result shape.

## Task Commits

1. **Tasks 1-6: Voice input contracts, Electron bridge, sidecar endpoint, and focused tests** - `d64b46f` (feat)

## Files Created/Modified

- `packages/contracts/py/contracts/audio_provider.py` - Added runtime voice input readiness and transcription contract models.
- `packages/contracts/py/contracts/__init__.py` - Exported the new voice input contract types.
- `packages/contracts/ts/audio-provider.ts` - Regenerated TypeScript contract mirror.
- `packages/contracts/generated/json-schema/audio-provider.schema.json` - Regenerated JSON schema for voice input contracts.
- `packages/contracts/tests/test_codegen.py` - Added contract coverage for preview/final runtime results and no persistence/translation fields.
- `apps/electron-main/src/voice-input-permissions.ts` - Added testable renderer-origin media/audio permission decisions.
- `apps/electron-main/src/index.ts` - Installed microphone permission handlers on the renderer session.
- `apps/electron-main/src/ipc.ts` - Added voice input readiness, microphone permission, and runtime transcription IPC handlers.
- `apps/electron-main/preload/index.ts` - Exposed typed renderer voice input bridge methods.
- `apps/electron-main/preload/index.d.ts` - Declared voice input bridge methods.
- `apps/electron-main/tests/ipc-voice-input.test.ts` - Covered permission allow/deny behavior and IPC unavailable/proxy behavior.
- `sidecar/src/sidecar/admin/audio.py` - Added readiness-gated runtime voice input endpoints.
- `sidecar/tests/admin/test_audio_voice_input_endpoint.py` - Covered disabled/unready STT refusal, selected-provider dispatch, and redacted runtime failure.

## Verification

- `npm run codegen:contracts` - PASS
- `npm run check:contracts` - PASS after implementation commit
- `npm --workspace apps/electron-main run test -- --run voice-input` - PASS, 4 tests
- `npm --workspace apps/electron-main run build` - PASS
- `cd sidecar; uv run pytest tests/admin/test_audio_voice_input_endpoint.py tests/stt -q` - PASS, 15 tests

## Decisions Made

- Reused Phase 19 `STTProviderConfig`, `STTProviderReadiness`, and `STTProviderRegistry` names directly.
- Kept renderer-facing transcription calls preload-mediated; the renderer still never calls sidecar admin URLs directly.
- Treated runtime provider failures as readiness invalidation results with redacted diagnostics, without persisting audio or transcripts.

## Deviations from Plan

None - plan executed as written. Implementation adapted to actual Phase 19 file names and endpoint shapes discovered in the repo.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: microphone-permission | apps/electron-main/src/voice-input-permissions.ts | New microphone permission surface is explicitly allowlisted to renderer-origin media/audio requests and denies unrelated origins/permissions. |
| threat_flag: runtime-audio-endpoint | sidecar/src/sidecar/admin/audio.py | New runtime STT endpoint accepts base64 audio but gates on selected/enabled Phase 19 readiness and returns only redacted failure diagnostics. |

## Issues Encountered

- `gsd-sdk query` was unavailable in this checkout, so planning state updates were applied manually.
- `npm run check:contracts` returned nonzero before commit because generated contract outputs were intentionally modified; rerunning after committing the generated outputs passed.

## User Setup Required

None - no external service configuration required by this plan. Existing Phase 19 provider readiness and credentials still control whether runtime voice input can transcribe.

## Next Phase Readiness

Plan 20-02 can consume `window.api.getVoiceInputReadiness`, `window.api.requestMicrophonePermission`, and `window.api.transcribeVoiceInput` for renderer capture and state-machine work.

## Self-Check: PASSED

- Created files exist: `apps/electron-main/src/voice-input-permissions.ts`, `apps/electron-main/tests/ipc-voice-input.test.ts`, `sidecar/tests/admin/test_audio_voice_input_endpoint.py`.
- Commit exists: `d64b46f`.
- Verification commands above passed.

---
*Phase: 20-renderer-voice-capture-ptt-vad-preview-ux*
*Completed: 2026-05-11*
