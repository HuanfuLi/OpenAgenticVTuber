---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-06
subsystem: renderer-ui
tags: [react, settings, gpt-sovits, voice-presets, reference-audio, vitest]
requires:
  - phase: 17-02
    provides: preset persistence and reference-audio validation IPC
  - phase: 17-03
    provides: GPT-SoVITS sidecar health/test synthesis behavior
  - phase: 17-04
    provides: Electron/preload health and test-synthesis bridge
  - phase: 17-05
    provides: app-managed GPT-SoVITS lifecycle bridge
provides:
  - Settings UI for explicit Piper/GPT-SoVITS provider selection
  - Health plus audible test-synthesis gate before GPT-SoVITS activation
  - Global voice preset CRUD and avatar/session active association controls
  - Reference-audio import, validation summary, and in-use delete guard UI
affects: [phase-17-final-uat, phase-18-rich-voice-settings, settings-ui, voice-presets]
tech-stack:
  added: []
  patterns: [candidate-activation-gate, blob-audio-preview-cleanup, renderer-copy-centralization, guarded-destructive-dialogs]
key-files:
  created: []
  modified: [apps/renderer/src/screens/Settings/Settings.tsx, apps/renderer/src/lib/copy.ts, apps/renderer/src/index.css, apps/renderer/tests/Settings.test.tsx]
key-decisions:
  - "GPT-SoVITS Settings edits remain candidate state until both health and audible test synthesis pass; Piper remains an immediate explicit save path."
  - "Test synthesis preview uses a local Blob/ObjectURL Audio path and never touches chat submission or conversation-history APIs."
  - "Preset and reference-audio deletes are blocked in the renderer when active/in use rather than silently falling back or cascading deletes."
patterns-established:
  - "Settings voice controls use centralized COPY.SETTINGS strings for provider, preset, reference-audio, and warning copy."
  - "Reference-audio UI displays app-managed asset metadata and not original absolute user paths."
requirements-completed: [TTS-01, TTS-02, TTS-03, TTS-04, TTS-06, PRESET-01, PRESET-02, PRESET-03, PRESET-04]
duration: 7 min
completed: 2026-05-10
---

# Phase 17 Plan 17-06: Settings Provider, Preset, Reference-Audio, and Audible Test UI Summary

**Settings now supports gated GPT-SoVITS activation with audible Blob preview, explicit Piper selection, global preset CRUD, and guarded reference-audio management.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-10T00:02:32Z
- **Completed:** 2026-05-10T00:09:30Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Replaced the compact Piper-only TTS Settings surface with provider radio rows, GPT-SoVITS base URL/mode fields, app-launched lifecycle controls, health check, test synthesis, and activation gate.
- Added audible test synthesis preview via Blob/ObjectURL + `Audio`, with old preview URL revocation and tests proving no chat/history side effects.
- Added global voice preset empty state, create/rename/select/delete controls, and current avatar/session active association saves.
- Added reference-audio import inputs, managed asset metadata rendering, validation labels, and in-use delete guard.
- Centralized all new user-visible Settings copy in `COPY.SETTINGS`, including the required non-localhost warning.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: provider gate tests** - `5a2ec5e` (test)
2. **Task 1 GREEN: provider setup and audible activation gate** - `5705c4e` (feat)
3. **Task 2 RED: voice preset CRUD tests** - `1ec30c7` (test)
4. **Task 2 GREEN: voice preset CRUD UI** - `cb2809e` (feat)
5. **Task 3 RED: reference-audio management tests** - `92ff866` (test)
6. **Task 3 GREEN: reference-audio management UI** - `01f433f` (feat)

**Plan metadata:** pending in final docs commit.

## Files Created/Modified

- `apps/renderer/src/screens/Settings/Settings.tsx` - Expanded TTS section with provider candidate gates, audible preview, preset CRUD, reference-audio management, and guarded dialogs.
- `apps/renderer/src/lib/copy.ts` - Added centralized Settings copy for GPT-SoVITS provider setup, activation, presets, reference audio, and warnings.
- `apps/renderer/src/index.css` - Added compact card and validation-grid styles matching existing Settings visual language.
- `apps/renderer/tests/Settings.test.tsx` - Added renderer coverage for activation gates, Blob preview/no-history side effects, preset CRUD guards, and reference-audio guards.

## Decisions Made

- Kept GPT-SoVITS selection as candidate UI only until health plus audible test synthesis pass; only Piper selection immediately saves `active_provider: 'piper'`.
- Used a local `Blob` + ObjectURL + `Audio` preview for test synthesis to keep it separate from chat turns, renderer WebSocket audio payloads, and conversation history.
- Rendered managed reference-audio token/basename instead of original absolute user paths to preserve privacy and portability expectations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `gsd-sdk query` is unavailable in this environment (`gsd-sdk` only exposes run/auto/init), so STATE/ROADMAP/REQUIREMENTS updates were applied manually.
- Phase 17 planning artifacts remain untracked from prior workflow state; they were preserved and not staged as part of this 17-06 execution.

## User Setup Required

None - no external service credentials, installers, model downloads, or environment mutations were added. Live GPT-SoVITS UAT still requires the user to run/provide a GPT-SoVITS server and reference audio.

## Known Stubs

None. Stub-pattern scan found only pre-existing Settings placeholders for future non-voice sections and normal form placeholder attributes, not 17-06-blocking stubs.

## Threat Flags

None beyond the plan threat model. The new renderer surfaces stay within the planned user-form, IPC, and test-audio preview boundaries and include the required ObjectURL cleanup and non-localhost warning.

## Auth Gates

None.

## Verification

- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` — passed (38 tests).
- `npm --workspace apps/renderer run typecheck` — passed.
- Acceptance count for hardcoded `Activate voice preset` in `Settings.tsx` — passed (`0`).
- Acceptance count for `avatar_overrides|AvatarOverrides` in `Settings.tsx` — passed (`0`).

## TDD Gate Compliance

- RED commit present for Task 1: `5a2ec5e`; GREEN commit present: `5705c4e`.
- RED commit present for Task 2: `1ec30c7`; GREEN commit present: `cb2809e`.
- RED commit present for Task 3: `92ff866`; GREEN commit present: `01f433f`.
- No refactor commits were needed.

## Next Phase Readiness

- Ready for `17-07`: Settings can activate/test GPT-SoVITS and manage presets/reference audio; final plan can focus on chat failure surface, final regression, and live UAT notes.
- No blockers for renderer Settings continuation.

## Self-Check: PASSED

- Found `apps/renderer/src/screens/Settings/Settings.tsx`, `apps/renderer/src/lib/copy.ts`, `apps/renderer/src/index.css`, and `apps/renderer/tests/Settings.test.tsx`.
- Found commits `5a2ec5e`, `5705c4e`, `1ec30c7`, `cb2809e`, `92ff866`, and `01f433f` in git log.
- Verification commands passed as listed above.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-10*
