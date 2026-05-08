---
phase: 08-avatar-import-catalogs
verified: 2026-05-08T09:06:16Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "OLVT model_dict.json import preserves both required catalog surfaces: emotionMap as default-plugin action bindings and actionMap as variant catalog"
    status: failed
    reason: "Implementation intentionally ignores emotionMap and no AvatarOverrides/RigCapabilities/plugin-default binding field exists, while ROADMAP and REQUIREMENTS require emotionMap-derived per-rig action-code bindings."
    artifacts:
      - path: "sidecar/src/sidecar/avatar/extractors/olvt.py"
        issue: "Comment and code ignore emotionMap; only actionMap is read."
      - path: "packages/contracts/py/contracts/avatar_overrides.py"
        issue: "No emotion binding or plugin-default action binding field."
      - path: "packages/contracts/py/contracts/rig_capabilities.py"
        issue: "No plugin-default emotion/action binding field despite ARCH-02 wording."
      - path: "sidecar/schemas/avatar_overrides.schema.json"
        issue: "Schema has variants/events only; no persisted binding surface."
    missing:
      - "Add the required emotionMap-derived binding contract or update ROADMAP/REQUIREMENTS to remove that requirement explicitly."
      - "Persist and validate the binding data if it remains part of IMP-05/IMP-09/ARCH-02."
  - truth: "A working dogfooded _avatar_overrides.yaml exists from the mandatory native-dialog review flow"
    status: partial
    reason: "Automated endpoint and renderer tests pass, but the manual native-dialog dogfood flow was not executed and avatars/teto/_avatar_overrides.yaml is absent."
    artifacts:
      - path: "avatars/teto/_avatar_overrides.yaml"
        issue: "Missing; avatars/teto still contains avatar.yaml and teto_overrides.yaml only."
      - path: ".planning/phases/08-avatar-import-catalogs/08-03-SUMMARY.md"
        issue: "Documents native-dialog dogfood as not run."
    missing:
      - "Run Electron Settings -> Edit avatar catalogs -> choose Live2D/重音テト/ -> rename/delete rows -> Save."
      - "Confirm _avatar_overrides.yaml is written and validates with Phase 7's expected parser contract."
---

# Phase 8: Avatar Import + Catalogs Verification Report

