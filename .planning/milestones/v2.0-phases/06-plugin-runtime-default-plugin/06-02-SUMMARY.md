---
phase: 06-plugin-runtime-default-plugin
plan: 02
subsystem: plugin-runtime
tags: [python, plugins, compositor, orchestrator, pytest, harness]

requires:
  - phase: 06-plugin-runtime-default-plugin
    plan: 01
    provides: plugin API, manifest loader, prompt-section builder, clamp primitives
provides:
  - Supervised plugin lifecycle with NullPlugin fallback
  - PluginAdapter frame coalescing and stale decay
  - Compositor plugin merge slot with clamp boundary
  - Sidecar boot plugin discovery/supervisor/adapter wiring
  - Orchestrator boot-time manifest prompt freeze
  - Lipsync and idle synthetic plumbing baselines
affects: [06-plugin-runtime-default-plugin, 07-three-category-code-parsing-dispatch, compositor, orchestrator, sidecar-boot]

tech-stack:
  added: []
  patterns:
    - Plugin load failures degrade to NullPlugin instead of aborting sidecar startup
    - Plugin output is coalesced latest-frame-wins, held while fresh, and decayed after 1s
    - Orchestrator prompt bytes are derived once from manifest action-code section at construction

key-files:
  created:
    - sidecar/src/sidecar/plugins/supervisor.py
    - sidecar/src/sidecar/compositor/plugin_adapter.py
    - plugins/default/body_sway/
    - sidecar/scripts/plumbing_harness.py
    - sidecar/tests/architecture/test_pyvts_writer_singleton.py
    - sidecar/tests/plugins/test_supervisor.py
    - sidecar/tests/compositor/test_plugin_adapter.py
    - sidecar/tests/scripts/test_plumbing_harness.py
    - .planning/baselines/v2.0/idle.json
    - .planning/baselines/v2.0/lipsync.json
  modified:
    - sidecar/src/sidecar/compositor/compositor.py
    - sidecar/src/sidecar/compositor/speech_driver.py
    - sidecar/src/sidecar/ws/server.py
    - sidecar/src/sidecar/ws/handlers.py
    - sidecar/src/sidecar/orchestrator/orchestrator.py
    - sidecar/src/sidecar/orchestrator/transformers.py
    - sidecar/src/sidecar/vts/parameter_writer.py
    - apps/renderer/tests/AvatarImport.test.tsx
  deleted:
    - sidecar/src/sidecar/compositor/intent_driver.py
    - sidecar/tests/compositor/test_intent_driver.py

key-decisions:
  - "Invalid or unavailable active plugins fall back to NullPlugin during boot; plugin faults do not crash sidecar startup."
  - "Default body_sway keeps proxy_param.py and exp3_modulation.py as source artifacts, but registry selection exposes only head_only."
  - "The orchestrator does not emit plugin action codes as ActionIntent values; plugins receive raw sentence text separately."

requirements-completed: [ARCH-10]

metrics:
  duration: 12min
  completed: 2026-05-08
  tasks: 4
  files: 35
---

# Phase 06 Plan 02: Runtime Plumbing Summary

**Supervised plugin runtime wiring with compositor adapter, prompt freeze, IntentDriver removal, pyvts singleton guard, and synthetic plumbing baselines**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-08T10:06:42Z
- **Completed:** 2026-05-08T10:18:54Z
- **Tasks:** 4
- **Files modified:** 35

## Accomplishments

- Added `NullPlugin` and `PluginSupervisor` with 5s load timeout, load failure fallback, 3-failures-per-60s stream circuit breaker, and tolerant unload.
- Added `PluginAdapter` with `enqueue_sentence()`, latest-frame-wins frame submission, hold-last-frame behavior, and 1s stale decay.
- Rewired `Compositor` to merge idle -> speech -> plugin -> cursor, then `clamp_and_validate(...)` before writer injection.
- Moved body-sway sources to `plugins/default/body_sway/`; only `head_only` is selectable while `proxy_param.py` and `exp3_modulation.py` remain as source artifacts.
- Deleted production `IntentDriver` and added the architecture guard that keeps `import pyvts` limited to `sidecar/src/sidecar/vts/pyvts_writer.py`.
- Rewired sidecar boot to discover `AGENTICLLMVTUBER_ACTIVE_PLUGIN`, use `AGENTICLLMVTUBER_USER_DATA/plugins`, load through `PluginSupervisor`, construct `PluginAdapter`, and store plugin runtime objects on `app.state`.
- Changed orchestrator prompt construction to use the plugin manifest action-code section once at constructor time; action-code changes affect only newly constructed orchestrators.
- Added `sidecar/scripts/plumbing_harness.py` and generated v2.0 synthetic baselines.

