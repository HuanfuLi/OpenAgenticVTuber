---
phase: 07
slug: three-category-code-parsing-dispatch
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
last_audited: 2026-05-09T05:47:00-04:00
---

# Phase 07 - Validation Strategy

Retroactive Nyquist validation for completed Phase 7. This refreshes the original execution-time validation map after 07-08 closed the prompt/catalog gap and live `{heart-eye}` variant UAT passed.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Sidecar framework | pytest via `uv` in `sidecar/pyproject.toml` |
| Contract/codegen framework | root `npm run check:contracts` |
| Renderer framework | Vitest via `apps/renderer/package.json` |
| Quick command | `cd sidecar && uv run pytest tests/orchestrator/test_code_extractor.py tests/parser/test_reserved.py -x --no-header` |
| Phase validation command | `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py tests/plugins/test_manifest_watcher.py tests/test_orchestrator_turn.py tests/test_sidecar_boot.py tests/orchestrator/test_dispatch_routing.py tests/orchestrator/test_code_extractor.py tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py -q` |
| Renderer command | `cd apps/renderer && npm test -- --run logs-drawer-intent` |
| Drift gate | `npm run check:contracts` |
| Latest audit result | contracts passed; sidecar 83 passed; renderer 4 passed |

## Sampling Rate

- After parser or dispatch changes: run the quick command plus the touched test file.
- After prompt/catalog or boot wiring changes: run the Phase validation command.
- After contract changes: run `npm run check:contracts`.
- After renderer log-surface changes: run the renderer command.
- Before phase verification: run all four commands above and update `07-HUMAN-UAT.md` with current live status.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement(s) | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 07-01 | 1 | PARSE-03, PARSE-06 | contract smoke and VTS TriggerAnimation duration unit | `uv run --project sidecar python -c "from contracts import ActionCode, VariantToggle, EventFire; print('dispatch-ok')"`; `cd sidecar && uv run pytest tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration -x --no-header` | yes | covered |
| 07-02-01 | 07-02 | 2 | PARSE-03, PARSE-06 | contract drift | `npm run check:contracts` | yes | covered |
| 07-03-01 | 07-03 | 2 | PARSE-01, PARSE-02, PARSE-04, PARSE-08 | parser and strip pipeline unit tests | `cd sidecar && uv run pytest tests/orchestrator/test_code_extractor.py tests/orchestrator/test_tts_preprocessor.py -x --no-header` | yes | covered |
| 07-04-01 | 07-04 | 2 | PARSE-04, PARSE-07 | reserved-name and collision unit tests | `cd sidecar && uv run pytest tests/parser/test_reserved.py -x --no-header` | yes | covered |
| 07-05-01 | 07-05 | 2 | PARSE-05, PARSE-06 | variant state and event completion unit tests | `cd sidecar && uv run pytest tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py -x --no-header` | yes | covered |
| 07-06-01 | 07-06 | 3 | PARSE-03 | plugin adapter action delivery | `cd sidecar && uv run pytest tests/plugins/test_api.py tests/compositor/test_plugin_adapter.py -x --no-header` | yes | covered |
| 07-06-02 | 07-06 | 3 | PARSE-03, PARSE-05, PARSE-06 | dispatch routing, TTS payload, audio payload integration | `cd sidecar && uv run pytest tests/orchestrator/test_dispatch_routing.py tests/test_tts_manager.py tests/test_audio_payload_helpers.py -x --no-header` | yes | covered |
| 07-07-01 | 07-07 | 4 | PARSE-01, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07 | sidecar boot and dispatch integration | `cd sidecar && uv run pytest tests/test_sidecar_boot.py tests/orchestrator/test_dispatch_routing.py -x --no-header` | yes | covered |
| 07-07-01b | 07-07 | 4 | PARSE-03, ARCH-06 carry-through | single-writer architecture guard | `cd sidecar && uv run pytest tests/test_arch06_single_writer.py -x --no-header` | yes | covered |
| 07-07-02 | 07-07 | 4 | PARSE-03 | renderer dispatch-log highlighting | `cd apps/renderer && npm test -- --run logs-drawer-intent` | yes | covered |
| 07-08-01 | 07-08 | 5 | PARSE-03, PARSE-05, PARSE-06 | prompt/catalog unit tests | `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py -x --no-header` | yes | covered |
| 07-08-02 | 07-08 | 5 | PARSE-03, PARSE-05, PARSE-06 | boot/orchestrator prompt catalog integration | `cd sidecar && uv run pytest tests/test_orchestrator_turn.py tests/test_sidecar_boot.py tests/plugins/test_manifest_watcher.py tests/orchestrator/test_dispatch_routing.py -x --no-header` | yes | covered |

## Requirement Coverage Map

