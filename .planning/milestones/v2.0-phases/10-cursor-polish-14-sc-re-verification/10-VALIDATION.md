---
phase: 10
slug: cursor-polish-14-sc-re-verification
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
last_audited: 2026-05-09T05:55:00-04:00
---

# Phase 10 - Validation Strategy

Retroactive Nyquist validation for completed Phase 10. This refreshes the original plan-time validation map after 10-03 and 10-04 closed SC2 smirk rendering, SC5 eye tracking, and blink visibility gaps.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | pytest via `uv` in `sidecar/pyproject.toml` |
| Harness | `sidecar/scripts/plumbing_harness.py` from Phase 6 |
| Artifact checks | PowerShell checks for `.planning/skeleton-verification.md` section/PASS/pending counts and replay JSON thresholds |
| Focused validation command | `cd sidecar && uv run pytest tests/compositor/test_idle_driver.py tests/compositor/test_compositor.py tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/compositor/test_cursor_driver_eye_tracking.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py tests/plugins/test_default_plugin.py tests/test_orchestrator_turn.py tests/orchestrator/test_dispatch_routing.py -q` |
| Latest audit result | 90 pytest passed; skeleton artifact has 6 PASS rows and 0 pending markers; baseline JSON thresholds pass; one `pyvts` import remains |

## Sampling Rate

- After cursor changes: run cursor driver, namespace, eye-tracking, window-detect, compositor, and ARCH-06 tests.
- After idle/blink changes: run `tests/compositor/test_idle_driver.py` and compositor merge tests.
- After plugin action changes: run default plugin, supervisor, plugin adapter, orchestrator turn, and dispatch routing tests.
- After skeleton-verification edits: run the skeleton artifact checks and baseline JSON threshold checks.
- Before milestone audit: run the focused validation command and confirm live UAT evidence is recorded in `10-VERIFICATION.md` and `.planning/skeleton-verification.md`.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement(s) | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------|-----------|-------------------|-------------|--------|
| 10-01 T1 | 10-01 | 1 | VFY-01, VFY-02 | window-detect helper and cursor namespace RED scaffold | `cd sidecar && uv run pytest tests/vts/test_window_detect.py -x -q` | yes | covered |
| 10-01 T2 | 10-01 | 1 | VFY-01, VFY-02 | cursor namespace, outside-window projection, synthetic fallback | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py -x -q` | yes | covered |
| 10-01 T3 | 10-01 | 1 | VFY-01, VFY-02, ARCH-06 carry-through | cursor/compositor integration and single-writer guard | focused cursor gate plus pyvts import grep | yes | covered |
| 10-02 T1 | 10-02 | 2 | VFY-03, VFY-04 | skeleton-verification artifact structure | `Select-String` checks for sections, PASS rows, and zero `___PENDING___` markers | yes | covered |
| 10-02 T2 | 10-02 | 2 | VFY-05 | lipsync and idle replay artifacts | parse `.planning/baselines/v2.0/{lipsync,idle}-phase10-replay.json` and assert pass/threshold values | yes | covered |
| 10-02 T3 | 10-02 | 2 | VFY-03, VFY-04 | operator §14 visual ceremony | operator records SC #2, #4, #5 verdicts in `.planning/skeleton-verification.md` | yes | passed |
| 10-03 T1 | 10-03 | 3 | VFY-03, VFY-04 | smirk action-code RED regression | `cd sidecar && uv run pytest tests/plugins/test_default_plugin.py tests/compositor/test_plugin_adapter.py -q` | yes | covered |
| 10-03 T2 | 10-03 | 3 | VFY-03, VFY-04 | DefaultPlugin, PluginSupervisor, and PluginAdapter smirk dispatch path | `cd sidecar && uv run pytest tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py tests/plugins/test_default_plugin.py tests/test_orchestrator_turn.py tests/orchestrator/test_dispatch_routing.py tests/test_arch06_single_writer.py -q` | yes | covered |
| 10-03 T3 | 10-03 | 3 | VFY-03, VFY-04 | live SC #2 smirk rerun | operator corrected SC #2 to PASS; `.planning/skeleton-verification.md` updated | yes | passed |
| 10-04 T1 | 10-04 | 4 | VFY-01, VFY-02, VFY-03, VFY-04 | cursor eye and blink ownership RED regressions | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver_eye_tracking.py tests/compositor/test_idle_driver.py -q` | yes | covered |
| 10-04 T2 | 10-04 | 4 | VFY-01, VFY-02, VFY-03, VFY-04 | full cursor eye surface, Teto horizontal inversion, app-owned idle blink removal | `cd sidecar && uv run pytest tests/compositor/test_idle_driver.py tests/compositor/test_compositor.py tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/compositor/test_cursor_driver_eye_tracking.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py -q` | yes | covered |
| 10-04 T3 | 10-04 | 4 | VFY-03, VFY-04 | live SC #5 and blink rerun | operator confirmed cursor eye tracking and blink behavior pass; skeleton final verdict PASS | yes | passed |

## Requirement Coverage Map

