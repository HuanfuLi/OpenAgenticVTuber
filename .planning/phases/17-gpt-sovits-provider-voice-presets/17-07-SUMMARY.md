---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-07
subsystem: renderer-ui-testing-uat
tags: [gpt-sovits, chat, failed-audio, regression, uat, vitest, pytest]
requires:
  - phase: 17-03
    provides: GPT-SoVITS failed-audio metadata and no mid-turn Piper fallback in sidecar payloads
  - phase: 17-06
    provides: Settings provider selection, explicit Piper save path, presets, reference audio, and audible test synthesis UI
provides:
  - Visible GPT-SoVITS failed-audio state in chat while preserving sentence text
  - Final Phase 17 automated regression evidence across contracts, renderer, Electron main, and sidecar
  - UAT evidence document with live-server environment block and manual checklist
affects: [phase-18-rich-voice-settings, chat-ui, tts-provider-failures, phase-17-uat]
tech-stack:
  added: []
  patterns: [failed-audio-chat-marker, next-turn-explicit-fallback-notice, environment-blocked-uat-evidence]
key-files:
  created: [apps/renderer/tests/ChatStreaming.test.tsx, .planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md]
  modified: [apps/renderer/src/screens/Chat/useStreamingMessages.ts, apps/renderer/src/ws/store.ts, apps/renderer/src/screens/Chat/Chat.tsx, apps/renderer/src/lib/copy.ts, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md]
key-decisions:
  - "GPT-SoVITS chat failures are rendered as per-sentence failed-audio markers plus a next-turn Piper selection notice; chat reducers never mutate persisted provider config."
  - "Live GPT-SoVITS UAT is environment-blocked when no server is reachable, but mocked provider/admin and renderer regression evidence remains required and recorded."
patterns-established:
  - "Failed `AudioPayloadMessage` handling requires both `audio === null` and `failed_audio.provider_id === 'gpt_sovits'`; silent/action-only payloads are not treated as failures."
  - "Technical provider failure detail stays out of chat bubbles; the user sees concise copy and an logs affordance."
requirements-completed: [TTS-01, TTS-04, TTS-06, PRESET-01, PRESET-02, PRESET-03, PRESET-04]
duration: 12 min
completed: 2026-05-10
---

# Phase 17 Plan 17-07: Chat Failure Surface, Final Regression, and UAT Summary

**GPT-SoVITS chat failures now preserve sentence text, mark failed audio visibly, avoid chat-side Piper switching, and have final Phase 17 regression/UAT evidence.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T00:11:09Z
- **Completed:** 2026-05-10T00:16:39Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added failed-audio state to streaming chat messages and renderer handling for `audio=null` plus `failed_audio.provider_id='gpt_sovits'`.
- Rendered the required concise sentence failure copy and next-turn Piper fallback notice while keeping raw provider summaries/diagnostics out of the main chat UI.
- Added focused Chat streaming regression tests proving sentence text is appended once, no audio is played, config is not saved, Piper is not selected automatically, and silent/action-only payloads are not marked as failures.
- Ran final Phase 17 regression across contracts, renderer Settings/Chat tests, renderer typecheck, Electron build, and sidecar focused pytest suite.
- Created `17-UAT.md` with automated evidence, manual checklist, and explicit live-server environment-block status.

## Task Commits

Each implementation task was committed atomically where it produced changes:

1. **Task 1 RED: Chat failed-audio behavior tests** - `4a44730` (test)
2. **Task 1 GREEN: Chat failed-audio reducer/UI/store implementation** - `cca60cf` (feat)
3. **Task 2: Cross-tier regression** - no code changes; verification passed with existing committed files.
4. **Task 3: UAT evidence and live-server environment block** - `7dce081` (docs)

**Plan metadata:** committed separately in final docs commit.

## Files Created/Modified

