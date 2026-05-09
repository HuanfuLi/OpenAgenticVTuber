---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 04
subsystem: body-sway-evidence
tags: [body-sway, vts, teto, exp3, matplotlib, verification]
requires:
  - phase: 04-00
    provides: Seeded Teto override file with deferred smoke-pass status
  - phase: 04-02
    provides: Body-sway strategy registry and dev-panel hot-switch
provides:
  - Deferred body-sway evidence directory for Phase 5 SC-01
  - Matplotlib plotter for speech-driver RMS-vs-output logs
  - exp3_modulation audit closing RESEARCH Open-Q2 for Teto
  - Ship-default override note keeping head_only until live A/B succeeds
affects: [phase-5-verification, skeleton-verification, AVT-06]
tech-stack:
  added: [matplotlib>=3.8]
  patterns: [deferred live-VTS evidence stubs, expression-parameter audit table]
key-files:
  created:
    - .planning/skeleton-verification-evidence/04/README.md
    - .planning/skeleton-verification-evidence/04/head_only/rating.md
    - .planning/skeleton-verification-evidence/04/proxy_param/rating.md
    - .planning/skeleton-verification-evidence/04/exp3_modulation/candidate_audit.md
    - .planning/skeleton-verification-evidence/04/exp3_modulation/rating.md
    - sidecar/scripts/plot_speech_evidence.py
  modified:
    - avatars/teto/teto_overrides.yaml
    - sidecar/pyproject.toml
    - sidecar/uv.lock
key-decisions:
  - "head_only remains the ship default because live VTS/operator verification was unavailable and proxy_param is still unproven."
  - "exp3_modulation is not viable with Teto's current expression inventory; only ParamBHandIN appears and it is tied to prop/hand toggles, not body sway."
  - "Phase 5 SC-01 must re-run live A/B and replace deferred logs, plots, ratings, and missing clip.mp4 files before sign-off."
patterns-established:
  - "Deferred evidence stubs start with '# DEFERRED' and state the exact live capture requirement."
  - "RMS-vs-output plots can render placeholder PNGs when live log samples are absent."
requirements-completed: [AVT-06]
duration: 7min
completed: 2026-05-08
---

# Phase 04 Plan 04: Body-Sway Investigation Evidence Summary

**Deferred VTS body-sway evidence package with exp3 candidate audit and head_only locked as the safe default**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-08T04:44:06Z
- **Completed:** 2026-05-08T04:49:53Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Created `.planning/skeleton-verification-evidence/04/` with per-strategy deferred log stubs, ratings, and placeholder RMS-vs-output plots.
- Added `sidecar/scripts/plot_speech_evidence.py` plus `matplotlib>=3.8` so Phase 5 can regenerate plots from real `[SPEECH-DRIVER]` captures.
- Audited Teto's actual 15 `.exp3.json` files and found no viable `exp3_modulation` body-sway candidate.
- Updated `avatars/teto/teto_overrides.yaml` to record that `head_only` remains the safe default until Phase 5 live A/B proves another strategy.

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-strategy log capture + matplotlib plotter** - `56a37ee` (feat)
2. **Task 2: exp3_modulation candidate audit** - `f54d439` (docs)
3. **Task 3: Lock ship-default body_sway_strategy** - `20bf14c` (docs)

## Files Created/Modified

- `.planning/skeleton-verification-evidence/04/README.md` - Evidence index, methodology, deferred path, and Phase 5 SC-01 re-run checklist.
- `.planning/skeleton-verification-evidence/04/head_only/*` - Deferred log stub, placeholder plot, and rating for the fallback strategy.
- `.planning/skeleton-verification-evidence/04/proxy_param/*` - Deferred log stub, placeholder plot, and rating for `Lean Forward`.
- `.planning/skeleton-verification-evidence/04/exp3_modulation/candidate_audit.md` - Per-file audit of all 15 current Teto expressions.
- `.planning/skeleton-verification-evidence/04/exp3_modulation/rating.md` - Non-viable rating for current Teto expression artifacts.
- `sidecar/scripts/plot_speech_evidence.py` - Matplotlib parser/plotter for `[SPEECH-DRIVER]` log captures.
- `avatars/teto/teto_overrides.yaml` - Adds `notes.body_sway_investigation_outcome`.
- `sidecar/pyproject.toml` and `sidecar/uv.lock` - Add/install matplotlib.

