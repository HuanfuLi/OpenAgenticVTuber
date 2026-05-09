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

## Gap: SC5-EYE-TRACKING

- **Source:** Operator live UAT on 2026-05-09.
- **Observed:** Cursor now visibly tracks through the head and continues outside the VTS canvas, but eyes do not visibly track. This matches the pre-existing OpenLLMVtuber issue where only the head follows the cursor.
- **Current code path:** `CursorDriver` translates `ParamEyeBallX -> EyeLeftX` and `ParamEyeBallY -> EyeRightY`; Teto's `.vtube.json` maps `EyeLeftX` to `ParamEyeBallX` and `EyeRightY` to `ParamEyeBallY`, but live UAT still shows no visible eye response.
- **Hypothesis:** The eye path needs rig-specific routing/tuning beyond the generic Cubism-to-VTS resolver: possibly driving the full `EyeLeftX` / `EyeLeftY` / `EyeRightX` / `EyeRightY` input surface, stronger values, direct `ParamEyeBallX/Y` writes for this rig, or a cursor-specific avatar override.
- **Disposition:** marked as a Phase 10 SC #5 gap in `.planning/skeleton-verification.md`; not fixed in the current checkpoint.

## Resolved gap: SC2-SMIRK-RENDERING

- **Source:** Operator live UAT on 2026-05-09.
- **Observed:** `[smirk]` is parsed and routed (`[DISPATCH] kind=action name=smirk`). Operator initially reported no visible smirk, then corrected the report after seeing the smirk face.
- **Root cause fixed anyway:** production wraps `DefaultPlugin` in `PluginSupervisor`; `PluginAdapter.enqueue_action_code` called `on_action_code` on the supervisor, which inherited the base no-op implementation instead of delegating to the wrapped plugin. Commit `b39511d` delegates action codes through `PluginSupervisor`.
- **Disposition:** resolved by Plan 10-03. `.planning/skeleton-verification.md` now records SC #2 as PASS.

## Gap: BLINK-EYE-VISIBILITY

- **Source:** Operator live UAT on 2026-05-09 while checking SC #2 and preparing SC #5.
- **Observed:** Current blinking behavior sometimes keeps Teto's eyes closed too long, making it hard to inspect eye variants and cursor-driven eye tracking. Some blinks look correct; others obscure the eyes long enough to confuse visual verification.
- **Current code path:** `IdleDriver` sets `EyeOpenLeft` and `EyeOpenRight` to `-1.0` for 150ms and has a 10% chance to schedule a second blink 80ms after the first blink, which can produce a longer apparent closure once VTS smoothing is applied.
- **Disposition:** treat as a Phase 10 eye-verification support gap. Address alongside SC5 eye tracking rather than reopening SC2.