| Requirement | Primary Plan(s) | Automated Evidence | Manual Evidence | Status |
|-------------|-----------------|--------------------|-----------------|--------|
| PARSE-01 | 07-03, 07-07 | `tests/orchestrator/test_code_extractor.py`, `tests/orchestrator/test_dispatch_routing.py` | none required | covered |
| PARSE-02 | 07-03, 07-07 | `tests/orchestrator/test_tts_preprocessor.py`, full-chain extractor tests | none required | covered |
| PARSE-03 | 07-01, 07-02, 07-06, 07-07, 07-08 | dispatch contracts, `tests/compositor/test_plugin_adapter.py`, `tests/orchestrator/test_dispatch_routing.py`, prompt/catalog tests, boot tests | `07-HUMAN-UAT.md` logs live variant path | covered |
| PARSE-04 | 07-03, 07-04, 07-07 | unknown `<think>` fixture, `tests/parser/test_reserved.py`, boot reserved-name tests | none required | covered |
| PARSE-05 | 07-05, 07-06, 07-07, 07-08 | `tests/vts/test_variant_state_manager.py`, dispatch routing tests, prompt/catalog active variant listing tests | live `{heart-eye}` UAT passed | covered |
| PARSE-06 | 07-01, 07-02, 07-03, 07-05, 07-06, 07-07, 07-08 | `tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration`, `tests/orchestrator/test_code_extractor.py`, `tests/vts/test_event_completion_tracker.py`, prompt/catalog active event listing tests | live event UAT is prerequisite-gated by current Teto `events: []` | covered with external live prerequisite |
| PARSE-07 | 07-04, 07-07 | `tests/parser/test_reserved.py`, `tests/test_sidecar_boot.py` | none required | covered |
| PARSE-08 | 07-03 | split-token fixtures in `tests/orchestrator/test_code_extractor.py` | none required | covered |

No missing or partial automated requirement coverage remains. The only live item is not a code/test gap: current imported Teto has no event catalog entries, so real VTS `<event>` motion requires selecting or importing an event-bearing avatar.

## Wave Verification

| Wave | Plans | Command | Latest Evidence |
|------|-------|---------|-----------------|
| 1 | 07-01 | contract smoke plus `test_trigger_animation_uses_motion3_duration` | covered in 07 summaries and Phase verification |
| 2 | 07-02, 07-03, 07-04, 07-05 | `npm run check:contracts`; parser/reserved/variant/event tests | covered in 07 summaries and Phase verification |
| 3 | 07-06 | plugin adapter, dispatch routing, TTS/audio payload tests | covered in 07 summaries and Phase verification |
| 4 | 07-07 | sidecar boot, dispatch routing, renderer logs, single-writer guard | covered in 07 summaries and Phase verification |
| 5 | 07-08 | prompt/catalog, orchestrator boot, manifest watcher, dispatch routing | latest audit: sidecar Phase validation command `83 passed` |

## Manual-Only Verifications

| Behavior | Requirement | Status | Why Manual | Evidence |
|----------|-------------|--------|------------|----------|
| Live VTS variant confirmation with active Teto | PARSE-03, PARSE-05 | passed | Requires VTube Studio and visible rig state | `07-HUMAN-UAT.md`; `07-VERIFICATION.md` records user-confirmed `{heart-eye}` visual switch |
| Live VTS event confirmation with event-bearing avatar catalog | PARSE-03, PARSE-06 | prerequisite-gated | Current active Teto has `events: []`; real event hotkey motion requires an active avatar whose overrides contain at least one event | `07-HUMAN-UAT.md`; `07-VERIFICATION.md` records this as external catalog-gated, not a parser/routing gap |

## Validation Audit 2026-05-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 2 stale 07-08 validation rows refreshed |
| Escalated | 0 |
| Automated requirement rows | 8/8 |
| Manual-only rows | 1 passed, 1 prerequisite-gated |

Commands run during this audit:

| Command | Result |
|---------|--------|
| `npm run check:contracts` | passed, no generated contract drift |
| `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py tests/plugins/test_manifest_watcher.py tests/test_orchestrator_turn.py tests/test_sidecar_boot.py tests/orchestrator/test_dispatch_routing.py tests/orchestrator/test_code_extractor.py tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py -q` | 83 passed |
| `cd apps/renderer && npm test -- --run logs-drawer-intent` | 1 file passed, 4 tests passed |

## Validation Sign-Off

- [x] All Phase 7 requirements map to automated verification or documented manual/external prerequisite.
- [x] 07-08 prompt/catalog closure rows are covered, not planned.
- [x] Sampling continuity is preserved across all five Phase 7 waves.
- [x] No watch-mode test command is used.
- [x] Live variant UAT passed; live event UAT is explicitly catalog-gated.
- [x] `nyquist_compliant: true` and `wave_0_complete: true` remain set in frontmatter.

**Approval:** validated