- `apps/renderer/tests/ChatStreaming.test.tsx` - Focused renderer tests for GPT-SoVITS failed-audio payloads, visible failure copy, and no chat-side provider mutation.
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` - Adds per-message audio failure markers and failed-audio banner kind.
- `apps/renderer/src/ws/store.ts` - Routes only GPT-SoVITS `audio=null` payloads with failed metadata into failed-audio state and next-turn fallback notice.
- `apps/renderer/src/screens/Chat/Chat.tsx` - Renders concise failed-audio sentence copy and logs affordance inside affected assistant bubbles.
- `apps/renderer/src/lib/copy.ts` - Adds centralized Chat copy for failed-audio and next-turn Piper fallback notice.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md` - Records automated regression results and environment-blocked live-server UAT.
- `.planning/STATE.md` - Updated Phase 17 position and session continuity.
- `.planning/ROADMAP.md` - Marked Phase 17 complete with 7/7 plans.
- `.planning/REQUIREMENTS.md` - Marked TTS-06 complete.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-07-SUMMARY.md` - This execution summary.

## Decisions Made

- Chat failure handling uses `failed_audio.provider_id === 'gpt_sovits'` as the discriminator; generic silent audio payloads remain non-error action-only envelopes.
- Piper fallback remains only the explicit Settings `Piper local TTS` selection for later turns; chat code displays the notice but never calls config save.
- Live UAT was not faked: no GPT-SoVITS server was reachable at `127.0.0.1:9880`, so `17-UAT.md` marks live-server verification blocked by environment and relies on automated mocked coverage for this execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used uv sidecar Python for pytest regression**
- **Found during:** Task 2 (Run cross-tier regression and close remaining gaps)
- **Issue:** System `python -m pytest` failed because the active system Python has no `pytest` installed.
- **Fix:** Re-ran the exact sidecar focused suite through `uv run --project sidecar python -m pytest ... -q`, matching prior Phase 17 environment guidance.
- **Files modified:** None.
- **Verification:** Sidecar focused suite passed: 32 tests.
- **Committed in:** No file changes; documented in `17-UAT.md` and this summary.

**2. [Rule 3 - Blocking] Narrowed no-silent-fallback grep to git-tracked project files**
- **Found during:** Task 2 (Run cross-tier regression and close remaining gaps)
- **Issue:** The broad PowerShell fallback search descended into `sidecar/.venv` and binary/package artifacts, producing irrelevant output and timing out.
- **Fix:** Re-ran the grep gate over `git ls-files apps sidecar packages`, excluding generated dependency/build directories and filtering documented negative assertions.
- **Files modified:** None.
- **Verification:** Filtered grep returned `no implementation matches`.
- **Committed in:** No file changes; documented in `17-UAT.md` and this summary.

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking/environment adaptations)
**Impact on plan:** Both deviations preserved the intended verification semantics without scope expansion.

## Issues Encountered

- `gsd-sdk query` is unavailable in this environment (`gsd-sdk` only exposes run/auto/init), so STATE/ROADMAP/REQUIREMENTS updates were applied manually.
- No live GPT-SoVITS server was reachable at `http://127.0.0.1:9880/docs`; live audible/manual UAT is documented as environment-blocked in `17-UAT.md`.

## User Setup Required

Live GPT-SoVITS UAT requires a user-run GPT-SoVITS API v2 server and reference audio accessible to that server. See `17-UAT.md` for the checklist.

## Known Stubs

None. Stub-pattern scan found only existing form placeholder copy and future-scope Settings placeholders unrelated to 17-07; the failed-audio UI is wired to real WebSocket payload metadata.

## Threat Flags

None beyond the plan threat model. The new renderer surface consumes already-planned failed-audio metadata, does not add network/file/auth paths, and avoids raw provider diagnostics inline.

## Auth Gates

None.

## Verification

- `npm --workspace apps/renderer run test -- --run ChatStreaming.test.tsx` — passed (5 tests).
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` — passed (43 tests).
- Task 1 acceptance grep equivalent for `saveStoredConfig|active_provider.*piper` in `apps/renderer/src/ws/store.ts` — passed (`count=0`).
- `npm run check:contracts` — passed and generated contract mirrors remained clean.
- `npm --workspace apps/renderer run typecheck` — passed.
- `npm --workspace apps/electron-main run build` — passed.
- `python -m pytest ... -q` — blocked by missing system pytest; fallback used.
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py -q` — passed (32 tests).
- Git-tracked no-silent-fallback grep gate — passed (`no implementation matches`).
- `Test-Path -LiteralPath ".planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md"` — passed.

## TDD Gate Compliance

- RED commit present for Task 1: `4a44730`; GREEN commit present: `cca60cf`.
- Task 2 was verification-only after Task 1 implementation; no new failing test was needed because all cross-tier checks passed without code changes.
- Task 3 was documentation/UAT evidence; no TDD gate applies.
- No refactor commits were needed.

## Next Phase Readiness

- Phase 17 implementation is complete and ready for `/gsd-verify-work`; live GPT-SoVITS server checks remain an environment-dependent UAT item.
- Phase 18 can rely on explicit failed-audio chat copy, Settings-only Piper fallback selection, and `17-UAT.md` evidence boundaries.

## Self-Check: PASSED

- Found `apps/renderer/tests/ChatStreaming.test.tsx`.
- Found `.planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md`.
- Found commits `4a44730`, `cca60cf`, and `7dce081` in git log.
- Verification commands passed as listed above.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-10*