| Requirement | Primary Plan(s) | Automated Evidence | Manual Evidence | Status |
|-------------|-----------------|--------------------|-----------------|--------|
| VFY-01 | 10-01, 10-04 | cursor namespace, outside-window, synthetic fallback, and eye-tracking tests | SC #5 live UAT PASS | covered |
| VFY-02 | 10-01, 10-04 | window-detect helper tests, cursor fallback/projection tests, ARCH-06 guard | SC #5 live UAT PASS | covered |
| VFY-03 | 10-02, 10-03, 10-04 | skeleton artifact checks; smirk/cursor/blink regression suites | all six §14 SC rows recorded PASS | covered |
| VFY-04 | 10-02, 10-03, 10-04 | skeleton artifact checks and zero pending-marker check | operator-updated `.planning/skeleton-verification.md` | covered |
| VFY-05 | 10-02 | lipsync replay JSON has `passed: true` and `pearson_r >= 0.7`; idle replay JSON has `passed: true` and `0 < variance_sum < 0.5` | none required | covered |

No missing or partial automated requirement coverage remains. Visual quality checks that cannot be mechanized are recorded as passed manual UAT.

## Wave Verification

| Wave | Plans | Command | Latest Evidence |
|------|-------|---------|-----------------|
| 1 | 10-01 | cursor/window/ARCH-06 focused suite | 10-01 summary records final focused gate 28 passed; later combined audit 90 passed |
| 2 | 10-02 | skeleton artifact checks and replay JSON thresholds | skeleton has 6 PASS rows and 0 pending markers; replay JSON thresholds pass |
| 3 | 10-03 | smirk plugin/supervisor/adapter/orchestrator suite | 10-03 summary records 61 passed; later combined audit 90 passed |
| 4 | 10-04 | cursor eye, blink ownership, compositor, window, ARCH-06 suite | 10-04 summary records 32 passed; later combined audit 90 passed |

## Manual-Only Verifications

| Behavior | Requirement | Status | Why Manual | Evidence |
|----------|-------------|--------|------------|----------|
| SC #2 `[smirk]` smooth blend | VFY-03, VFY-04 | passed | Requires live avatar visual judgment | `.planning/skeleton-verification.md`; `10-VERIFICATION.md`; `10-03-SUMMARY.md` |
| SC #4 body sway through full utterance | VFY-03, VFY-04 | passed | Requires live audiovisual judgment | `.planning/skeleton-verification.md`; `10-VERIFICATION.md` |
| SC #5 cursor head and eye tracking plus blink behavior | VFY-01, VFY-02, VFY-03, VFY-04 | passed | Requires live VTube Studio rig observation | `.planning/skeleton-verification.md`; `10-VERIFICATION.md`; `10-04-SUMMARY.md` |
| Live DPI + secondary-monitor VTS detection | VFY-01, VFY-02 | passed | Requires real Windows monitor topology and VTS HWND coordinates | 2026-05-09 Win32 diagnostic recorded 2 monitors, VTS on `DISPLAY2`, and `CursorDriver.tick()` output from the secondary-monitor VTS rect |

The live DPI-aware VTS-window path is validated. Multi-monitor synthetic-canvas projection remains a future robustness improvement only for the fallback path used when VTS cannot be detected.

## Validation Audit 2026-05-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 3 stale validation areas refreshed: 10-02 ceremony wording, 10-03 smirk closure, 10-04 cursor/blink closure |
| Escalated | 0 |
| Automated requirement rows | 5/5 |
| Manual-only rows | 3 passed |

Commands run during this audit:

| Command | Result |
|---------|--------|
| `cd sidecar && uv run pytest tests/compositor/test_idle_driver.py tests/compositor/test_compositor.py tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/compositor/test_cursor_driver_eye_tracking.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py tests/plugins/test_default_plugin.py tests/test_orchestrator_turn.py tests/orchestrator/test_dispatch_routing.py -q` | 90 passed |
| `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/compositor/test_cursor_driver_eye_tracking.py tests/vts/test_window_detect.py -q` | 20 passed |
| Win32 monitor/VTS diagnostic via `uv run python -` | `SetProcessDPIAware` ok; primary `(0,0,2560,1440)`; virtual screen `(0,-81,5120,1521)`; 2 monitors; VTS HWND on `DISPLAY2` at `(2553,-81,3847,622)`; cursor driver output used the VTS rect |
| Skeleton artifact check for sections, PASS rows, and pending markers | sections=4, pass_rows=6, pending=0 |
| Replay JSON threshold check | lipsync pearson=0.9747730195034283, idle variance=0.06643749130899018 |
| `rg -n "import pyvts|from pyvts" sidecar/src` | one match: `sidecar/src/sidecar/vts/pyvts_writer.py` |

## Validation Sign-Off

- [x] All Phase 10 requirements map to automated verification or passed manual UAT.
- [x] 10-03 and 10-04 gap closures are reflected in validation coverage.
- [x] Skeleton verification has all six §14 SC verdicts as PASS and no pending markers.
- [x] Replay JSON artifacts clear lipsync and idle thresholds.
- [x] ARCH-06 single-writer import guard remains satisfied.
- [x] No watch-mode test command is used.
- [x] `nyquist_compliant: true` and `wave_0_complete: true` remain set in frontmatter.

**Approval:** validated
