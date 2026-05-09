# Deferred Items

## Resolved verification-debt cleanup from 10-01 Task 3

- **Command:** `cd sidecar && uv run pytest -q`
- **Result:** 348 passed, 2 skipped, 2 failed
- **Failures:**
  - `tests/test_avatar_capabilities.py::test_audio_payload_olvt_canonical_keys`
  - `tests/test_avatar_capabilities.py::test_action_intent_roundtrip`
- **Cause observed:** both failures import `ActionIntent` from `contracts`, but the contract was deleted in Phase 7 in favor of `Dispatch`.
- **Scope assessment:** unrelated to 10-01 cursor/window changes. Plan 10-01 touched cursor driver, window detection, and direct tests only.
- **Disposition:** resolved during Phase 10 checkpoint handling by commit `2144ee5` (`test(phase-10): align stale contract tests with dispatch`).

## Resolved gap: SC5-EYE-TRACKING

- **Source:** Operator live UAT on 2026-05-09.
- **Observed:** Initial live UAT showed head tracking but no visible eye tracking. After Plan 10-04, operator confirmed eye tracking works with no problem.
- **Root cause:** Cursor eye output was too narrow and then horizontally inverted for Teto. The working path emits the full VTS eye input surface (`EyeLeftX`, `EyeRightX`, `EyeLeftY`, `EyeRightY`) and inverts eye X for Teto's `.vtube.json` mapping (`EyeLeftX` input range maps to `ParamEyeBallX` output in reverse).
- **Disposition:** resolved by Plan 10-04. `.planning/skeleton-verification.md` now records SC #5 as PASS.

## Resolved gap: SC2-SMIRK-RENDERING

- **Source:** Operator live UAT on 2026-05-09.
- **Observed:** `[smirk]` is parsed and routed (`[DISPATCH] kind=action name=smirk`). Operator initially reported no visible smirk, then corrected the report after seeing the smirk face.
- **Root cause fixed anyway:** production wraps `DefaultPlugin` in `PluginSupervisor`; `PluginAdapter.enqueue_action_code` called `on_action_code` on the supervisor, which inherited the base no-op implementation instead of delegating to the wrapped plugin. Commit `b39511d` delegates action codes through `PluginSupervisor`.
- **Disposition:** resolved by Plan 10-03. `.planning/skeleton-verification.md` now records SC #2 as PASS.

## Resolved gap: BLINK-EYE-VISIBILITY

- **Source:** Operator live UAT on 2026-05-09 while checking SC #2 and preparing SC #5.
- **Observed:** App-owned idle blinking fought VTS/model-owned blinking. Live behavior included half-blinks, open-to-close flicker, and eyes staying closed longer than expected.
- **Ownership decision:** VTube Studio owns normal idle blinking. AgenticLLMVTuber must not emit routine `EyeOpenLeft` / `EyeOpenRight` from `IdleDriver`. Future deliberate eye gestures such as wink remain allowed as explicit plugin/action/variant output with a bounded duration; they are not idle motion.
- **Disposition:** resolved in Plan 10-04 by deleting app-owned idle blinking and adding a regression that `IdleDriver` never emits eye-open blink params.

## Narrowed deferred item: SYNTHETIC-CANVAS-MULTI-MONITOR

- **Source:** Pre-close live diagnostic on 2026-05-09.
- **Observed:** The normal VTS-window path is DPI-aware in app startup (`python -m sidecar` runs `sidecar.__main__`, which sets Windows DPI awareness before sidecar imports). On the test machine, Win32 reported two monitors, VTS was detected on the secondary display at `rect=(2553,-81,3847,622)`, and `CursorDriver.tick()` emitted head plus eye params from that real VTS rect.
- **Disposition:** live DPI + multi-monitor VTS detection is validated for Phase 10. The remaining deferred robustness item is limited to the synthetic fallback path used when VTS cannot be detected; that fallback still projects against the primary monitor rect only.
