---
phase: 04
slug: action-compositor-vts-bridge-body-sway-investigation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
---

# Phase 04 - Validation Strategy

Per-phase validation contract for feedback sampling during gap-closure execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24.x, Vitest where renderer tests are touched |
| **Config file** | `sidecar/pyproject.toml [tool.pytest.ini_options]`; renderer workspace package scripts |
| **Quick run command** | `cd sidecar && uv run pytest tests/compositor/ -x` |
| **Full suite command** | `cd sidecar && uv run pytest -x` |
| **Estimated runtime** | ~60 seconds for sidecar-focused full suite |

## Sampling Rate

- **After every task commit:** Run the task-specific `<automated>` command from the active gap plan.
- **After every plan wave:** Run `cd sidecar && uv run pytest tests/avatar/test_overrides.py tests/vts/ tests/compositor/ tests/test_phase4_bootstrap.py -q`.
- **Before `$gsd-verify-work`:** Phase 4 targeted suite and prior-phase regression suite must be green.
- **Max feedback latency:** 120 seconds for automated feedback; live VTS checks remain manual.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-05-01 | 05 | 1 | AVT-03, AVT-08 | unit | `cd sidecar && uv run pytest tests/compositor/test_intent_driver.py -x -v` | yes | pending |
| 04-05-02 | 05 | 1 | AVT-03, AVT-08 | unit/integration | `cd sidecar && uv run pytest tests/compositor/test_intent_driver.py tests/compositor/test_compositor.py tests/test_orchestrator_turn.py -x -v` | yes | pending |
| 04-06-01 | 06 | 1 | AVT-10 | unit | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py -x -v` | yes | pending |
| 04-06-02 | 06 | 1 | AVT-10 | integration | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/vts/test_window_detect.py -x -v` | yes | pending |
| 04-07-01 | 07 | 1 | AVT-06 | unit | `cd sidecar && uv run pytest tests/compositor/test_speech_driver.py -x -v` | yes | pending |
| 04-07-02 | 07 | 1 | AVT-06 | CLI/unit | `cd sidecar && uv run pytest tests/scripts/test_plot_speech_evidence.py -x -v` | planned | pending |

## Wave 0 Requirements

Existing infrastructure covers the gap-closure plans:

- `sidecar/tests/compositor/test_intent_driver.py` covers AVT-03/AVT-08 intent behavior.
- `sidecar/tests/compositor/test_cursor_driver.py` covers AVT-10 sidecar Win32 cursor math and ease-back.
- `sidecar/tests/compositor/test_speech_driver.py` covers AVT-06 speech-driver output.
- `sidecar/tests/vts/test_window_detect.py` covers VTS window detection.
- Renderer tests are only required if a future approved context amendment adds renderer cursor work.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live VTS idle and speech motion | AVT-01, AVT-02, AVT-06 | Visual avatar motion requires VTS+Teto and operator observation | Start sidecar and renderer with VTS+Teto loaded; send a multi-sentence TTS prompt; confirm idle drift/blinks, mouth RMS sync, and continuous speech-driven head/body motion. |
| Live body-sway A/B re-run | AVT-06 | 04-04 created deferred evidence because live VTS was unavailable | Use the dev-panel body-sway radio, capture real `[SPEECH-DRIVER]` logs, regenerate plots, record 5-10s clips, and update ratings. |
| Live discrete event demo | AVT-09 | Hotkey visibility cannot be proven from static tests | Send `fire-discrete-event:Star Eye [7]` while VTS+Teto is running and confirm the expression/prop toggles visibly. |

## Validation Sign-Off

- [x] All gap tasks have `<automated>` verify commands or manual-only rationale.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references for this gap-closure run.
- [x] No watch-mode flags in validation commands.
- [x] Feedback latency target is under 120 seconds for automated checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-08