## Task Commits

1. **Task 1: Supervisor and PluginAdapter** - `efea9d4` (test), `3ad49e6` (feat)
2. **Task 2: Rewire compositor merge order and remove IntentDriver** - `70c2fd7`
3. **Task 3: Rewire server boot and orchestrator prompt path** - `3aa594a`
4. **Task 4: Plumbing harness for lipsync and idle baselines** - `fc55adf`
5. **Verification fix** - `3ff0e36`

## Boot Sequence

Sidecar startup now loads avatar overrides and `RigCapabilities`, discovers repo and userData plugin manifests, selects `AGENTICLLMVTUBER_ACTIVE_PLUGIN` or `default`, instantiates the plugin by file-path entrypoint, calls `PluginSupervisor.load_or_null(...)`, wraps it in `PluginAdapter`, builds the action-code prompt section, and passes the adapter into both `Orchestrator` and `Compositor`.

## Harness Outputs

- `.planning/baselines/v2.0/lipsync.json`: `pearson_r=0.9747730195034283`, threshold `0.7`, passed.
- `.planning/baselines/v2.0/idle.json`: `variance_sum=0.06643749130899018`, ceiling `0.5`, passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added repo root to sidecar import path for in-tree plugins**
- **Found during:** Task 2 verification
- **Issue:** `cd sidecar && pytest tests/compositor` could not import repo-root `plugins.default.body_sway`.
- **Fix:** Added repo-root insertion in `sidecar/src/sidecar/__init__.py` when a `plugins/` directory exists.
- **Files modified:** `sidecar/src/sidecar/__init__.py`
- **Commit:** `70c2fd7`

**2. [Rule 3 - Blocking] Removed obsolete IntentDriver test collection**
- **Found during:** Task 2 verification
- **Issue:** `tests/compositor/test_intent_driver.py` imported the deleted production module and blocked compositor test collection.
- **Fix:** Deleted the obsolete test with the deleted runtime module and replaced the architectural invariant with `test_pyvts_writer_singleton.py`.
- **Files modified:** `sidecar/tests/compositor/test_intent_driver.py`, `sidecar/tests/architecture/test_pyvts_writer_singleton.py`
- **Commit:** `70c2fd7`

**3. [Rule 3 - Blocking] Updated renderer AvatarImport fixture for current contract**
- **Found during:** Overall verification
- **Issue:** `npm --workspace apps/renderer run typecheck` failed because a test fixture omitted required `default_plugin_action_bindings`.
- **Fix:** Added `default_plugin_action_bindings: []` to the fixture.
- **Files modified:** `apps/renderer/tests/AvatarImport.test.tsx`
- **Commit:** `3ff0e36`

## Issues Encountered

- Task 2 and Task 3 had a plan-order coupling: Task 2 acceptance required no production `IntentDriver` references, but `server.py` was formally listed under Task 3. The runtime satisfied the invariant after Task 3 rewiring.
- Other agents had unrelated working-tree changes and untracked files during execution, including Phase 7 planning artifacts, Phase 8 UAT notes, avatar override file movement, and `backup/`. These were left untouched.

## Verification

- `cd sidecar && uv run pytest tests/plugins tests/compositor tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/architecture/test_pyvts_writer_singleton.py tests/scripts/test_plumbing_harness.py -q` -> 88 passed.
- `npm run check:contracts` -> passed with no contract drift.
- `npm --workspace apps/renderer run typecheck` -> passed.
- `cd sidecar && uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle.json` -> passed.
- `cd sidecar && uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync.json` -> passed.

## Known Stubs

None introduced that block this plan. Placeholder references found during the stub scan are existing AvatarImport test cases and unrelated UI placeholder surfaces.

## User Setup Required

None.

## Next Phase Readiness

06-03 can provide the actual default plugin class and `plugin.yaml`; 06-02 already boots safely with `NullPlugin` when the active plugin is absent or invalid.

## Self-Check: PASSED

- Created files listed in this summary exist.
- Task commits `efea9d4`, `3ad49e6`, `70c2fd7`, `3aa594a`, `fc55adf`, and verification fix `3ff0e36` exist in git history.
