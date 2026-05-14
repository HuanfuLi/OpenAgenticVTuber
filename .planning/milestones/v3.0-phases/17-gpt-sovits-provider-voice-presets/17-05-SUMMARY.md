---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-05
subsystem: electron-main
tags: [electron, ipc, preload, gpt-sovits, process-lifecycle, tts, vitest]
requires:
  - phase: 17-04
    provides: GPT-SoVITS health and test-synthesis IPC/preload bridge
provides:
  - App-owned GPT-SoVITS process lifecycle manager for user-supplied command/cwd
  - Typed Electron IPC and preload methods for GPT-SoVITS start/status/stop/restart
  - Centralized Settings copy for app-managed versus external GPT-SoVITS controls
affects: [phase-17-settings-ui, phase-17-final-uat, phase-18-rich-voice-settings]
tech-stack:
  added: []
  patterns: [app-owned-process-handle, preload-allowlist, bounded-process-log-ring, renderer-copy-centralization]
key-files:
  created: [apps/electron-main/src/gpt-sovits-process.ts, apps/electron-main/tests/gpt-sovits-process.test.ts, apps/electron-main/tests/ipc-gpt-sovits-process.test.ts]
  modified: [apps/electron-main/src/ipc.ts, apps/electron-main/preload/index.ts, apps/electron-main/preload/index.d.ts, apps/renderer/src/lib/copy.ts, apps/renderer/src/state/setup-store.ts, apps/renderer/src/screens/LLMSetup/LLMSetup.tsx, apps/renderer/src/screens/Settings/Settings.tsx, apps/renderer/src/state/app-store.tsx, apps/renderer/tests/Settings.test.tsx, apps/renderer/tests/ws-store-audio.test.ts]
key-decisions:
  - "App-managed GPT-SoVITS lifecycle is scoped to the single tracked child process launched from the user's command and working directory; external servers return not-app-managed status."
  - "Renderer access to GPT-SoVITS lifecycle is restricted to four concrete preload methods instead of arbitrary process or sidecar controls."
patterns-established:
  - "Process status responses include mode, appManaged, pid, state, summary, optional healthUrl, and bounded diagnostics."
  - "Stop/restart never use GPT-SoVITS base URL, port, process name, or upstream server shutdown endpoints; they act only on the tracked child handle."
requirements-completed: [TTS-02, TTS-03]
duration: 7 min
completed: 2026-05-10
---

# Phase 17 Plan 17-05: App-Managed GPT-SoVITS Launch Lifecycle Summary

**App-owned GPT-SoVITS launch/status/stop/restart lifecycle for a user-provided command, exposed through typed Electron IPC/preload methods with external-server-safe copy.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-09T23:55:50Z
- **Completed:** 2026-05-10T00:00:30Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added `gpt-sovits-process.ts`, which launches exactly the configured command string in the configured working directory and tracks only that spawned child.
- Added app-owned-only stop/restart semantics; no process is stopped when the app did not launch it.
- Added `gptSovits:start`, `gptSovits:status`, `gptSovits:stop`, and `gptSovits:restart` IPC channels plus preload allowlist methods/declarations.
- Centralized required Settings copy for start/stop/restart, stop confirmation, external-server help, and non-local server warning.
- Restored renderer typecheck compatibility with Phase 17 voice-preset defaults and required failed-audio test payload shape.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: process manager behavior tests** - `068db68` (test)
2. **Task 1 GREEN: app-owned process manager** - `2cb78cf` (feat)
3. **Task 2 RED: process lifecycle IPC/preload coverage** - `1a6f900` (test)
4. **Task 2 GREEN: lifecycle IPC/preload methods** - `849c32b` (feat)
5. **Task 3: process-control copy strings and renderer typecheck repair** - `25c6f61` (fix)

**Plan metadata:** pending in final docs commit.

## Files Created/Modified

- `apps/electron-main/src/gpt-sovits-process.ts` - App-owned process manager with typed status, bounded diagnostics, user-command launch, and tracked-child stop/restart.
- `apps/electron-main/tests/gpt-sovits-process.test.ts` - TDD coverage for launch, misconfiguration, app-owned-only stop, no-process stop, and restart.
- `apps/electron-main/tests/ipc-gpt-sovits-process.test.ts` - TDD coverage for lifecycle IPC channels, external-mode responses, cleanup, and preload declarations.
- `apps/electron-main/src/ipc.ts` - Registers and unregisters GPT-SoVITS process lifecycle handlers.
- `apps/electron-main/preload/index.ts` - Adds renderer allowlist methods for GPT-SoVITS lifecycle controls.
- `apps/electron-main/preload/index.d.ts` - Declares process lifecycle request/status bridge types.
- `apps/renderer/src/lib/copy.ts` - Adds required Settings copy strings for safe GPT-SoVITS process controls.
- `apps/renderer/src/state/setup-store.ts`, `LLMSetup.tsx`, `Settings.tsx`, `app-store.tsx`, `Settings.test.tsx` - Supply voice-preset library defaults required by current `StoredConfig` type.
- `apps/renderer/tests/ws-store-audio.test.ts` - Adds required `failed_audio: null` to audio message fixtures.

