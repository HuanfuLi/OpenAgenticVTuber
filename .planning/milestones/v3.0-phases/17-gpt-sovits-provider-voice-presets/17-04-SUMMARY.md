---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-04
subsystem: electron-ipc
tags: [electron, ipc, preload, gpt-sovits, tts, vitest]
requires:
  - phase: 17-03
    provides: Sidecar GPT-SoVITS health and test-synthesis admin endpoints
provides:
  - GPT-SoVITS candidate health IPC channel backed by sidecar admin API
  - GPT-SoVITS test-synthesis IPC channel returning preview audio metadata/failures
  - Renderer preload methods and declarations for later Settings UI integration
affects: [phase-17-settings-ui, phase-17-chat-failure-ui, phase-18-rich-voice-settings]
tech-stack:
  added: []
  patterns: [electron-ipc-admin-proxy, preload-allowlist, redacted-typed-failure]
key-files:
  created: [apps/electron-main/tests/ipc-gpt-sovits-audio.test.ts]
  modified: [apps/electron-main/src/ipc.ts, apps/electron-main/preload/index.ts, apps/electron-main/preload/index.d.ts]
key-decisions:
  - "GPT-SoVITS health/test synthesis stays behind explicit Electron IPC/preload methods; renderer callers do not receive arbitrary sidecar URL access."
  - "Main-process IPC error responses intentionally discard raw sidecar response bodies because they may contain provider internals or user/reference-audio paths."
patterns-established:
  - "Candidate GPT-SoVITS IPC calls POST generated contract request bodies to fixed sidecar admin endpoints and return generated response contracts."
  - "Preload bridge additions pair runtime allowlist methods with generated contract imports in declarations."
requirements-completed: [TTS-01, TTS-02, TTS-04, TTS-06]
duration: 2 min
completed: 2026-05-09
---

# Phase 17 Plan 17-04: Electron GPT-SoVITS Health/Test IPC Bridge Summary

**Electron IPC and preload bridge for GPT-SoVITS candidate health checks and preview test synthesis.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-09T23:52:23Z
- **Completed:** 2026-05-09T23:54:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `gptSovits:checkHealth` and `gptSovits:testSynthesis` main-process IPC handlers that POST generated request bodies to fixed sidecar admin endpoints.
- Added typed/redacted fallback responses for sidecar unavailable, HTTP failure, and fetch failure paths without exposing raw provider diagnostics to the renderer.
- Exposed `window.api.checkGptSoVitsHealth()` and `window.api.testGptSoVitsSynthesis()` through the preload allowlist with generated contract declarations.
- Added focused Vitest coverage for success proxies, preview audio metadata, redacted failures, cleanup unregistering, and preload/declaration wiring.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: GPT-SoVITS IPC handler behavior tests** - `71fe71c` (test)
2. **Task 1 GREEN: GPT-SoVITS IPC handlers** - `c3183fd` (feat)
3. **Task 2 RED: GPT-SoVITS preload bridge behavior tests** - `c3dc331` (test)
4. **Task 2 GREEN: GPT-SoVITS preload methods and declarations** - `3ae4ba6` (feat)

**Plan metadata:** pending in final docs commit.

## Files Created/Modified

- `apps/electron-main/tests/ipc-gpt-sovits-audio.test.ts` - Covers GPT-SoVITS IPC proxy behavior, redacted failure shaping, cleanup, and preload declaration wiring.
- `apps/electron-main/src/ipc.ts` - Registers fixed GPT-SoVITS health/test-synthesis IPC channels and typed failure helpers.
- `apps/electron-main/preload/index.ts` - Adds renderer allowlist methods for GPT-SoVITS health and test synthesis.
- `apps/electron-main/preload/index.d.ts` - Adds generated contract imports and typed bridge declarations for renderer callers.

## Decisions Made

- Kept IPC bridge failure detail concise and redacted by dropping raw sidecar response bodies; detailed diagnostics remain sidecar/log-panel territory per Phase 17 decisions.
- Used fixed `gptSovits:*` IPC channel names rather than a generic sidecar proxy so renderer code cannot choose arbitrary admin paths.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `gsd-sdk query` is unavailable in this environment (`gsd-sdk` only exposes run/auto/init), so STATE/ROADMAP updates were applied manually instead of through query handlers.
- Phase 17 planning artifacts are present as untracked files from prior workflow state; they were intentionally left unstaged to preserve existing worktree state outside this plan.

## User Setup Required

None - no external service configuration required for mocked Electron IPC/preload tests. Live GPT-SoVITS UAT still requires a user-run GPT-SoVITS server in a later verification phase.

## Known Stubs

None. No UI-rendered placeholder data or mock-only runtime paths were introduced.

## Auth Gates

None.

## Verification

- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts` — passed (6 tests).
- `npm --workspace apps/electron-main run build` — passed.
- PowerShell declaration count for `checkGptSoVitsHealth|testGptSoVitsSynthesis` in `apps/electron-main/preload/index.d.ts` — passed (`declaration_method_count=2`).

## Next Phase Readiness

- Ready for `17-05`: app-managed GPT-SoVITS launch lifecycle can reuse this fixed Electron boundary once launch/status endpoints exist.
- Ready for `17-06`: Settings can call concrete preload methods for candidate health and audible test synthesis without direct sidecar HTTP.

## Self-Check: PASSED

- Found `apps/electron-main/tests/ipc-gpt-sovits-audio.test.ts`.
- Found `apps/electron-main/src/ipc.ts`.
- Found `apps/electron-main/preload/index.ts`.
- Found `apps/electron-main/preload/index.d.ts`.
- Found task commits `71fe71c`, `c3183fd`, `c3dc331`, and `3ae4ba6` in git log.
- Verification commands passed as listed above.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-09*
