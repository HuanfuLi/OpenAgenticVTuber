---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 07
subsystem: body-sway-evidence-tooling
tags: [speech-driver, body-sway, log-parser, matplotlib, AVT-06]
requires:
  - phase: 04-04
    provides: Deferred body-sway evidence package and plot_speech_evidence.py
provides:
  - Real SpeechDriver runtime log format with body_params output
  - plot_speech_evidence parser compatibility for runtime and legacy deferred logs
  - Regression tests for SpeechDriver logging and speech evidence parsing
affects: [phase-5-verification, skeleton-verification, AVT-06]
tech-stack:
  added: []
  patterns: [runtime-log-parser contract tests, body_params evidence logging]
key-files:
  created:
    - sidecar/tests/scripts/__init__.py
    - sidecar/tests/scripts/test_plot_speech_evidence.py
  modified:
    - sidecar/src/sidecar/compositor/speech_driver.py
    - sidecar/scripts/plot_speech_evidence.py
    - sidecar/tests/compositor/test_speech_driver.py
    - .planning/skeleton-verification-evidence/04/README.md
key-decisions:
  - "SpeechDriver logs body strategy output separately as body_params and excludes MouthOpen from that evidence field."
  - "plot_speech_evidence.py keeps compatibility with legacy deferred stubs while preferring the real runtime [SPEECH-DRIVER] sentence_id format."
patterns-established:
  - "Runtime evidence logs use: [SPEECH-DRIVER] sentence_id=... strategy=... rms=... mouth=... body_params=[key=value,...]."
requirements-completed: [AVT-06]
duration: 4min
completed: 2026-05-08
---

# Phase 04 Plan 07: Speech Evidence Log Alignment Summary

**SpeechDriver body_params runtime logs with parser compatibility for Phase 5 live RMS-vs-output plots**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-08T05:32:03Z
- **Completed:** 2026-05-08T05:36:05Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added parser regression tests for the real runtime `[SPEECH-DRIVER] sentence_id=... body_params=[...]` format and the older deferred-stub format.
- Updated `SpeechDriver.tick()` to log active strategy, RMS, mouth value, and sorted body strategy outputs as `body_params`.
- Updated `plot_speech_evidence.py` to parse both runtime and legacy evidence lines, including body parameter names with spaces such as `Lean Forward`.
- Updated the Phase 4 evidence README with the exact Phase 5 live-capture log example and compatibility note.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add parser regression tests for real SpeechDriver logs** - `2cb3470` (test)
2. **Task 2: Emit body_params in SpeechDriver and update parser regex** - `fe2148b` (feat)
3. **Task 3: Update evidence README commands to use real runtime log format** - `92333a2` (docs)

## Files Created/Modified

- `sidecar/tests/scripts/__init__.py` - Makes the scripts test package importable.
- `sidecar/tests/scripts/test_plot_speech_evidence.py` - Covers runtime log parsing, legacy stub parsing, and empty body params.
- `sidecar/src/sidecar/compositor/speech_driver.py` - Emits runtime evidence logs with `body_params=[key=value,...]`.
- `sidecar/scripts/plot_speech_evidence.py` - Parses both runtime and legacy `[SPEECH-DRIVER]` log shapes.
- `sidecar/tests/compositor/test_speech_driver.py` - Proves `body_params` contains strategy output and excludes `MouthOpen`.
- `.planning/skeleton-verification-evidence/04/README.md` - Shows the Phase 5 runtime log example and plotter compatibility note.

## Decisions Made

- Body evidence logs now separate body strategy output from mouth output so RMS-vs-output plots cannot accidentally plot `MouthOpen`.
- Parser compatibility is additive: Phase 5 live captures should use the runtime format, while existing deferred stubs remain readable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Allowed body parameter names with spaces in the evidence parser**
- **Found during:** Task 2
- **Issue:** The planned parser regex for body params would not parse real proxy output names like `Lean Forward` because the existing key regex excluded whitespace.
- **Fix:** Changed `PARAM_PATTERN` to capture keys up to `=` or `,`, then strip surrounding whitespace.
- **Files modified:** `sidecar/scripts/plot_speech_evidence.py`
- **Verification:** `uv run pytest tests/compositor/test_speech_driver.py tests/scripts/test_plot_speech_evidence.py -x -v` passed.
- **Committed in:** `fe2148b`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The parser is more faithful to real VTS/Teto parameter names without changing the planned log format.

## Known Stubs

- `sidecar/scripts/plot_speech_evidence.py:73` and `:74` - Existing deferred placeholder text is intentionally rendered only when live log samples are absent.
- `.planning/skeleton-verification-evidence/04/README.md:54` and `:56` - Existing deferred evidence stubs remain documented; Phase 5 must replace them with live VTS captures before SC-01 sign-off.

## Issues Encountered

- The plan-level plotter verification rewrote the existing placeholder PNG; the generated binary change was discarded because 04-07 owns the README and tooling, not refreshed evidence artifacts.
- `uv` warned that `[tool.uv].dev-dependencies` is deprecated; this is pre-existing project configuration.

## Verification

- `cd sidecar && uv run pytest tests/scripts/test_plot_speech_evidence.py -x -v` - RED failed before parser update, then passed after Task 2.
- `cd sidecar && uv run pytest tests/compositor/test_speech_driver.py tests/scripts/test_plot_speech_evidence.py -x -v` - passed, 9 tests.
- `cd sidecar && uv run python -m scripts.plot_speech_evidence --input ../.planning/skeleton-verification-evidence/04/head_only/log_capture.txt --output ../.planning/skeleton-verification-evidence/04/head_only/rms_vs_output.png --primary-param FaceAngleX` - passed.
- `rg "\[SPEECH-DRIVER\] sentence_id=.*body_params=\[" .planning/skeleton-verification-evidence/04/README.md` - passed.

## User Setup Required

None for this tooling change. Phase 5 still requires live VTS+Teto operator verification to replace deferred logs, plots, ratings, and clips.

## Next Phase Readiness

Phase 5 can capture real `SpeechDriver` logs without hand-editing and regenerate RMS-vs-output plots from the committed parser. Live VTS body-sway proof remains the human verification gate for SC-01.

## Self-Check: PASSED

- Found all created/modified files listed in this summary.
- Found task commits `2cb3470`, `fe2148b`, and `92333a2` in git history.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-08*
