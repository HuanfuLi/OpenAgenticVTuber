---
phase: 8
slug: avatar-import-catalogs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `08-RESEARCH.md` §"Validation Architecture" (lines 1602-1655).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (already used in milestone-1 — confirmed via `sidecar/tests/`) + vitest (renderer, already used) |
| **Config file** | `pyproject.toml` (`[tool.pytest.ini_options]`) + `apps/renderer/vitest.config.ts` |
| **Quick run command** | `uv run pytest sidecar/tests/avatar/ -x --no-header` |
| **Full suite command** | `uv run pytest sidecar/tests/ && cd apps/renderer && npm test` |
| **Estimated runtime** | ~25 seconds (sidecar avatar suite alone <5s; full sidecar ~12s; renderer ~8s) |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest sidecar/tests/avatar/ -x --no-header`
- **After every plan wave:** Run `uv run pytest sidecar/tests/`
- **Before `/gsd:verify-work`:** Full suite must be green; `vts_introspect_smoke.py` is manual-only (requires VTS running) and may PASS-WITH-NOTE
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req ID | Plan | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------|------|----------|-----------|-------------------|-------------|--------|
| IMP-01 | 08-02 | 1 | Type detector returns correct enum for each of the 5 shapes (VTS, Cubism w-exp, Cubism bare, OLVT, unsupported/Cubism 5.3) | unit | `pytest sidecar/tests/avatar/test_import_detect.py -x` | ❌ W0 | ⬜ pending |
| IMP-02 | 08-01 | 1 | VTS extractor on Teto produces 14 LLM-emittable variants + 1 filtered RemoveAllExpressions meta | unit | `pytest sidecar/tests/avatar/test_extract_vts.py::test_teto -x` | ❌ W0 | ⬜ pending |
| IMP-02 | 08-01 | 1 | Naming-normalization regex matches all 15 CONTEXT examples (verified per RESEARCH §A) | unit | `pytest sidecar/tests/avatar/test_normalize.py -x` | ❌ W0 | ⬜ pending |
| IMP-03 | 08-01 | 1 | Cubism-named extractor on mao_pro produces 8 `exp_NN`-flagged placeholder variants | unit | `pytest sidecar/tests/avatar/test_extract_cubism_named.py::test_mao_pro -x` | ❌ W0 | ⬜ pending |
| IMP-04 | 08-01 | 1 | Cubism-bare extractor on shizuku produces 0 variants + N events (Idle motions filtered) | unit | `pytest sidecar/tests/avatar/test_extract_cubism_bare.py::test_shizuku -x` | ❌ W0 | ⬜ pending |
| IMP-05 | 08-01 | 1 | OLVT extractor reads local `model_dict.json`, produces 6 mao_pro variants from `actionMap`, ignores `emotionMap` (D-A2-3) | unit | `pytest sidecar/tests/avatar/test_extract_olvt.py::test_mao_pro -x` | ❌ W0 | ⬜ pending |
| IMP-06 | 08-01 | 1 | `motion3.json.Meta.Duration` extracted correctly (Teto IDLE = 2.833s, Loop=true) | unit | `pytest sidecar/tests/avatar/test_motion3_meta.py -x` | ❌ W0 | ⬜ pending |
| IMP-07 | 08-01 | 1 | Placeholder detection regex `^exp_?\d+$` (case-insensitive) catches `exp_01` but not `sv-microphone` or `hold-mic` | unit | `pytest sidecar/tests/avatar/test_normalize.py::test_placeholder -x` | ❌ W0 | ⬜ pending |
| IMP-07 | 08-03 | 3 | Review screen disables Save when ANY placeholder code present; Save enables when all renamed | integration (renderer) | `cd apps/renderer && npm test -- --run AvatarImport` | ❌ W0 | ⬜ pending |
| IMP-08 | 08-02 | 2 | Atomic write writes via `.tmp` → `fsync` → `os.replace()`; pre-validates jsonschema; failure leaves no `.tmp` artifact | unit | `pytest sidecar/tests/avatar/test_overrides_writer.py -x` | ❌ W0 | ⬜ pending |
| IMP-08 | 08-02 | 2 | Re-import preserves user `notes`, `body_sway_strategy`, `proxy_body_param`, `exp3_body_pose`, `discovered_hotkeys` (per RESEARCH §Pitfall 6) | unit | `pytest sidecar/tests/avatar/test_reimport.py -x` | ❌ W0 | ⬜ pending |
| IMP-09 | 08-01 | 1 | `TetoOverrides` → `AvatarOverrides` rename; `AvatarOverrides` Pydantic round-trips existing `teto_overrides.yaml` content | unit (regression) | `pytest sidecar/tests/avatar/test_overrides_loader.py -x` | ❌ W0 | ⬜ pending |
| IMP-10 | 08-01 | 1 | `vts_introspect_smoke.py` asserts pyvts 0.3.3 produces expected fields (`getModelInfo`/`requestHotKeyList`/`requestTrackingParameterList`) against running VTS w/ Teto loaded | manual-only (requires VTS running) | `uv run python sidecar/scripts/vts_introspect_smoke.py` | ❌ W0 | ⬜ pending |
| ARCH-02 | 08-01 | 1 | `RigCapabilities` Pydantic builds correctly from Teto's source rig files (writable_param_ids from cdi3, expressions from .vtube.json hotkeys, hotkeys with HotkeyID UUIDs, cdi3_display_names dict, sign_inversions from AvatarOverrides) | unit | `pytest sidecar/tests/avatar/test_rig_capabilities.py::test_build_from_teto -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files below MUST be created in Wave 0 of plan 08-01 (test stubs land before extractor logic):

