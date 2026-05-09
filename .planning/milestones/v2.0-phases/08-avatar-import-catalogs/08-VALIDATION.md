---
phase: 8
slug: avatar-import-catalogs
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
last_audited: 2026-05-09T05:42:30-04:00
---

# Phase 8 - Validation Strategy

Retroactive Nyquist validation for completed Phase 8. This replaces the original draft/pending validation scaffold with the tests and evidence that actually shipped through 08-01..08-05 and 08-VERIFICATION.md.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Sidecar framework | pytest via `uv` in `sidecar/pyproject.toml` |
| Renderer framework | Vitest via `apps/renderer/package.json` |
| Contract/codegen framework | pytest in `packages/contracts/tests/` plus root `npm run check:contracts` |
| Sidecar validation command | `cd sidecar && uv run pytest tests/avatar tests/vts/test_vts_introspect_smoke.py -q --tb=short` |
| Renderer validation command | `npm --workspace apps/renderer run test -- --run AvatarImport` |
| Contract validation command | `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q` |
| Drift gate | `npm run check:contracts` |
| Latest audit result | sidecar 67 passed; renderer 11 passed; contracts 10 passed; contract drift gate passed |

## Sampling Rate

- After avatar extractor/admin changes: run the sidecar validation command or the narrower touched test file.
- After renderer review-screen changes: run the renderer validation command.
- After contract/schema changes: run the contract validation command plus `npm run check:contracts`.
- Before phase verification: run all four commands above and confirm manual UAT files are current.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement(s) | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------|-----------|-------------------|-------------|--------|
| 08-01 T1 | 08-01 | 1 | IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-09, IMP-10, ARCH-02 | Wave 0 scaffolds, contracts, schema, normalize/loader tests | `cd sidecar && uv run pytest tests/avatar/ -x --no-header` | yes | covered |
| 08-01 T2 | 08-01 | 1 | IMP-02, IMP-06, IMP-09 | normalize, motion metadata, overrides loader | `cd sidecar && uv run pytest tests/avatar/test_normalize.py tests/avatar/test_motion3_meta.py tests/avatar/test_overrides_loader.py -x --no-header` | yes | covered |
| 08-01 T3 | 08-01 | 1 | IMP-02, IMP-03, IMP-04, IMP-05 | VTS/Cubism/OLVT extractors | `cd sidecar && uv run pytest tests/avatar/test_extract_vts.py tests/avatar/test_extract_cubism_named.py tests/avatar/test_extract_cubism_bare.py tests/avatar/test_extract_olvt.py -x --no-header` | yes | covered |
| 08-01 T4 | 08-01 | 1 | ARCH-02 | RigCapabilities builder | `cd sidecar && uv run pytest tests/avatar/test_rig_capabilities.py -x --no-header` | yes | covered |
| 08-01 T5 | 08-01 | 1 | IMP-10 | VTS smoke script unavailable/auth shape | `cd sidecar && uv run python scripts/vts_introspect_smoke.py` plus `tests/vts/test_vts_introspect_smoke.py` in 08-05 | yes | covered + manual UAT |
| 08-02 T1 | 08-02 | 2 | IMP-01 | Import type detection | `cd sidecar && uv run pytest tests/avatar/test_import_detect.py -x --no-header` | yes | covered |
| 08-02 T2 | 08-02 | 2 | IMP-08 | Atomic override writer and schema validation | `cd sidecar && uv run pytest tests/avatar/test_overrides_writer.py -x --no-header` | yes | covered |
| 08-02 T3 | 08-02 | 2 | IMP-01, IMP-08 | Admin import/current/commit endpoints | `cd sidecar && uv run pytest tests/avatar/test_admin_avatar.py -x --no-header` | yes | covered |
| 08-02 T4 | 08-02 | 2 | IMP-01, IMP-08, ARCH-02 | Contract mirrors and Electron/renderer type surface | `npm run check:contracts` | yes | covered |
| 08-03 T1 | 08-03 | 3 | IMP-07 | Renderer route shell and AppShell/Settings entry | `npm --workspace apps/renderer run test -- --run AvatarImport` | yes | covered |
| 08-03 T2 | 08-03 | 3 | IMP-07 | Variant/event review tables and placeholder gate | `npm --workspace apps/renderer run test -- --run AvatarImport` | yes | covered |
| 08-03 T3 | 08-03 | 3 | IMP-07, IMP-08 | Save flow, unsupported rig errors, re-import badges | `npm --workspace apps/renderer run test -- --run AvatarImport` | yes | covered |
| 08-04 T1 | 08-04 | 4 | IMP-05, IMP-09, ARCH-02 | DefaultPluginActionBinding contract and owner fields | `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q` | yes | covered |
| 08-04 T2 | 08-04 | 4 | IMP-05, IMP-09, ARCH-02 | Generated TS/JSON schema and runtime schema drift | `npm run check:contracts` | yes | covered |
| 08-05 T1 | 08-05 | 5 | IMP-08, IMP-09 | Runtime avatar destination and re-import preservation | `cd sidecar && uv run pytest tests/avatar/test_admin_avatar.py tests/avatar/test_reimport.py -q --tb=short` | yes | covered |
| 08-05 T2 | 08-05 | 5 | IMP-07, IMP-10 | AvatarImport footer layout and VTS smoke auth handling | `npm --workspace apps/renderer run test -- --run AvatarImport`; `cd sidecar && uv run pytest tests/vts/test_vts_introspect_smoke.py -q --tb=short` | yes | covered |
| 08-05 T3 | 08-05 | 5 | IMP-01..IMP-10, ARCH-02 | Native-dialog dogfood, saved YAML schema validation, VTS smoke evidence | UAT files plus schema validation command from 08-VERIFICATION.md | yes | covered + manual UAT |

