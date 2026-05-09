---
phase: 9
slug: slider-hud-per-param-lock
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
last_updated: 2026-05-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by gsd-planner during plan-phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Sidecar Framework** | pytest 8.x + pytest-asyncio (existing in `sidecar/pyproject.toml`) |
| **Renderer Framework** | vitest 4.1.5 + @testing-library/react 16.3.2 + jsdom 29.1.1 (existing in `apps/renderer/package.json`) |
| **Contracts/Codegen Framework** | pytest in `packages/contracts/tests/` + npm script `check:contracts` |
| **Sidecar quick run** | `cd sidecar && uv run pytest tests/compositor tests/ws tests/admin -x` |
| **Renderer quick run** | `cd apps/renderer && npx vitest run tests/HUD.test.tsx tests/HudParamRow.test.tsx tests/Settings.test.tsx` |
| **Codegen drift gate** | `npm run check:contracts` (root) |
| **Sidecar full suite** | `cd sidecar && uv run pytest -x` |
| **Renderer full suite** | `cd apps/renderer && npx vitest run` |
| **Estimated runtime (sidecar quick)** | ~30s |
| **Estimated runtime (renderer quick)** | ~15s |
| **Estimated runtime (codegen drift)** | ~10s |
| **Estimated runtime (combined per-wave merge)** | ~120s |

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command (sub-30s in nominal cases).
- **After every plan wave:** Run all tests created in completed plans of that wave + codegen drift gate.
- **Before `/gsd:verify-work`:** Run the sidecar full suite, renderer full suite, and `npm run check:contracts`. Then perform Plan 09-02 Task 5 live UAT.
- **Max feedback latency per task:** 60s.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement(s) | Test Type | Automated Command |
|---------|------|------|---------------|-----------|-------------------|
| 09-01 T1 | 09-01 | 1 | Codegen drift / contract surface | Unit + drift gate | `cd packages/contracts && uv run pytest tests/test_codegen.py -k hud_message -x && cd ../.. && npm run check:contracts` |
| 09-01 T2 | 09-01 | 1 | HUD-06 (resolver-mapped exclusion) | Unit | `cd sidecar && uv run pytest tests/compositor/test_lock_filter.py -x` |
| 09-01 T3 | 09-01 | 1 | HUD-02 (15Hz decimation), HUD-05 (locks LAST in merge) | Unit | `cd sidecar && uv run pytest tests/compositor/test_hud_tap.py tests/compositor/test_compositor.py -x` |
| 09-01 T4 | 09-01 | 1 | HUD-08 (`GET /admin/rig-capabilities`) | Integration (FastAPI TestClient) | `cd sidecar && uv run pytest tests/admin/test_rig_capabilities_endpoint.py -x` |
| 09-01 T5 | 09-01 | 1 | HUD-01 (`/hud/ws` lifecycle), HUD-04 (set-lock round-trip), HUD-07 (session-only) | Integration (FastAPI TestClient) | `cd sidecar && uv run pytest tests/ws -x` |
| 09-02 T1 | 09-02 | 2 | Electron multi-window + IPC | Type-check | `cd apps/electron-main && npx tsc --noEmit` |
| 09-02 T2 | 09-02 | 2 | UI scaffolding (copy/icons/CSS/route) | Type-check + grep | `cd apps/renderer && npx tsc --noEmit` |
| 09-02 T3 | 09-02 | 2 | HUD-03 (param row list bounded by ranges), HUD-04 (drag → lock → confirm), HUD-06 (mouth excluded), HUD-07 (no persistence — code-level grep) | Unit (vitest + jsdom) | `cd apps/renderer && npx vitest run tests/HUD.test.tsx tests/HudParamRow.test.tsx` |
| 09-02 T4 | 09-02 | 2 | Settings entry point (D-A2) | Unit (vitest + jsdom) | `cd apps/renderer && npx vitest run tests/Settings.test.tsx` |
| 09-02 T5 | 09-02 | 2 | End-to-end visual UAT — drag slider holds; toast on re-import; ARCH-06 invariant | Manual (15-step script) | `npm run dev` then human walks UAT |

**Cross-task gates:**
- `grep -rn "import pyvts" sidecar/src/ \| wc -l` MUST return `1` after Plan 09-01 lands (ARCH-06 single writer rule preserved — HUD does NOT introduce a second VTS client).
- `grep "setAlwaysOnTop" apps/electron-main/src/hud-window.ts` MUST return zero matches (D-A3).
- `grep -E "store.set.*hud\|electron-store" apps/electron-main/src/hud-window.ts` MUST return zero matches (D-A4 + HUD-07 no persistence).
- `npm run check:contracts` MUST exit 0 after Task 09-01 T1 (codegen drift gate).

