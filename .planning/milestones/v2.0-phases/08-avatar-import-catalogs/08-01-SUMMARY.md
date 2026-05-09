---
phase: 08-avatar-import-catalogs
plan: 01
subsystem: avatar-import-contracts
tags: [pydantic, live2d, vtube-studio, cubism, jsonschema, pyvts]
requires:
  - phase: 05-polish-contracts-codegen-14-verification
    provides: contracts package pattern and sidecar pytest baseline
provides:
  - AvatarOverrides, RigCapabilities, VariantEntry, EventEntry, AvatarImportPlan Pydantic contracts
  - VTS, Cubism named, Cubism bare, and OLVT catalog extractors
  - Avatar override JSON Schema and normalization helpers
  - IMP-10 VTS introspection smoke script
affects: [phase-06-plugin-runtime, phase-07-code-system, phase-09-slider-hud]
tech-stack:
  added: [jsonschema==4.26.0]
  patterns: [pure extractor tuple returns, canonical contracts package, legacy sidecar re-export shims]
key-files:
  created:
    - packages/contracts/py/contracts/avatar_overrides.py
    - packages/contracts/py/contracts/rig_capabilities.py
    - sidecar/src/sidecar/avatar/extractors/vts.py
    - sidecar/src/sidecar/avatar/extractors/cubism_named.py
    - sidecar/src/sidecar/avatar/extractors/cubism_bare.py
    - sidecar/src/sidecar/avatar/extractors/olvt.py
    - sidecar/scripts/vts_introspect_smoke.py
  modified:
    - sidecar/src/sidecar/avatar/overrides.py
    - sidecar/src/sidecar/avatar/capabilities.py
    - sidecar/pyproject.toml
key-decisions:
  - "Kept sidecar/src/sidecar/avatar/capabilities.py as a temporary empty compatibility shim until Phase 6 rewrites legacy callers."
  - "Forced jsonschema==4.26.0 through uv override-dependencies because litellm==1.83.14 pins jsonschema==4.23.0."
  - "Included cdi3 parameter IDs in RigCapabilities.writable_param_ids so Teto exposes the full 100+ parameter surface expected by ARCH-02/HUD consumers."
patterns-established:
  - "Extractors return (variants, events, warnings) with ImportWarning reserved for review-screen surfacing."
  - "AvatarOverrides is canonical in packages/contracts and sidecar/avatar/overrides.py re-exports it with TetoOverrides aliases."
requirements-completed: [IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-09, IMP-10, ARCH-02]
duration: 13min
completed: 2026-05-08
---

# Phase 08 Plan 01: Avatar Import Contracts + Extractors Summary

**Live2D avatar catalog foundation with canonical Pydantic contracts, four fixture-backed extractors, rig capability reflection, and a VTS introspection smoke script.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-08T08:20:13Z
- **Completed:** 2026-05-08T08:33:43Z
- **Tasks:** 4
- **Files modified:** 31

## Accomplishments

- Added canonical `AvatarOverrides`, `RigCapabilities`, `VariantEntry`, `EventEntry`, and `AvatarImportPlan` contracts under `packages/contracts/py/contracts/`.
- Implemented VTS, Cubism-named, Cubism-bare, and OLVT extractors. Verified: Teto `14/14` variants, mao_pro `8/8` placeholders, shizuku `3` non-Idle events, OLVT Teto `6` variants.
- Added `normalize.py`, `motion3_meta.py`, `cdi3_reader.py`, and `build_rig_capabilities()` for Phase 6/7/9 consumers.
- Added `sidecar/schemas/avatar_overrides.schema.json` with two catalogs only: `variants[]` and `events[]`; no `emotion_bindings`.
- Added `sidecar/scripts/vts_introspect_smoke.py`; with VTS not running it exits `3` and prints the friendly connection-refused message.

## Task Commits

1. **Task 1 RED scaffolds** - `fa26bb8` (test)
2. **Task 1 contracts + schema + loader** - `b284d34` (feat)
3. **Task 2 metadata readers** - `91d9175` (feat)
4. **Task 3 catalog extractors** - `a690f2f` (feat)
5. **Task 4 rig reflector + smoke script** - `03b3574` (feat)

