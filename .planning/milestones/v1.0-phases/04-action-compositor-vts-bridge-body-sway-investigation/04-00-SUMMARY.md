---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 00
subsystem: avatar-vts-smoke-pass
tags: [vts, pyvts, avatar-overrides, teto, body-sway, hotkeys]
requires:
  - phase: 03-tts-sentence-buffered-audio
    provides: Phase 3 VTS token path and mouth-driver pyvts auth pattern
provides:
  - TetoOverrides Pydantic loader for avatars/teto/teto_overrides.yaml
  - Importable teto-smoke-pass CLI for live VTS parameter and hotkey discovery
  - Seeded Teto override file with 15 rig hotkeys and safe head_only body-sway default
  - Avatar override tests validating defaults, round-trip, and committed YAML
affects: [04-02-body-sway-strategy, 04-03-discrete-event-demo, phase-5-verification]
tech-stack:
  added: []
  patterns: [engineer-curated avatar override file, smoke-pass deferred seed]
key-files:
  created:
    - sidecar/src/sidecar/avatar/overrides.py
    - sidecar/scripts/__init__.py
    - sidecar/scripts/teto_smoke_pass.py
    - avatars/teto/teto_overrides.yaml
    - sidecar/tests/avatar/__init__.py
    - sidecar/tests/avatar/test_overrides.py
  modified:
    - sidecar/src/sidecar/avatar/__init__.py
    - sidecar/pyproject.toml
key-decisions:
  - "Seeded teto_overrides.yaml from Live2D/重音テト/重音テト.vtube.json because live smoke-pass execution is an operator action; the file explicitly records smoke_pass_status=deferred."
  - "Kept body_sway_strategy=head_only and proxy_body_param=null until Lean Forward is empirically proven visible by the live smoke-pass."
  - "Picked Star Eye [7] as the recommended DiscreteEvent demo target for 04-03."
patterns-established:
  - "TetoOverrides loader is tolerant of missing override files and returns safe head_only defaults."
  - "Meta hotkeys are represented with is_meta=true and llm_emittable=false."
requirements-completed: [AVT-06, AVT-07]
duration: 35min
completed: 2026-05-07
---

# Phase 04 Plan 00: Teto Smoke-Pass Entry Gate Summary

**Teto override schema, smoke-pass CLI, and seeded hotkey inventory for Phase 4 body-sway and DiscreteEvent work**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-07T22:10:00Z
- **Completed:** 2026-05-07T22:45:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `TetoOverrides`, `ParamProbeResult`, and `DiscoveredHotkey` models plus load/save helpers.
- Added `uv run teto-smoke-pass` CLI that connects to VTS, probes `Lean Forward` and `Auto Breath`, discovers hotkeys, and writes `avatars/teto/teto_overrides.yaml`.
- Seeded `avatars/teto/teto_overrides.yaml` from the checked-in Teto `.vtube.json` with 15 hotkeys, 2 meta exclusions, and safe `head_only` body-sway default.
- Added tests proving default behavior, missing-file fallback, save/load round-trip, committed YAML validation, and meta-hotkey exclusion.

## Task Commits

Each task was implemented in one inline commit because subagent execution was unavailable:

1. **Tasks 1-3: Teto overrides, smoke-pass CLI, seeded YAML, and tests** - `e726c34` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/avatar/overrides.py` - Pydantic schema and YAML load/save helpers for Teto overrides.
- `sidecar/scripts/teto_smoke_pass.py` - Operator CLI for live VTS smoke-pass probing and hotkey discovery.
- `avatars/teto/teto_overrides.yaml` - Seeded override artifact with `head_only`, 15 hotkeys, 2 meta flags, and deferred smoke-pass note.
- `sidecar/tests/avatar/test_overrides.py` - Loader and committed YAML validation tests.
- `sidecar/src/sidecar/avatar/__init__.py` - Exports both Phase 2 capabilities and Phase 4 override surfaces.
- `sidecar/pyproject.toml` - Registers `teto-smoke-pass` project script.

## Decisions Made

- Live smoke-pass was not claimed. The committed YAML records `smoke_pass_status: deferred - operator to re-run when VTS available`.
- `body_sway_strategy` remains `head_only` because no empirical `Lean Forward` probe result exists yet.
- `Star Eye [7]` is recorded as `notes.discrete_event_demo_target` for 04-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected smoke-pass output path**
- **Found during:** Task 2 (smoke-pass CLI)
- **Issue:** Initial script output path pointed under `sidecar/avatars`, but project avatars live at repo-root `avatars/`.
- **Fix:** Changed the script to write to `Path(__file__).resolve().parents[2] / "avatars" / "teto"`.
- **Files modified:** `sidecar/scripts/teto_smoke_pass.py`
- **Verification:** Script import check passes and committed YAML validates through the sidecar environment.
- **Committed in:** `e726c34`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Corrected path handling only; no scope expansion.

## Issues Encountered

- Subagent spawning failed due to agent thread limit, so the plan was executed inline using the workflow fallback.
- `uv` required escalated execution because its global cache under `AppData\Local\uv\cache` is inaccessible from the sandbox.
- Repo-root Python lacked `pyyaml`; YAML validation was rerun from the sidecar environment where `pyyaml` is a dependency.

## Verification

- `cmd /c uv run pytest tests/avatar/test_overrides.py -x -v` - 6 passed.
- `cmd /c uv run python -c "import importlib; m=importlib.import_module('scripts.teto_smoke_pass'); ..."` - passed.
- `cmd /c uv run python -c "from sidecar.avatar import TetoOverrides, load_overrides, AvatarCapabilities; ..."` - passed.
- `cmd /c uv run python -c "import yaml; d = yaml.safe_load(open('../avatars/teto/teto_overrides.yaml', ...)); ..."` - passed.
- `Select-String` confirmed `Lean Forward` and `Auto Breath` exist in `Live2D/重音テト/重音テト.vtube.json`.

## User Setup Required

None - no new external service configuration required. Operator should run `cd sidecar && uv run teto-smoke-pass` with VTS + Teto loaded before final body-sway investigation evidence.

## Next Phase Readiness

04-02 can read `body_sway_strategy=head_only` as the safe default and should treat `proxy_param` as unproven until smoke-pass is rerun live. 04-03 can use `Star Eye [7]` / `ebd026ebc2f64dd0835ded46b7170166` as the DiscreteEvent demo target.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-07*