---

## Wave 0 Requirements

Test infrastructure is already in place. No Wave 0 setup required:

- ✅ pytest + pytest-asyncio in `sidecar/pyproject.toml`
- ✅ FastAPI TestClient is part of FastAPI 0.136.1 (already pinned)
- ✅ vitest 4.1.5 + @testing-library/react 16.3.2 + jsdom 29.1.1 in `apps/renderer/package.json`
- ✅ `apps/renderer/vite.config.*` is configured for vitest (existing tests in `apps/renderer/tests/` work)
- ✅ Codegen pipeline (`scripts/codegen.py` + `npm run codegen:contracts` + `npm run check:contracts`) operational since Phase 5
- ✅ `packages/contracts/tests/test_codegen.py` exists with the assertion pattern to mirror

NEW directories created during the plans (not Wave 0 — created inline by their respective tasks):
- `sidecar/tests/ws/` (with `__init__.py`) — created by Plan 09-01 Task 5
- `sidecar/tests/admin/` (with `__init__.py`) — created by Plan 09-01 Task 4
- `apps/renderer/src/screens/HUD/` — created by Plan 09-02 Task 3

---

## Manual-Only Verifications

Anchored in Plan 09-02 Task 5 (`checkpoint:human-verify`). The UAT script has 15 steps; the SHIPPING-CRITICAL subset that MUST PASS:

1. ✅ Settings shows the `Open HUD` button (D-A2)
2. ✅ Click → new BrowserWindow opens at OS-default placement, ~420×640, NOT always-on-top (D-A1, D-A3, D-A4)
3. ✅ HUD route mounts WITHOUT AppShell chrome (no TopBar/BottomRail/LogsDrawer)
4. ✅ Param row list populated from `RigCapabilities`; NO `MouthOpen` or `ParamMouthOpenY` row anywhere (HUD-06)
5. ✅ Slider drag → optimistic lock visual flips immediately; sidecar confirms within ~67ms (HUD-04)
6. ✅ Releasing the mouse does NOT release the lock (D-D2)
7. ✅ Clicking lock toggle on a LOCKED row releases it; UNLOCKED row toggle click is a no-op (D-D2)
8. ✅ HUD-WS disconnect → `.banner.warn` appears; reconnect → banner clears
9. ✅ Quit cleanly — no scary errors on app quit (Pitfall 6 mitigation)

The SHIPPING-OPTIONAL subset (PARTIAL is acceptable; defer to Phase 10 if blockers):
- Step 10: Lock holds against `{variant}` / `<event>` writes (requires VTS + configured LLM)
- Step 12: Avatar re-import toast (requires familiarity with avatar import flow; can be re-verified in Phase 10 §14 ceremony)

---

## Success Criteria Coverage

| ROADMAP §Phase 9 SC | Verification Path |
|---------------------|-------------------|
| SC-1: HUD opens from Settings; separate BrowserWindow; populates row list from RigCapabilities minus SYSTEM_PRIMITIVE_OVERRIDES | UAT steps 1-7 + HUD.test.tsx (`mounts loading state then renders rig-derived rows`) |
| SC-2: Slider drag → optimistic lock → sidecar single-source-of-truth → 60Hz re-injection wins | UAT steps 8-10 + test_hud_lock_roundtrip.py + test_compositor.py (`test_lock_overrides_plugin_set_param`) |
| SC-3: Lock persists until explicit unlock; releasing slider does NOT release | UAT step 9 + HudParamRow.test.tsx (`clicking lock toggle on UNLOCKED row does NOT fire onSetLock`) |
| SC-4: App restart clears lock state; avatar re-import clears + toast | UAT steps 12, 15 + test_hud_session_only.py + HUD.test.tsx (`fires Avatar-changed toast when locked_ids drops to empty`) |
| SC-5: MouthOpen NEVER appears in HUD list — automated test | test_lock_filter.py (`test_mouth_excluded_in_both_namespaces`) + test_rig_capabilities_endpoint.py (`test_get_returns_payload_with_excluded_ids`) + HUD.test.tsx (`NEVER renders MouthOpen or ParamMouthOpenY rows`) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are checkpoint-typed (Task 09-02 T5 is human-verify)
- [x] Sampling continuity: every task in 09-01 has automated verify; 09-02 T1-T4 have automated verify; T5 is the manual-UAT terminator
- [x] No 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no Wave 0 needed — infra already present)
- [x] No watch-mode flags (all commands are one-shot, finite)
- [x] Feedback latency < 60s per task; < 120s per wave
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
