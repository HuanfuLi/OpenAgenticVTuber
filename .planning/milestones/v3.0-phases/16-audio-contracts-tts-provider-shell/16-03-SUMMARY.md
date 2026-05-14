---
phase: 16-audio-contracts-tts-provider-shell
plan: 16-03
subsystem: audio-status
tags: [health, ipc, settings, provider-failure, diagnostics]
requires:
  - phase: 16-01
    provides: Audio health contract
  - phase: 16-02
    provides: Provider shell and queue-safe TTS manager
provides:
  - GET /admin/audio/status typed provider health endpoint
  - Electron/preload getAudioStatus bridge
  - Compact read-only Settings TTS diagnostics
  - Queue-safe provider failure behavior
affects: [settings, phase-17, phase-18, phase-19]
tech-stack:
  added: []
  patterns:
    - Admin endpoints read existing app.state and do not instantiate providers
key-files:
  created:
    - sidecar/src/sidecar/admin/audio.py
    - sidecar/tests/admin/test_audio_status_endpoint.py
  modified:
    - apps/electron-main/src/ipc.ts
    - apps/electron-main/preload/index.ts
    - apps/renderer/src/screens/Settings/Settings.tsx
    - sidecar/src/sidecar/tts/tts_manager.py
key-decisions:
  - "Sidecar-unavailable audio status returns a typed unavailable health object instead of throwing to the renderer."
  - "Provider failures enqueue a silent deterministic audio envelope and do not silently switch providers mid-turn."
patterns-established:
  - "Settings may show compact read-only TTS diagnostics; provider switching and test synthesis stay deferred."
requirements-completed: [AUDIO-03, AUDIO-04, TTS-05, PERF-03]
duration: same-session
completed: 2026-05-09
---

# Phase 16 Plan 03: Provider Health, Failure Semantics, and Non-Blocking Regression Summary

**Typed TTS health diagnostics and queue-safe provider failure handling with focused regression coverage**

## Performance

- **Duration:** same session
- **Started:** 2026-05-09T18:20:00-04:00
- **Completed:** 2026-05-09T18:38:56-04:00
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments

- Added `/admin/audio/status` using `AudioProviderHealth`.
- Added Electron IPC/preload `getAudioStatus()` with sidecar-unavailable fallback.
- Added compact Settings diagnostics for active TTS provider health.
- Made provider failures queue-safe: failed synthesis sends a silent envelope for the sentence and subsequent sentences keep order.
- Added non-blocking provider and provider-failure regression tests.

## Task Commits

1. **Tasks 1-4:** `261aa98` (`feat(16): add audio provider shell`)

## Files Created/Modified

- `sidecar/src/sidecar/admin/audio.py` - Audio status endpoint.
- `apps/electron-main/src/ipc.ts` - Audio status bridge.
- `apps/electron-main/preload/index.ts` - Renderer API exposure.
- `apps/renderer/src/screens/Settings/Settings.tsx` - Compact TTS diagnostics.
- `sidecar/tests/admin/test_audio_status_endpoint.py` - Endpoint coverage.

## Decisions Made

Provider failure is visible and deterministic, but Phase 16 does not add broad renderer notification UX. It preserves app behavior by sending a no-audio envelope for the failed sentence and logging the typed provider failure.

## Deviations from Plan

None - plan executed as scoped.

## Issues Encountered

The archived Phase 7 UAT file moved under `.planning/milestones/v2.0-phases`; the existing sidecar boot test now resolves the archived path.

## User Setup Required

None.

## Next Phase Readiness

Phase 17 can add GPT-SoVITS provider support against this shell and health contract without changing renderer audio payload semantics.

---
*Phase: 16-audio-contracts-tts-provider-shell*
*Completed: 2026-05-09*