## Decisions Made

- Used `spawn(command, [], { shell: true, cwd })` because Phase 17 stores a full user-supplied launch command string rather than a curated executable/argv template; this preserves the exact user command while avoiding installer/template behavior.
- Kept lifecycle status concise and renderer-safe, with bounded stdout/stderr diagnostics for future log-panel UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed RED test hook import**
- **Found during:** Task 1 (process manager GREEN)
- **Issue:** The newly committed RED test used `afterEach` without importing it; the original RED failure was masked by the missing implementation module.
- **Fix:** Imported `afterEach` from Vitest before completing the GREEN implementation.
- **Files modified:** `apps/electron-main/tests/gpt-sovits-process.test.ts`
- **Verification:** `npm --workspace apps/electron-main run test -- --run gpt-sovits-process.test.ts` passed.
- **Committed in:** `2cb78cf`

**2. [Rule 3 - Blocking] Restored renderer typecheck after Phase 17 contract changes**
- **Found during:** Task 3 (renderer typecheck)
- **Issue:** Existing renderer setup/store/test fixtures had not yet been updated for required voice-preset library fields on `StoredConfig`, and one audio WS test fixture lacked required `failed_audio` metadata.
- **Fix:** Added voice-preset defaults at renderer config construction/save sites and updated the audio test fixture with `failed_audio: null`.
- **Files modified:** `apps/renderer/src/state/setup-store.ts`, `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx`, `apps/renderer/src/screens/Settings/Settings.tsx`, `apps/renderer/src/state/app-store.tsx`, `apps/renderer/tests/Settings.test.tsx`, `apps/renderer/tests/ws-store-audio.test.ts`
- **Verification:** `npm --workspace apps/renderer run typecheck` passed.
- **Committed in:** `25c6f61`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary to satisfy the plan's TDD and renderer typecheck gates; no GPT-SoVITS installer, environment mutation, or external-server termination scope was added.

## Issues Encountered

- `gsd-sdk query` is unavailable in this environment (`gsd-sdk` only exposes run/auto/init), so STATE/ROADMAP/REQUIREMENTS updates were applied manually.
- Phase 17 planning artifacts remain untracked from prior workflow state; only the 17-05 summary/tracking files are staged for the metadata commit.

## User Setup Required

None - no GPT-SoVITS installation or environment setup was added. Live app-managed launch UAT still requires the user to provide their own command and working directory in the Settings UI built by a later plan.

## Known Stubs

None. No UI-rendered placeholder data or mock-only runtime paths were introduced by this plan.

## Threat Flags

None beyond the plan threat model. The new process-control IPC and user-command OS boundary were already registered as T-17-10 through T-17-12 and mitigated here.

## Auth Gates

None.

## Verification

- `npm --workspace apps/electron-main run test -- --run gpt-sovits-process.test.ts ipc-gpt-sovits-process.test.ts` — passed (9 tests).
- `npm --workspace apps/electron-main run build` — passed.
- `npm --workspace apps/renderer run typecheck` — passed.
- Acceptance grep for `control` in `apps/electron-main/src/gpt-sovits-process.ts` — passed (`0`).
- Acceptance grep for unsafe stop patterns in `apps/electron-main/src/gpt-sovits-process.ts` — passed (`0`).
- Copy-string check for `External server — stop it outside AgenticLLMVTuber.` in `apps/renderer/src/lib/copy.ts` — passed (`1`).

## TDD Gate Compliance

- RED commit present for Task 1: `068db68`.
- GREEN commit present for Task 1: `2cb78cf`.
- RED commit present for Task 2: `1a6f900`.
- GREEN commit present for Task 2: `849c32b`.
- No refactor commits were needed.

## Next Phase Readiness

- Ready for `17-06`: Settings UI can call typed lifecycle methods and display centralized app-managed/external process-control copy.
- Ready for `17-07`: final regression/UAT can verify app-owned process handling without risk of killing external GPT-SoVITS servers.

## Self-Check: PASSED

- Found `apps/electron-main/src/gpt-sovits-process.ts`.
- Found `apps/electron-main/tests/gpt-sovits-process.test.ts`.
- Found `apps/electron-main/tests/ipc-gpt-sovits-process.test.ts`.
- Found commits `068db68`, `2cb78cf`, `1a6f900`, `849c32b`, and `25c6f61` in git log.
- Verification commands passed as listed above.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-10*
