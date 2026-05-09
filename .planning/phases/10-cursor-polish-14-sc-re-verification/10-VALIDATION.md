---
phase: 10
slug: cursor-polish-14-sc-re-verification
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
last_updated: 2026-05-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by gsd-planner.

---

## Test Infrastructure

- **pytest** (existing, Phase 1) — used by all 10-01 tasks (cursor regression test, window_detect helper test, full sidecar suite)
- **plumbing_harness.py** (existing, Phase 6 06-02) — used by 10-02 Task 2 for SC #1 + SC #3 baseline replay
- **markdown deliverable** (skeleton-verification.md) — produced by 10-02 Tasks 1 + 3; verified via grep / Select-String section-header counts and ___PENDING___ marker absence
- **Operator visual review** (10-02 Task 3 only) — checkpoint:human-verify ceremony for SC #2 / SC #4 / SC #5

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command (typically pytest on focused test files; <10s on warm cache).
- **After Wave 1 (Plan 10-01):** Full sidecar suite + `tests/test_arch06_single_writer.py` + `grep "import pyvts" sidecar/src/` literal grep gate.
- **After Wave 2 (Plan 10-02):** Harness replay both modes + skeleton-verification.md section-presence check + `___PENDING___` marker count = 0.
- **Before `/gsd:verify-work`:** Full sidecar suite green + harness replay produces PASS JSON for both modes + ARCH-06 single-writer test green + skeleton-verification.md committed with all six SC verdicts filled.
- **Max feedback latency:** 90 seconds (warm cache; first-run pytest cold-start may take ~30s for the full suite).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists? |
|---------|------|------|-------------|-----------|-------------------|--------------|
| 10-01 T1 | 10-01 | 1 | VFY-01, VFY-02 | unit (Wave 0 — RED test scaffold + helper + helper test) | `cd sidecar && uv run pytest tests/vts/test_window_detect.py -x -q` | ✅ test_window_detect.py exists; CREATE test_cursor_driver_namespace.py + extend window_detect.py + extend test_window_detect.py |
| 10-01 T2 | 10-01 | 1 | VFY-01, VFY-02 | unit (GREEN — cursor namespace fix + gate drop + synthetic fallback + flipped test assertions) | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py -x -q` | ✅ All target files exist or were created in T1 |
| 10-01 T3 | 10-01 | 1 | VFY-01, VFY-02, ARCH-06 (carry-through) | integration / full-suite gate | `cd sidecar && uv run pytest -q` | ✅ Existing 80+ tests + new tests pass |
| 10-01 T3 (gate B) | 10-01 | 1 | ARCH-06 (carry-through) | grep gate | `grep -rn "^import pyvts\|^from pyvts" sidecar/src/ \| wc -l` (expected: 1) | ✅ Plan 10-01 must not introduce new pyvts importers |
| 10-02 T1 | 10-02 | 2 | VFY-03, VFY-04 | artifact existence + structure | `powershell -Command "(Select-String -Path '.planning/skeleton-verification.md' -Pattern '^## ').Count"` (expected: 4) | ❌ Phase 10 deliverable — CREATE |
| 10-02 T2 | 10-02 | 2 | VFY-05 | harness replay | `cd sidecar && uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync-phase10-replay.json && uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle-phase10-replay.json` | ✅ Harness exists; ❌ replay JSON outputs CREATED by this task |
| 10-02 T2 (gate B) | 10-02 | 2 | Pitfall 5 (M1 baseline immutability) | git-diff gate | `git diff --exit-code .planning/baselines/v2.0/lipsync.json .planning/baselines/v2.0/idle.json` (expected: exit 0) | ✅ Pre-existing baseline files |
| 10-02 T3 | 10-02 | 2 | VFY-03 (operator), VFY-04 | manual-only (checkpoint:human-verify) | Operator runs ceremony per skeleton-verification.md scripts; final automated check: `grep -c "___PENDING___" .planning/skeleton-verification.md` (expected: 0) | ❌ Operator ceremony — Task 3 fills verdicts |

---

## Wave 0 Requirements

Wave 0 is folded into Plan 10-01 Task 1 (no separate setup wave needed):

- [x] `sidecar/tests/compositor/test_cursor_driver_namespace.py` — CREATE in 10-01 T1 (RED state at end of T1; turns GREEN in T2)
- [x] `sidecar/src/sidecar/vts/window_detect.py` — EXTEND in 10-01 T1 (add `get_primary_monitor_rect()`)
- [x] `sidecar/tests/vts/test_window_detect.py` — EXTEND in 10-01 T1 (add 4 tests for the helper)
- [x] No framework install needed (pytest, uv, plumbing_harness.py all pre-existing)

Pre-existing infrastructure that Phase 10 reuses:
- pytest + uv (Phase 1)
- plumbing_harness.py + baselines (Phase 6 06-02)
- compositor/param_id_resolver.py + VTS_TRACKING_INPUT_PARAM_IDS (Phase 4 / Phase 6)
- ws/server.py CursorDriver wiring (Phase 4)
- vts/window_detect.py (Phase 4)
- test_arch06_single_writer.py (Phase 6 06-07)

---

## Manual-Only Verifications

Three SCs require operator visual judgment per Phase 6 discuss-phase decision (operator-judged, no JSON baseline). All three are bundled into the single `checkpoint:human-verify` task `10-02 T3`:

1. **SC #2 — `[smirk]` smooth blend.** Operator pastes prompt, observes avatar's face for fade-in / hold / decay. Verdict per D-B5 rubric (3/3 PASS, 1-2/3 PARTIAL, 0/3 FAIL).

2. **SC #4 — Body sway through ~30-45s utterance.** Operator pastes long-utterance prompt, observes body motion through entire reply. Verdict per D-B5 rubric.

3. **SC #5 — Cursor tracking (post-Plan-10-01 fix).** Operator moves cursor in/around/outside VTS window, observes head + eye tracking + steady-state hold. Verdict per same 3-check rubric.

Plus the milestone close decision itself (PASS / PARTIAL / FAIL ship verdict) is operator-recorded based on how the SCs settle.

These cannot be automated — they verify the rendered visual quality of the avatar, which is the user-facing deliverable of the §14 ceremony.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (10-01 T1/T2/T3, 10-02 T1/T2) or are checkpoint-typed (10-02 T3 is `checkpoint:human-verify`)
- [x] Sampling continuity: no 3 consecutive autonomous tasks without automated verify (10-01 has T1+T2+T3 each with pytest verify; 10-02 has T1+T2 each with shell verify; T3 is the human-verify gate)
- [x] Wave 0 covers all required test infrastructure (folded into 10-01 T1)
- [x] No watch-mode flags (all pytest invocations use `-x -q` or default; no `--watch`)
- [x] Feedback latency < 90s (focused pytest <10s warm; full suite ~30-60s; harness replay ~5s per mode)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready (planner sign-off 2026-05-09; awaiting plan-checker verification)
