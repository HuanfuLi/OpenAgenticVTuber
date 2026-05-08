---
phase: 6
slug: plugin-runtime-default-plugin
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
last_audited: 2026-05-08T18:35:00-04:00
---

# Phase 6 - Validation Strategy

Per-phase validation contract for feedback sampling during and after execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | pytest for sidecar; npm codegen diff gate for contracts; TypeScript `tsc` for renderer |
| Config file | `sidecar/pyproject.toml`, `package.json`, `apps/renderer/tsconfig.json` |
| Quick run command | `cd sidecar && uv run pytest tests/plugins tests/compositor -q` |
| Phase validation command | `cd sidecar && uv run pytest tests/plugins tests/compositor tests/architecture/test_pyvts_writer_singleton.py tests/test_arch06_single_writer.py tests/scripts/test_plumbing_harness.py tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/vts/test_pyvts_writer.py -q` |
| Contract command | `npm run check:contracts` |
| Renderer command | `npm --workspace apps/renderer run typecheck` |
| Latest audit result | 119 pytest passed; contracts passed; renderer typecheck passed |

## Sampling Rate

- After every task commit: run the quick command or the task-specific command in the map below.
- After every plan wave: run the Phase validation command.
- Before `$gsd-verify-work`: run Phase validation command plus contract and renderer commands.
- Manual VTS UAT is required for visible motion quality and VTS auth/log behavior.
- Max feedback latency target: 2 minutes for targeted tests, 5 minutes for full Phase validation.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | PLG-03, ARCH-11 | unit | `cd sidecar && uv run pytest tests/plugins/test_api.py -q` | yes | covered |
| 06-01-02 | 01 | 1 | PLG-01, PLG-06, ARCH-08 | unit | `cd sidecar && uv run pytest tests/plugins/test_manifest_loader.py -q` | yes | covered |
| 06-01-03 | 01 | 1 | PLG-02, ARCH-09 | unit | `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py -q` | yes | covered |
| 06-01-04 | 01 | 1 | PLG-05, ARCH-12 | unit | `cd sidecar && uv run pytest tests/compositor/test_clamp_lock_filter.py -q` | yes | covered |
| 06-02-01 | 02 | 2 | PLG-04, ARCH-04 | unit | `cd sidecar && uv run pytest tests/plugins/test_supervisor.py -q` | yes | covered |
| 06-02-02 | 02 | 2 | ARCH-04, ARCH-05 | unit | `cd sidecar && uv run pytest tests/compositor/test_plugin_adapter.py tests/compositor/test_compositor.py -q` | yes | covered |
| 06-02-03 | 02 | 2 | ARCH-06, ARCH-10 | architecture | `cd sidecar && uv run pytest tests/architecture/test_pyvts_writer_singleton.py -q` | yes | covered |
| 06-02-04 | 02 | 2 | VFY-05 support | CLI | `cd sidecar && uv run pytest tests/scripts/test_plumbing_harness.py -q` | yes | covered |
| 06-03-01 | 03 | 3 | PLG-07 | unit | `cd sidecar && uv run pytest tests/plugins/test_default_plugin.py -q` | yes | covered |
| 06-03-02 | 03 | 3 | PLG-07, ARCH-03 | unit | `cd sidecar && uv run pytest tests/plugins/test_default_plugin_parser.py -q` | yes | covered |
| 06-03-03 | 03 | 3 | PLG-01, PLG-09 | integration | `cd sidecar && uv run pytest tests/plugins/test_default_plugin_integration.py -q` | yes | covered |
| 06-04-01 | 04 | 4 | PLG-07 body sway registry | unit | `cd sidecar && uv run pytest tests/compositor/test_body_sway_registry.py -q` | yes | covered |
| 06-04-02 | 04 | 4 | speech-driven body/lipsync | unit | `cd sidecar && uv run pytest tests/compositor/test_speech_driver.py -q` | yes | covered |
| 06-05-01 | 05 | 5 | plugin prompt/orchestrator path | integration | `cd sidecar && uv run pytest tests/test_orchestrator_turn.py -q` | yes | covered |
| 06-06-01 | 06 | 6 | supervised default plugin render path | unit/integration | `cd sidecar && uv run pytest tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py tests/plugins/test_default_plugin_integration.py -q` | yes | covered |
| 06-07-01 | 07 | 6 | ARCH-05, ARCH-06, TTS-04 writer consolidation | architecture/integration | `cd sidecar && uv run pytest tests/test_arch06_single_writer.py tests/vts/test_pyvts_writer.py tests/compositor/test_speech_driver.py tests/test_orchestrator_turn.py -q` | yes | covered |
| 06-07-02 | post-UAT | 6 | PLG-07/F-3 visible body sway | unit + human UAT | `cd sidecar && uv run pytest tests/compositor/test_clamp_lock_filter.py tests/compositor/test_body_sway_registry.py tests/compositor/test_speech_driver.py -q` | yes | covered + UAT passed |

