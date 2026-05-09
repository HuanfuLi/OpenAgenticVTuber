---
phase: 07
slug: three-category-code-parsing-dispatch
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
updated: 2026-05-08
---

# Phase 07 - Validation Strategy

Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest via `uv` for sidecar Python, npm contract check for generated contracts, renderer vitest via npm |
| **Config file** | `sidecar/pyproject.toml`, `package.json`, `apps/renderer/package.json` |
| **Quick run command** | `cd sidecar && uv run pytest tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration tests/orchestrator/test_code_extractor.py tests/parser/test_reserved.py -x --no-header` |
| **Full suite command** | `npm run check:contracts; cd sidecar && uv run pytest tests/avatar/test_extract_vts.py tests/orchestrator/test_code_extractor.py tests/orchestrator/test_tts_preprocessor.py tests/parser/test_reserved.py tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py tests/compositor/test_plugin_adapter.py tests/orchestrator/test_dispatch_routing.py tests/test_sidecar_boot.py tests/test_tts_manager.py tests/test_audio_payload_helpers.py -q; cd ../apps/renderer && npm test -- --run logs-drawer-intent` |
| **Estimated runtime** | ~60-120 seconds depending on contract generation and renderer test startup |

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command.
- **After every plan wave:** Run the commands listed for all completed plans in that wave.
- **Before `$gsd-verify-work`:** Run the full suite command above plus the `pyvts` import-site grep from Plan 07-07.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PARSE-03, PARSE-06 | contract smoke + VTS TriggerAnimation duration unit | `uv run --project sidecar python -c "from contracts import ActionCode, VariantToggle, EventFire, Dispatch; print(ActionCode(name='joy').kind, VariantToggle(name='hold-mic', hotkey_id='hk').kind, EventFire(name='wave', hotkey_id='hk', duration_ms=2833).duration_ms)"; cd sidecar && uv run pytest tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration -x --no-header` | Extends existing `tests/avatar/test_extract_vts.py`; asserts `duration_is_fallback` false for valid metadata and true for fallback metadata | pending |
| 07-02-01 | 02 | 2 | PARSE-03, PARSE-06 | contract drift | `npm run check:contracts` | Existing infra | pending |
| 07-03-01 | 03 | 2 | PARSE-01, PARSE-02, PARSE-04, PARSE-08 | unit | `cd sidecar && uv run pytest tests/orchestrator/test_code_extractor.py tests/orchestrator/test_tts_preprocessor.py -x --no-header` | Task creates tests | pending |
| 07-04-01 | 04 | 2 | PARSE-04, PARSE-07 | unit | `cd sidecar && uv run pytest tests/parser/test_reserved.py -x --no-header` | Task creates tests | pending |
| 07-05-01 | 05 | 2 | PARSE-05, PARSE-06 | unit | `cd sidecar && uv run pytest tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py -x --no-header` | Task creates tests, including final-delay `EventFire.duration_ms=2833 -> 2.833s`, final-delay `EventFire.duration_ms=11000 -> 11.0s`, and invalid/missing/nonpositive fallback `-> 10.0s` assertions | pending |
| 07-06-01 | 06 | 3 | PARSE-03 | unit | `cd sidecar && uv run pytest tests/plugins/test_api.py tests/compositor/test_plugin_adapter.py -x --no-header` | Extends existing Phase 6 tests | pending |
| 07-06-02 | 06 | 3 | PARSE-03, PARSE-05, PARSE-06 | unit/integration | `cd sidecar && uv run pytest tests/orchestrator/test_dispatch_routing.py tests/test_tts_manager.py tests/test_audio_payload_helpers.py -x --no-header` | Task creates/updates tests | pending |
| 07-07-01 | 07 | 4 | PARSE-01, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07 | integration | `cd sidecar && uv run pytest tests/test_sidecar_boot.py tests/orchestrator/test_dispatch_routing.py -x --no-header` | Task creates/updates tests | pending |
| 07-07-01b | 07 | 4 | PARSE-03 | architecture guard | `cd sidecar && uv run pytest tests/test_arch06_single_writer.py -x --no-header` | Test added in 06-07 (asserts `requestSetParameterValue` / `requestInjectParameterData` / `plugin_name` ownership stays in `pyvts_writer.py`); supersedes legacy `rg 'import pyvts'` count grep which missed indirect `PyvtsSafeWriter`-re-export wrappers (see 06-VERIFICATION post_verification F-2) | pending |
| 07-07-02 | 07 | 4 | PARSE-03 | renderer unit | `cd apps/renderer && npm test -- --run logs-drawer-intent` | Existing renderer test infra | pending |

---

## Requirement Coverage Map

