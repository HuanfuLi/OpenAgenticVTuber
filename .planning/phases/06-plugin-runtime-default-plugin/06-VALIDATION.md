---
phase: 6
slug: plugin-runtime-default-plugin
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-08
---

# Phase 6 - Validation Strategy

Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | pytest 8.x for sidecar; npm typecheck/codegen for contracts |
| Config file | `sidecar/pyproject.toml`, `package.json` |
| Quick run command | `cd sidecar && uv run pytest tests/plugins tests/compositor -x --no-header` |
| Full suite command | `cd sidecar && uv run pytest tests/plugins tests/compositor tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py -x --no-header && npm run check:contracts && npm --workspace apps/renderer run typecheck` |
| Estimated runtime | ~90 seconds |

## Sampling Rate

- After every task commit: run the quick command.
- After every plan wave: run the full suite command.
- Before `$gsd-verify-work`: full suite plus manual VTS smoke must be green.
- Max feedback latency: 2 minutes.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | PLG-03, ARCH-11 | unit | `cd sidecar && uv run pytest tests/plugins/test_api.py -x` | no | pending |
| 06-01-02 | 01 | 1 | PLG-01, PLG-06, ARCH-08 | unit | `cd sidecar && uv run pytest tests/plugins/test_manifest_loader.py -x` | no | pending |
| 06-01-03 | 01 | 1 | PLG-02, ARCH-09 | unit | `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py -x` | no | pending |
| 06-01-04 | 01 | 1 | PLG-05, ARCH-12 | unit | `cd sidecar && uv run pytest tests/compositor/test_clamp_lock_filter.py -x` | no | pending |
| 06-02-01 | 02 | 2 | PLG-04, ARCH-04 | unit | `cd sidecar && uv run pytest tests/plugins/test_supervisor.py -x` | no | pending |
| 06-02-02 | 02 | 2 | ARCH-04, ARCH-05 | unit | `cd sidecar && uv run pytest tests/compositor/test_plugin_adapter.py tests/compositor/test_compositor.py -x` | no | pending |
| 06-02-03 | 02 | 2 | ARCH-06, ARCH-10 | architecture | `cd sidecar && uv run pytest tests/architecture/test_pyvts_writer_singleton.py -x` | no | pending |
| 06-02-04 | 02 | 2 | VFY-05 support | CLI | `cd sidecar && uv run pytest tests/scripts/test_plumbing_harness.py -x` | no | pending |
| 06-03-01 | 03 | 3 | PLG-07 | unit | `cd sidecar && uv run pytest tests/plugins/test_default_plugin.py -x` | no | pending |
| 06-03-02 | 03 | 3 | PLG-07, ARCH-03 | unit | `cd sidecar && uv run pytest tests/plugins/test_default_plugin_parser.py -x` | no | pending |
| 06-03-03 | 03 | 3 | PLG-01, PLG-09 | integration | `cd sidecar && uv run pytest tests/plugins/test_default_plugin_integration.py -x` | no | pending |

## Wave 0 Requirements

- [ ] `sidecar/tests/plugins/` package with API, manifest, loader, prompt, supervisor, and default-plugin tests.
- [ ] `sidecar/tests/architecture/test_pyvts_writer_singleton.py` for the pyvts import invariant.
- [ ] `sidecar/tests/scripts/test_plumbing_harness.py` for baseline/harness JSON output.
- [ ] Existing pytest infrastructure is sufficient; no new test framework is needed.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Active plugin swap changes visible avatar motion | Phase 6 SC #1 | Requires VTube Studio and visual comparison | Set active plugin to `default`, restart, observe motion; set to a test plugin with different head output, restart, observe changed motion without editing compositor files. |
| `[joy]` visual smoothness | Phase 6 SC #2 / VFY-03 | Visual quality is intentionally operator-judged | In Phase 10, force an LLM response with `[joy]`; record PASS/PARTIAL/FAIL for smooth ramp-in and decay. |
| Speech body/head motion quality | Phase 6 SC #2 / VFY-03 | Current head-only baseline is not a reliable numeric target | In Phase 10, play a 30s utterance and judge non-flat, non-jerky motion. |

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency target < 2 minutes.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-08