## Wave 0 Requirements

- [x] `sidecar/tests/plugins/` covers API, manifest, loader, prompt, supervisor, default plugin, parser, integration, and watcher behavior.
- [x] `sidecar/tests/architecture/test_pyvts_writer_singleton.py` covers the original pyvts import invariant.
- [x] `sidecar/tests/test_arch06_single_writer.py` covers the strengthened single-writer invariant that blocks indirect VTS writer wrappers.
- [x] `sidecar/tests/scripts/test_plumbing_harness.py` covers baseline harness JSON output and lipsync correlation.
- [x] Existing pytest/npm infrastructure is sufficient; no new test framework is needed.

## Manual-Only Verifications

| Behavior | Requirement | Status | Why Manual | Test Instructions |
|----------|-------------|--------|------------|-------------------|
| Active plugin swap changes visible avatar motion | Phase 6 SC #1 | manual-only | Requires live sidecar/VTube Studio observation and log review | Set active plugin to `default`, restart, observe motion; set to a test plugin with different head output, restart, observe changed motion without editing compositor files. |
| `[joy]` visual smoothness | Phase 6 SC #2 / VFY-03 | manual-only | Visual quality is intentionally operator-judged | Force an LLM response with `[joy]`; record PASS/PARTIAL/FAIL for smooth ramp-in and decay. |
| Speech body/head motion quality | Phase 6 SC #2 / VFY-03 | passed 2026-05-08 | Requires live audiovisual inspection | Operator UAT confirmed lipsync and body sway visible after `fix(06): preserve VTS tracking input ranges`. |
| Single VTS auth/log flow | ARCH-06 | manual-only | Requires live VTS log observation | Start sidecar with VTS running and confirm exactly one compositor VTS plugin identity, no Mouth Driver identity, and no VTS request flood. |

## Validation Audit 2026-05-08

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |
| New test files required | 0 |

### Gap Resolution Notes

- Updated stale validation state from draft/pending to validated/covered.
- Added missing Phase 6 plans 06-04 through 06-07 to the Per-Task Verification Map.
- Added post-verification ARCH-06 guard coverage for `tests/test_arch06_single_writer.py`.
- Added final F-3 validation coverage for VTS tracking input ranges and visible body sway UAT.

### Commands Run

| Command | Result |
|---------|--------|
| `cd sidecar && uv run pytest tests/plugins tests/compositor tests/architecture/test_pyvts_writer_singleton.py tests/test_arch06_single_writer.py tests/scripts/test_plumbing_harness.py tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/vts/test_pyvts_writer.py -q` | 119 passed |
| `npm run check:contracts` | passed |
| `npm --workspace apps/renderer run typecheck` | passed |

### Repo Health Note

The full unfiltered `cd sidecar && uv run pytest` suite is currently blocked by a pre-existing workspace deletion of `avatars/teto/teto_overrides.yaml`, which causes avatar override tests outside the Phase 6 validation slice to fail. This validation audit does not restore or revert that external dirty-worktree change.

## Validation Sign-Off

- [x] All tasks have automated verify commands or explicit manual-only classification.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency target < 5 minutes for the Phase validation command.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated 2026-05-08