## Decisions Made

- `head_only` remains the default in `avatars/teto/teto_overrides.yaml` because both prior smoke-pass and this live A/B run were deferred.
- `proxy_param` is not accepted as the default until Phase 5 proves `Lean Forward` is visible and coupled to speech on the live rig.
- `exp3_modulation` is rejected for the current Teto artifact set; a new Cubism-authored body-pose expression would be required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used deferred evidence path because live VTS/operator verification was unavailable**
- **Found during:** Task 1
- **Issue:** The checkpoint required visual confirmation and screen clips, but no live operator/VTS verification was available in this executor context.
- **Fix:** Created explicit deferred logs, ratings, placeholder plots, and README instructions instead of empty artifacts.
- **Files modified:** `.planning/skeleton-verification-evidence/04/**`
- **Verification:** File existence checks passed; deferred logs begin with `# DEFERRED`; matplotlib generated placeholder PNGs.
- **Committed in:** `56a37ee`

**2. [Rule 1 - Bug] Audited the actual expression inventory instead of the stale expected count**
- **Found during:** Task 2
- **Issue:** The plan stated Teto had 14 `.exp3.json` files, but the checked-in directory contains 15.
- **Fix:** Audited all 15 files and documented the count mismatch in `candidate_audit.md`.
- **Files modified:** `.planning/skeleton-verification-evidence/04/exp3_modulation/candidate_audit.md`
- **Verification:** `candidate_audit.md` includes `Star Eye.exp3.json` and all current expression files.
- **Committed in:** `f54d439`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** The investigation deliverable is complete as a deferred evidence package. Phase 5 must replace deferred artifacts with live evidence before SC-01 sign-off.

## Known Stubs

- `.planning/skeleton-verification-evidence/04/head_only/log_capture.txt` - Deferred live `[SPEECH-DRIVER]` capture stub; replace during Phase 5 SC-01.
- `.planning/skeleton-verification-evidence/04/proxy_param/log_capture.txt` - Deferred live `[SPEECH-DRIVER]` capture stub; replace during Phase 5 SC-01.
- `.planning/skeleton-verification-evidence/04/exp3_modulation/log_capture.txt` - Deferred unless a viable body-pose `.exp3.json` is authored later.
- `.planning/skeleton-verification-evidence/04/*/rms_vs_output.png` - Placeholder plots generated from deferred logs; regenerate from live logs.
- `.planning/skeleton-verification-evidence/04/*/clip.mp4` - Intentionally absent; Phase 5 must capture 5-10s live clips before sign-off.

## Issues Encountered

- Repo-root Python did not have `pyyaml`; YAML verification was run from `sidecar` with `uv run`, where `pyyaml` is installed.
- `uv` warned that `[tool.uv].dev-dependencies` is deprecated; this is pre-existing project configuration and not changed by the plan.

## Verification

- `Test-Path .planning/skeleton-verification-evidence/04/README.md` - passed.
- `Test-Path .planning/skeleton-verification-evidence/04/{head_only,proxy_param,exp3_modulation}/rating.md` - passed.
- `Test-Path .planning/skeleton-verification-evidence/04/exp3_modulation/candidate_audit.md` - passed.
- `cd sidecar && uv run python -c "import matplotlib; print(matplotlib.__version__)"` - passed, printed `3.10.9`.
- `cd sidecar && uv run python -` YAML assertion - passed, printed `strategy=head_only`.
- Deferred log check - passed, non-fallback logs start with `# DEFERRED`.

## User Setup Required

Phase 5 SC-01 requires live operator verification with VTS+Teto loaded. The operator must use the dev-panel hot-switch, capture live logs and 5-10s clips per strategy, regenerate plots, and replace deferred ratings with live observations.

## Next Phase Readiness

Phase 5 can navigate from `.planning/skeleton-verification.md` to `.planning/skeleton-verification-evidence/04/README.md`, then to each strategy rating. The only blocker for final SC-01 sign-off is the live VTS A/B re-run documented in the README.

## Self-Check: PASSED

- Found summary, evidence README, strategy ratings, exp3 audit, plotter, and Teto override file.
- Found task commits `56a37ee`, `f54d439`, and `20bf14c` in git history.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-08*