## Verification

- `cd sidecar && uv run pytest tests/avatar/ -x --no-header` -> `35 passed, 1 xfailed`
- `cd sidecar && uv run python -c "from contracts.rig_capabilities import RigCapabilities; from contracts.avatar_overrides import AvatarOverrides; from contracts.avatar_import_plan import AvatarImportPlan, ImportWarning; print('OK')"` -> `OK`
- `cd sidecar && uv run python scripts/vts_introspect_smoke.py` -> exit code `3` with "Is VTube Studio running?" message
- Greps confirmed no `emotion_bindings` in schema or `RigCapabilities`, and no OLVT `emotionMap` read path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved jsonschema dependency conflict**
- **Found during:** Task 1
- **Issue:** `litellm==1.83.14` pins `jsonschema==4.23.0`, conflicting with the plan-required `jsonschema==4.26.0`.
- **Fix:** Added `tool.uv.override-dependencies = ["jsonschema==4.26.0"]`.
- **Files modified:** `sidecar/pyproject.toml`, `sidecar/uv.lock`
- **Verification:** `cd sidecar && uv sync` succeeded and installed `jsonschema==4.26.0`.
- **Committed in:** `b284d34`

**2. [Rule 1 - Bug] Preserved legacy Hotkey constructor shape in the compatibility shim**
- **Found during:** Task 4 regression sweep
- **Issue:** Non-avatar tests instantiate `Hotkey(name, type)` without the new `hotkey_id`.
- **Fix:** Defined local compatibility `Expression`, `Hotkey`, and `Parameter` Pydantic classes in `capabilities.py`.
- **Files modified:** `sidecar/src/sidecar/avatar/capabilities.py`
- **Verification:** The original constructor failure was cleared in the non-avatar sweep.
- **Committed in:** `03b3574`

**3. [Rule 2 - Missing Critical] Included CDI parameters in RigCapabilities writable surface**
- **Found during:** Task 4
- **Issue:** Teto `.vtube.json` exposes only 22 output params, but ARCH-02/HUD consumers require the full rig parameter surface.
- **Fix:** Added `.cdi3.json` parameter IDs to `writable_param_ids` while keeping `param_ranges` as `None`.
- **Files modified:** `sidecar/src/sidecar/avatar/rig_capabilities.py`
- **Verification:** `test_build_from_teto` passes with `len(writable_param_ids) > 50` and `len(cdi3_display_names) > 50`.
- **Committed in:** `03b3574`

**Total deviations:** 3 auto-fixed.

## Known Stubs

- `sidecar/tests/avatar/test_import_detect.py` remains `xfail` because type detection is owned by plan `08-02`; it is a collectable Wave 0 scaffold and does not block this plan's contract/extractor goal.
- `sidecar/src/sidecar/avatar/capabilities.py` is intentionally a temporary compatibility shim with `TODO(Phase 6)`. It keeps imports resolving but `tag_vocabulary()` returns `""` until Phase 6 rewrites legacy prompt/action callers.

## Issues Encountered

- Non-avatar regression sweep currently stops at `tests/test_actions_extractor.py::test_real_teto_avatar_yaml_extracts_joy_intent` because the temporary `AvatarCapabilities` shim has no tag vocabulary. This is expected fallout from D-A1-1 and is closed by Phase 6.

## Next Phase Readiness

Plans 08-02 and 08-03 can consume the contract and parser layer directly. The HTTP/IPC plan should wire type detection, atomic writes, and review-screen persistence against these contracts; Phase 6 should delete the `capabilities.py` shim after replacing legacy `AvatarCapabilities` callers.

## Self-Check: PASSED

- Verified key created files exist.
- Verified task commits exist: `fa26bb8`, `b284d34`, `91d9175`, `a690f2f`, `03b3574`.

---
*Phase: 08-avatar-import-catalogs*
*Completed: 2026-05-08*
