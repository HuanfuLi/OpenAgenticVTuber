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

## Gap: SC2-SMIRK-RENDERING

- **Source:** Operator live UAT on 2026-05-09.
- **Observed:** `[smirk]` is parsed and routed (`[DISPATCH] kind=action name=smirk`), but Teto's face did not visibly show smirk.
- **Disposition:** marked as a Phase 10 SC #2 visual gap in `.planning/skeleton-verification.md`; follow-up should inspect default-plugin action binding output and the active rig's visible target for smirk.
