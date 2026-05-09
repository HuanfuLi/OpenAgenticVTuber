# Deferred Items

## Out-of-scope full-suite failure discovered during 10-01 Task 3

- **Command:** `cd sidecar && uv run pytest -q`
- **Result:** 348 passed, 2 skipped, 2 failed
- **Failures:**
  - `tests/test_avatar_capabilities.py::test_audio_payload_olvt_canonical_keys`
  - `tests/test_avatar_capabilities.py::test_action_intent_roundtrip`
- **Cause observed:** both failures import `ActionIntent` from `contracts`, but the contract was deleted in Phase 7 in favor of `Dispatch`.
- **Scope assessment:** unrelated to 10-01 cursor/window changes. Plan 10-01 touched cursor driver, window detection, and direct tests only.
- **Disposition:** deferred per GSD scope-boundary rule; not fixed in this plan.