| Requirement | Primary Plan(s) | Automated Evidence |
|-------------|-----------------|--------------------|
| PARSE-01 | 07-03, 07-07 | `tests/orchestrator/test_code_extractor.py`, `tests/orchestrator/test_dispatch_routing.py` |
| PARSE-02 | 07-03, 07-07 | `tests/orchestrator/test_tts_preprocessor.py`, renderer/display pipeline assertions |
| PARSE-03 | 07-01, 07-02, 07-06, 07-07 | `tests/compositor/test_plugin_adapter.py::test_action_code_delivered_to_active_plugin`, `tests/orchestrator/test_dispatch_routing.py`, `npm run check:contracts` |
| PARSE-04 | 07-03, 07-04, 07-07 | `<think>` unknown-event drop fixture plus `validate_reserved_names` reserved-name tests |
| PARSE-05 | 07-05, 07-06, 07-07 | `tests/vts/test_variant_state_manager.py` and dispatch routing tests |
| PARSE-06 | 07-01, 07-02, 07-03, 07-05, 07-06, 07-07 | `tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration` proving `Meta.Duration=1.833` maps through to `EventFire.duration_ms == 2833` after the +1000ms blend pad while fallback metadata preserves `duration_is_fallback is True`, `tests/orchestrator/test_code_extractor.py` proving fallback entries emit `EventFire.duration_ms == 10000`, `tests/vts/test_event_completion_tracker.py` proving final delays sleep directly (`2833ms -> 2.833s`, `11000ms -> 11.0s`) and missing/zero/negative fallback sleeps exactly `10000ms`, contract check for EventEntry/Dispatch |
| PARSE-07 | 07-04, 07-07 | `tests/parser/test_reserved.py`, `tests/test_sidecar_boot.py` |
| PARSE-08 | 07-03 | `tests/orchestrator/test_code_extractor.py::test_code_extractor_split_token` |

---

## Wave Verification

| Wave | Plans | Command |
|------|-------|---------|
| 1 | 07-01 | `uv run --project sidecar python -c "from contracts import ActionCode, VariantToggle, EventFire; print('dispatch-ok')"; cd sidecar && uv run pytest tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration -x --no-header` |
| 2 | 07-02, 07-03, 07-04, 07-05 | `npm run check:contracts; cd sidecar && uv run pytest tests/avatar/test_extract_vts.py tests/orchestrator/test_code_extractor.py tests/orchestrator/test_tts_preprocessor.py tests/parser/test_reserved.py tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py -q` |
| 3 | 07-06 | `cd sidecar && uv run pytest tests/plugins/test_api.py tests/compositor/test_plugin_adapter.py tests/orchestrator/test_dispatch_routing.py tests/test_tts_manager.py tests/test_audio_payload_helpers.py -q` |
| 4 | 07-07 | `cd sidecar && uv run pytest tests/test_sidecar_boot.py tests/orchestrator/test_dispatch_routing.py -q; cd ../apps/renderer && npm test -- --run logs-drawer-intent` |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase tasks create or
extend the specific test files they verify:

- `sidecar/tests/orchestrator/test_code_extractor.py`
- `sidecar/tests/avatar/test_extract_vts.py`
- `sidecar/tests/orchestrator/test_tts_preprocessor.py`
- `sidecar/tests/parser/test_reserved.py`
- `sidecar/tests/vts/test_variant_state_manager.py`
- `sidecar/tests/vts/test_event_completion_tracker.py`
- `sidecar/tests/compositor/test_plugin_adapter.py`
- `sidecar/tests/orchestrator/test_dispatch_routing.py`
- `sidecar/tests/test_sidecar_boot.py`
- `sidecar/tests/test_tts_manager.py`
- `sidecar/tests/test_audio_payload_helpers.py`
- `apps/renderer/tests/logs-drawer-intent.test.tsx`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live VTS visual confirmation that `{hold-mic}` toggles the avatar expression and `<wave>` fires the motion hotkey | PARSE-05, PARSE-06 | Requires VTube Studio running with a real loaded rig and visible avatar | After automated tests pass, run the app with VTS, type `[smirk] {hold-mic} <wave>` into chat, confirm `[DISPATCH]` logs for all three kinds, confirm the active plugin receives `smirk`, confirm the variant changes, and confirm `[EVENT-COMPLETE]` appears after the final `EventFire.duration_ms` delay (`Meta.Duration + 1s` for valid metadata, exactly `10.0s` for fallback metadata). **Operator note:** the action code MUST exist in the active plugin's `plugin.yaml`; `[joy]` was removed by 06-08 because the active Teto catalog does not own a `joy` variant. Pick any code from `plugins/default/plugin.yaml` (currently `anger / disgust / fear / neutral / sadness / smirk / surprise`) and any `{variant}` / `<event>` declared in the active avatar's `_avatar_overrides.yaml`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all required test infrastructure through existing frameworks and task-created test files.
- [x] No watch-mode flags are used.
- [x] Feedback latency target is less than 120 seconds for the focused suite.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-08