**Phase Goal:** A user can import a new avatar via Electron file dialog, review/edit extracted variant and event names in a dedicated React route, save a validated `_avatar_overrides.yaml`, support OLVT `model_dict.json`, block placeholder commits, and define `RigCapabilities` + `AvatarOverrides` contracts for downstream Phase 6/7/9 consumers.
**Verified:** 2026-05-08T09:06:16Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | VTS/Cubism import detection and extractor path exists and is wired through sidecar HTTP + Electron IPC + renderer route | ✓ VERIFIED | `detect_type()`, VTS/Cubism extractors, `/admin/avatar/import`, `avatar:pickFolder`, `avatar:requestImportPlan`, and `AvatarImport` route are present and wired. Spot checks passed: renderer AvatarImport tests `9 passed`; sidecar import/writer/reimport tests `11 passed`. |
| 2 | Cubism placeholder names block Save until renamed | ✓ VERIFIED | `usePlaceholderGate.ts` uses `/^exp_?\d+$/i`; `AvatarImport.tsx` disables Save when placeholders or variant validation errors exist; Vitest covers disabled/enabled rename path. |
| 3 | OLVT drop-in satisfies roadmap requirement: emotionMap becomes default-plugin action binding and actionMap becomes variant catalog | ✗ FAILED | `olvt.py` explicitly says `emotionMap is intentionally ignored`; only `actionMap` is read. No binding field exists in `AvatarOverrides`, `RigCapabilities`, or schema. |
| 4 | Review screen can be reopened from Settings and commits validated YAML | ✓ VERIFIED (automated), needs manual dogfood | Settings calls `setView('avatar-import')`; commit posts to `/admin/avatar/import/commit`; writer validates before `.tmp`, fsyncs, and uses `os.replace`. Manual native-dialog flow still not run. |
| 5 | VTS introspection smoke script validates pyvts against actual Teto rig | ? HUMAN NEEDED | Script exists and summaries report friendly connection-refused behavior when VTS is not running. Actual VTS+Teto introspection cannot be verified non-interactively. |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/contracts/py/contracts/avatar_overrides.py` | AvatarOverrides with variants/events/voice/source_rig_path and carry-over fields | ⚠️ PARTIAL | Core fields exist; required emotion/plugin-default binding surface from IMP-05/IMP-09 is absent. |
| `packages/contracts/py/contracts/rig_capabilities.py` | RigCapabilities contract for Phase 6/9 | ⚠️ PARTIAL | Param IDs, ranges, expressions, hotkeys, cdi3 names, sign inversions exist; ARCH-02 binding field is absent. |
| `sidecar/src/sidecar/avatar/extractors/*.py` | VTS, Cubism named, Cubism bare, OLVT extractors | ⚠️ PARTIAL | VTS/Cubism/actionMap paths exist; OLVT emotionMap path missing by design. |
| `sidecar/src/sidecar/admin/avatar.py` | Import/current/commit endpoints | ✓ VERIFIED | Routes exist; import does not write; commit builds `AvatarOverrides`, strips wire-only fields, validates and writes. |
| `apps/electron-main/src/ipc.ts` + preload | Native folder dialog and sidecar POST bridge | ✓ VERIFIED | `showOpenDialog({ properties: ['openDirectory'] })`, request plan, commit overrides, restart sidecar. |
| `apps/renderer/src/screens/AvatarImport/*` | Dedicated React review route | ✓ VERIFIED | Single route component, VariantTable, EventTable, placeholder gate, Settings/AppShell wiring exist. |
| `avatars/teto/_avatar_overrides.yaml` | Dogfooded working YAML artifact | ✗ MISSING | `Test-Path avatars/teto/_avatar_overrides.yaml` returned `False`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `AvatarImport.tsx` | Electron preload API | `window.api.pickAvatarFolder`, `requestImportPlan`, `commitAvatarOverrides` | ✓ WIRED | Calls are present and covered by renderer tests. |
| `ipc.ts` | Sidecar import endpoints | `fetch(getSidecarHttpUrl()/admin/avatar/...)` | ✓ WIRED | Request plan and commit handlers POST to sidecar. |
| `admin/avatar.py` | Extractors and writer | type detector dispatch + atomic writer | ✓ WIRED | `_EXTRACTORS` dispatches supported types; commit calls writer. |
| `ws/server.py` | AvatarOverrides + RigCapabilities | boot load/build path | ✓ WIRED | `load_avatar_overrides`, `build_rig_capabilities`, `[BOOT] RigCapabilities loaded`, `overrides.voice` present. |
| `olvt.py` | default-plugin emotion bindings | `emotionMap` ingestion | ✗ NOT WIRED | No read path or contract field. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `AvatarImport.tsx` | `plan`, `variants`, `events` | `window.api.requestImportPlan(folder)` | Yes, via IPC -> sidecar `/admin/avatar/import` | ✓ FLOWING |
| `VariantTable.tsx` | `variants` | Parent state from import plan, edited locally | Yes | ✓ FLOWING |
| `admin/avatar.py` | `variants`, `events` | type detector + extractor dispatch | Yes for VTS/Cubism/actionMap | ⚠️ PARTIAL |
| `olvt.py` | `variants` | `model_dict.json.actionMap` | Yes for variants; no emotionMap bindings | ⚠️ PARTIAL |
| `ws/server.py` | `capabilities` | `load_avatar_overrides()` + `build_rig_capabilities()` | Yes if `_avatar_overrides.yaml` or legacy fallback exists | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Renderer AvatarImport route behavior | `npm --workspace apps/renderer run test -- --run AvatarImport` | 1 file, 9 tests passed | ✓ PASS |
| Sidecar import/writer/reimport behavior | `cd sidecar; uv run pytest tests/avatar/test_import_detect.py tests/avatar/test_overrides_writer.py tests/avatar/test_reimport.py -q --tb=short` | 11 passed | ✓ PASS |
| Sidecar app import after boot rewire | `cd sidecar; uv run python -c "from sidecar.ws.server import app; ..."` | `OK` | ✓ PASS |
| Current regression gate from orchestrator | sidecar full tests, renderer tests/typecheck, Electron main typecheck, contracts check | 194 passed/2 skipped; renderer 28 passed; typechecks/contracts passed | ✓ PASS (reported) |
| Dogfood output artifact | `Test-Path avatars/teto/_avatar_overrides.yaml` | `False` | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| IMP-01 | 08-02 | Electron file dialog + sidecar type detection | ✓ SATISFIED | IPC dialog and `detect_type()` exist; tests pass. |
| IMP-02 | 08-01 | VTS `.vtube.json` ToggleExpression extractor | ✓ SATISFIED | `extract_vts()` filters `Action == "ToggleExpression"` and normalizes names. |
| IMP-03 | 08-01/08-03 | Cubism named expressions become placeholders and must be relabeled | ✓ SATISFIED | Cubism extractor sets placeholder flags; UI save gate blocks `exp_?\d+`. |
| IMP-04 | 08-01 | Cubism-bare has no variants; events from `.motion3.json` | ✓ SATISFIED | `extract_cubism_bare()` returns `[]` variants and non-Idle events. |
| IMP-05 | 08-01 | OLVT emotionMap binding + actionMap variants | ✗ BLOCKED | `actionMap` is implemented; `emotionMap` is intentionally ignored and not modeled. |
| IMP-06 | 08-01 | Event catalog from motion groups/files | ✓ SATISFIED | Cubism bare event extractor and motion metadata reader exist. |
| IMP-07 | 08-03 | Dedicated review route; Save disabled while placeholders remain | ✓ SATISFIED | AppShell/Settings/AvatarImport route, placeholder gate, VariantTable/EventTable, tests. |
| IMP-08 | 08-02/08-03 | Re-open from Settings; commit writes validated `_avatar_overrides.yaml` | ⚠️ PARTIAL | Code and tests satisfy endpoint/UI path; native-dialog dogfood write not run and repo artifact absent. |
| IMP-09 | 08-01/08-02 | Rename to AvatarOverrides; `_avatar_overrides.yaml` carries edits + bindings | ⚠️ PARTIAL | Rename and carry-over fields exist; plugin-default emotion bindings absent. |
| IMP-10 | 08-01 | VTS API introspection smoke against actual Teto rig | ? HUMAN NEEDED | Script exists; actual VTS+Teto run not performed in this verification. |
| ARCH-02 | 08-01 | RigCapabilities contract | ⚠️ PARTIAL | Core fields exist and boot builder is wired; required binding field from REQUIREMENTS.md absent. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/avatar/capabilities.py` | 8 | `TODO(Phase 6)` shim | ℹ️ Info | Intentional transition shim; not a Phase 8 blocker. |
| `apps/renderer/src/screens/AvatarImport/AvatarImport.tsx` | 63 | `console.log(C.SUCCESS_TOAST)` | ℹ️ Info | Summary documents toast UX deferred; no goal blocker. |
| `sidecar/src/sidecar/avatar/extractors/olvt.py` | 4 | `emotionMap is intentionally ignored` | 🛑 Blocker | Contradicts ROADMAP success criterion and IMP-05 requirement. |

### Human Verification Required

### 1. Native Dialog Dogfood

**Test:** Run Electron, go to Settings -> Edit avatar catalogs, choose `Live2D/重音テト/`, rename placeholders/delete rows, click Save.
**Expected:** Review screen saves successfully, redirects to chat, and writes a valid `_avatar_overrides.yaml`.
**Why human:** Native Electron dialog and real local folder selection cannot be exercised by the non-interactive verifier.

### 2. VTS Introspection Smoke

**Test:** Start VTube Studio with Teto loaded, then run `cd sidecar && uv run python scripts/vts_introspect_smoke.py`.
**Expected:** Exit code 0 and PASS message confirming pyvts/VTS response shape.
**Why human:** Requires a running VTube Studio instance with the actual Teto rig loaded.

### 3. Re-import Visual Badges

**Test:** With an existing `_avatar_overrides.yaml`, reopen AvatarImport and verify NEW/edited badges on real changed rows.
**Expected:** New hotkeys show NEW; renamed existing hotkeys show edited.
**Why human:** Automated tests cover derivation, but visual placement/readability needs manual review.

### Gaps Summary

Phase 8 is substantially implemented and wired, and the automated regression gates are green. The phase is not fully goal-achieved because the implementation does not satisfy the ROADMAP/REQUIREMENTS contract for OLVT `emotionMap` -> default-plugin action bindings, and the manual dogfood exit gate that would prove the real native-dialog import/write path has not been run. The repo also lacks the expected dogfooded `avatars/teto/_avatar_overrides.yaml` output artifact.

---

_Verified: 2026-05-08T09:06:16Z_
_Verifier: Claude (gsd-verifier)_