- [ ] `sidecar/tests/avatar/__init__.py` — package marker
- [ ] `sidecar/tests/avatar/conftest.py` — shared fixtures: `teto_dir`, `mao_pro_dir`, `shizuku_dir` pointing to `Live2D/重音テト/`, `Live2D/mao_pro/runtime/`, `Live2D/shizuku/runtime/`; `olvt_model_dict_path` pointing to `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json`
- [ ] `sidecar/tests/avatar/test_import_detect.py` — covers IMP-01 with all 5 shapes
- [ ] `sidecar/tests/avatar/test_normalize.py` — covers IMP-02 naming-normalization (15 Teto names from RESEARCH §A) + IMP-07 placeholder regex
- [ ] `sidecar/tests/avatar/test_extract_vts.py` — covers IMP-02 (against Teto rig)
- [ ] `sidecar/tests/avatar/test_extract_cubism_named.py` — covers IMP-03 (against mao_pro rig)
- [ ] `sidecar/tests/avatar/test_extract_cubism_bare.py` — covers IMP-04 (against shizuku rig)
- [ ] `sidecar/tests/avatar/test_extract_olvt.py` — covers IMP-05 (against local OLVT `model_dict.json`)
- [ ] `sidecar/tests/avatar/test_motion3_meta.py` — covers IMP-06 (against Teto IDLE.motion3.json)
- [ ] `sidecar/tests/avatar/test_overrides_writer.py` — covers IMP-08 atomic-write + jsonschema validation
- [ ] `sidecar/tests/avatar/test_reimport.py` — covers re-import diff/preservation logic (RESEARCH §Pitfall 6)
- [ ] `sidecar/tests/avatar/test_overrides_loader.py` — regression test for IMP-09 rename
- [ ] `sidecar/tests/avatar/test_rig_capabilities.py` — covers ARCH-02 RigCapabilities builder
- [ ] `apps/renderer/src/screens/AvatarImport/__tests__/AvatarImport.test.tsx` — covers IMP-07 placeholder gate UX (single-page scrollable per CONTEXT D-A3-1; per-row 4-control set per D-A3-3)
- [ ] `jsonschema 4.26.0` added to `sidecar/pyproject.toml` dependencies (per RESEARCH §Standard Stack)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pyvts 0.3.3 introspection smoke-test against actual Teto rig | IMP-10 | Requires VTube Studio running with Teto loaded + API auth granted; cannot be automated in CI without VTS instance | 1. Start VTube Studio with Teto rig loaded; 2. Grant API auth; 3. Run `uv run python sidecar/scripts/vts_introspect_smoke.py`; 4. Confirm script exits 0 with all 5 shape assertions logged ✓; 5. If fail, capture pyvts version + VTS version in `08-PROVENANCE.md` |
| Dogfooded Teto import flow end-to-end (Phase 8 exit gate per CONTEXT D-A4-1) | IMP-01..09 (E2E) | Requires Electron app running with sidecar; user-driven file dialog + review screen interaction | 1. `npm run dev` boots stack; 2. Settings → "Import avatar"; 3. Select `Live2D/重音テト/` folder; 4. Walk review screen, edit 14 variant codes to semantic names (or accept auto-derived), delete `Remove Water Mark` row, ensure events table is empty; 5. Click Save; 6. Confirm `avatars/teto/_avatar_overrides.yaml` written; 7. In same PR, delete `avatars/teto/avatar.yaml` + `teto_overrides.yaml`; 8. Restart sidecar, confirm boot succeeds reading new file (per RESEARCH §Pitfall 7 sequencing) |
| Cubism 5.3 reject-with-helpful-error end-to-end | IMP-01 | No Cubism 5.3 rig exists in repo; behavior is rejection-side (preventive) | 1. Construct synthetic moc3 file with first 8 bytes `MOC3\x06\x00\x00\x00` (header version=6); 2. Place alongside fake `model3.json` in temp dir; 3. Try import; 4. Confirm Electron shows friendly error "This avatar uses Cubism 5.3, which is not yet supported by VTube Studio. Please use a Cubism 4.x or 5.0–5.2 rig"; 5. Confirm no `_avatar_overrides.yaml` is written |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner produces task IDs in plan files and gsd-plan-checker confirms each row above maps to a real task)

**Approval:** pending
