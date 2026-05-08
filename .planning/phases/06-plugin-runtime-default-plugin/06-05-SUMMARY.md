---
phase: 06-plugin-runtime-default-plugin
plan: 05
subsystem: plugin-runtime
tags: [watchdog, plugin-manifest, lifespan, fastapi, pytest]

requires:
  - phase: 06-plugin-runtime-default-plugin
    provides: PluginManifest loading, restart-required manifest warning helper, and boot-time plugin prompt assembly.
provides:
  - Production watchdog observer for the active plugin.yaml manifest.
  - Warning-only manifest reparse path that preserves boot-time prompt and plugin state.
  - Regression tests for watcher callback behavior and lifespan wiring.
affects: [plugin-runtime, sidecar-lifespan, phase-06-verification]

tech-stack:
  added: [watchdog==6.0.0]
  patterns:
    - File watcher callbacks reparse metadata and warn, but never mutate active runtime state.
    - Source guards preserve boot-time prompt construction invariants.

key-files:
  created:
    - sidecar/tests/plugins/test_manifest_watcher.py
  modified:
    - sidecar/pyproject.toml
    - sidecar/uv.lock
    - sidecar/src/sidecar/plugins/loader.py
    - sidecar/src/sidecar/ws/server.py

key-decisions:
  - "Manifest changes are warning-only: plugin.yaml is reparsed for comparison, but app.state.plugin_manifest, action_codes_section, and the active plugin remain boot-time values until restart."
  - "Watcher tests exercise the event handler directly instead of relying on filesystem timing."

patterns-established:
  - "Manifest watcher lifecycle: start after active boot manifest load, store on app.state, stop during lifespan shutdown."
  - "Watcher failure behavior: malformed plugin.yaml logs [PLUGIN-MANIFEST-WATCH] and keeps the observer alive."

requirements-completed: [PLG-10, PLG-09, ARCH-09]

duration: 9min
completed: 2026-05-08
---

# Phase 06 Plan 05: Manifest Watcher Gap Closure Summary

**Watchdog-backed active plugin.yaml watcher that reparses manifest metadata, logs restart-required warnings, and leaves prompt/plugin runtime state frozen until restart.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-08T10:52:00Z
- **Completed:** 2026-05-08T11:00:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `watchdog==6.0.0` and locked it for the sidecar runtime.
- Added `ManifestChangeWatcher` plus `start_manifest_change_watcher()` in the loader.
- Wired the watcher into FastAPI lifespan after loading the active boot manifest and stopped it during shutdown.
- Added direct handler tests proving changed action descriptions warn, unrelated files are ignored, invalid YAML does not raise, and watcher code does not rebuild prompt sections.
- Added source guards proving `server.py` starts/stops the watcher and still builds `action_codes_section` only once before `Orchestrator(...)`.

## Task Commits

TDD tasks were committed as test then implementation:

1. **Task 1: Add manifest watcher helper around existing warning path**
   - `50f4703` test: failing manifest watcher tests
   - `7d3a18e` feat: watchdog dependency and loader watcher implementation
2. **Task 2: Wire watcher into sidecar lifespan without prompt rebuild or hot-swap**
   - `c9f9f05` test: failing lifespan watcher source guard
   - `8731bb1` feat: lifespan watcher startup/shutdown wiring

## Files Created/Modified

- `sidecar/pyproject.toml` - Adds `watchdog==6.0.0`.
- `sidecar/uv.lock` - Locks watchdog runtime dependency.
- `sidecar/src/sidecar/plugins/loader.py` - Adds manifest event handler, watcher wrapper, start helper, and warning-on-reparse failure behavior.
- `sidecar/src/sidecar/ws/server.py` - Starts the watcher from the active manifest path and stops it during lifespan shutdown.
- `sidecar/tests/plugins/test_manifest_watcher.py` - Covers watcher callback behavior and prompt-freeze source guards.

## Decisions Made

- Manifest hot-reload is intentionally not a hot-swap: it reparses only for comparison and warning. The active manifest, prompt section, and plugin adapter keep their boot-time values.
- Tests avoid observer sleeps by calling `_ManifestFileEventHandler` directly with synthetic events.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Log assertions use a temporary loguru sink because pytest `caplog` does not capture loguru messages in this repo by default.

## Known Stubs

- `sidecar/src/sidecar/ws/server.py:58` contains a pre-existing TODO about Electron writing `AGENTICLLMVTUBER_LLM_CONFIG_JSON` into the sidecar environment. It is unrelated to PLG-10 and does not affect this watcher gap closure.

## Verification

- `cd sidecar && uv run pytest tests/plugins/test_manifest_watcher.py -x --no-header` - passed, 5 tests.
- `cd sidecar && uv run pytest tests/plugins/test_manifest_watcher.py tests/test_phase4_bootstrap.py -x --no-header` - passed, 6 tests.
- `cd sidecar && uv run pytest tests/plugins tests/compositor tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/architecture/test_pyvts_writer_singleton.py -q` - passed, 103 tests.
- `npm run check:contracts` - passed.
- `npm --workspace apps/renderer run typecheck` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

PLG-10 is closed for production wiring: active plugin manifests are watched after boot, prompt-affecting changes warn the operator to restart, and PLG-09/ARCH-09 startup-only behavior remains guarded by tests.

## Self-Check: PASSED

- Verified summary and all created/modified files exist.
- Verified commits exist: `50f4703`, `7d3a18e`, `c9f9f05`, `8731bb1`.

---
*Phase: 06-plugin-runtime-default-plugin*
*Completed: 2026-05-08*