## Requirement Coverage Map

| Requirement | Primary Plan(s) | Automated Evidence | Manual Evidence | Status |
|-------------|-----------------|--------------------|-----------------|--------|
| IMP-01 | 08-02, 08-03, 08-05 | `tests/avatar/test_import_detect.py`, `tests/avatar/test_admin_avatar.py`, renderer AvatarImport tests | `08-DOGFOOD-UAT.md` | covered |
| IMP-02 | 08-01 | `tests/avatar/test_extract_vts.py`, `tests/avatar/test_normalize.py` | dogfood selected Teto VTS-shape source | covered |
| IMP-03 | 08-01, 08-03 | `tests/avatar/test_extract_cubism_named.py`, renderer placeholder-gate tests | none required | covered |
| IMP-04 | 08-01 | `tests/avatar/test_extract_cubism_bare.py` | none required | covered |
| IMP-05 | 08-01, 08-04, 08-05 | `tests/avatar/test_extract_olvt.py`, `packages/contracts/tests/test_codegen.py`, `tests/avatar/test_admin_avatar.py` | none required | covered |
| IMP-06 | 08-01 | `tests/avatar/test_motion3_meta.py`, `tests/avatar/test_extract_cubism_bare.py` | none required | covered |
| IMP-07 | 08-03, 08-05 | `apps/renderer/tests/AvatarImport.test.tsx` | `08-DOGFOOD-UAT.md` | covered |
| IMP-08 | 08-02, 08-03, 08-05 | `tests/avatar/test_overrides_writer.py`, `tests/avatar/test_admin_avatar.py`, `tests/avatar/test_reimport.py`, renderer AvatarImport tests | `08-DOGFOOD-UAT.md` | covered |
| IMP-09 | 08-01, 08-04, 08-05 | `tests/avatar/test_overrides_loader.py`, `tests/avatar/test_reimport.py`, `packages/contracts/tests/test_codegen.py` | none required | covered |
| IMP-10 | 08-01, 08-05 | `tests/vts/test_vts_introspect_smoke.py` covers auth rejection/unavailable VTS behavior | `08-VTS-SMOKE-UAT.md` records live PASS | covered |
| ARCH-02 | 08-01, 08-04, 08-05 | `tests/avatar/test_rig_capabilities.py`, `packages/contracts/tests/test_codegen.py`, `npm run check:contracts` | none required | covered |

No missing or partial requirement coverage remains.

## Wave Verification

| Wave | Plans | Command | Latest Evidence |
|------|-------|---------|-----------------|
| 1 | 08-01 | `cd sidecar && uv run pytest tests/avatar/ -x --no-header` | 08-01 summary: 35 passed, 1 xfailed; later full Phase 8 sidecar audit: 67 passed |
| 2 | 08-02 | `cd sidecar && uv run pytest tests/avatar/ -x --no-header`; `npm run check:contracts` | 08-02 summary: 53 tests passed, typechecks passed, contract drift passed |
| 3 | 08-03 | `npm --workspace apps/renderer run test -- --run AvatarImport` | 08-03 summary: 9 tests passed; latest audit: 11 passed |
| 4 | 08-04 | `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q`; `npm run check:contracts` | latest audit: 10 passed and drift gate passed |
| 5 | 08-05 | sidecar avatar/admin/reimport/VTS tests; renderer AvatarImport; schema validation; UAT files | 08-05 summary and latest audit pass |

## Manual-Only Verifications

| Behavior | Requirement | Status | Why Manual | Evidence |
|----------|-------------|--------|------------|----------|
| Native-dialog Teto import flow end-to-end | IMP-01..IMP-09 | passed | Requires Electron dialog and user review/save interaction | `.planning/phases/08-avatar-import-catalogs/08-DOGFOOD-UAT.md`, status pass; runtime artifact `avatars/重音テト/_avatar_overrides.yaml` validated |
| Live VTS introspection smoke against actual Teto rig | IMP-10 | passed | Requires VTube Studio running with Teto loaded and API auth granted | `.planning/phases/08-avatar-import-catalogs/08-VTS-SMOKE-UAT.md`, status pass after token reset/re-approval |

Cubism 5.3 rejection is covered as an import-detection/admin error behavior; no separate live rig is required.

## Validation Audit 2026-05-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 14 stale validation rows refreshed |
| Escalated | 0 |
| Automated requirement rows | 11/11 |
| Manual-only rows | 2 passed |

Commands run during this audit:

| Command | Result |
|---------|--------|
| `cd sidecar && uv run pytest tests/avatar tests/vts/test_vts_introspect_smoke.py -q --tb=short` | 67 passed, 2 FastAPI collection warnings |
| `npm --workspace apps/renderer run test -- --run AvatarImport` | 1 file passed, 11 tests passed |
| `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q` | 10 passed |
| `npm run check:contracts` | passed, no generated contract drift |

## Validation Sign-Off

- [x] All Phase 8 requirements map to automated verification or passed manual UAT.
- [x] Wave 0 test infrastructure exists and is no longer pending.
- [x] Sampling continuity is preserved across all five Phase 8 plans.
- [x] No watch-mode test command is used.
- [x] Manual-only VTS and native-dialog checks have PASS evidence.
- [x] `nyquist_compliant: true` and `wave_0_complete: true` are set in frontmatter.

**Approval:** validated
