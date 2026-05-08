---
phase: 5
slug: polish-contracts-codegen-14-verification
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-07
updated: 2026-05-08
---

# Phase 5 - Validation Strategy

Retroactive Nyquist audit after Phase 5 execution.

Phase 5 scope was reduced on 2026-05-08: SC-02 remains in scope, while SC-01 / the skeleton verification ceremony is deferred to Phase 10. This validation file therefore covers the executed `05-01` plan only.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | pytest 8.x for contract codegen tests; TypeScript compiler for renderer consumer check; npm script for drift guard |
| Config file | `sidecar/pyproject.toml`, `packages/contracts/py/pyproject.toml`, `apps/renderer/tsconfig.json`, `package.json` |
| Quick run command | `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests -q` |
| Full phase command | `npm run check:contracts && npm --workspace apps/renderer run typecheck && sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests -q` |
| Estimated runtime | ~35 seconds on the current Windows workstation |

## Sampling Rate

- After any Pydantic contract edit: run `npm run check:contracts`.
- After any codegen wrapper edit: run `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests -q` and `npm run check:contracts`.
- After generated TypeScript changes: run `npm --workspace apps/renderer run typecheck`.
- Before phase verification: run the full phase command above.
- Max feedback latency: under 1 minute for the automated phase scope.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SC-02 | schema mutation unit | `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests/test_codegen_schema_mutation.py -q` | yes | green |
| 05-01-02 | 01 | 1 | SC-02 | drift idempotence unit | `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests/test_codegen_drift.py -q` | yes | green |
| 05-01-03 | 01 | 1 | SC-02 | codegen drift integration | `npm run check:contracts` | yes | green |
| 05-01-04 | 01 | 1 | SC-02 | renderer consumer typecheck | `npm --workspace apps/renderer run typecheck` | yes | green |
| 05-01-05 | 01 | 1 | SC-02 | generated artifact shape | `rg "^// GENERATED FROM" packages/contracts/ts` plus guard/dedup greps | yes | green |

## Requirement Coverage

| Requirement | Coverage | Evidence |
|-------------|----------|----------|
| SC-02 | COVERED | Pydantic-to-JSON-Schema-to-TypeScript pipeline exists; six TS mirrors and six JSON Schema intermediates are generated; drift guard passes; renderer typecheck passes; seven contract tests pass. |
| SC-01 | DEFERRED | Removed from Phase 5 scope by the 2026-05-08 pivot. It is tracked as the Phase 10 milestone-close verification criterion, not as a Phase 5 Nyquist gap. |

## Wave 0 Requirements

- [x] `packages/contracts/tests/test_codegen_schema_mutation.py` verifies `force_required()` covers discriminator literals, Optional-null fields, defaulted fields, nested union variants, and idempotence.
- [x] `packages/contracts/tests/test_codegen_drift.py` verifies the codegen output is byte-stable across repeated runs.
- [x] `packages/contracts/codegen.sh` is the canonical bash entry point.
- [x] `packages/contracts/scripts/run-codegen.cjs` makes the npm drift guard reliable on this Windows environment while still invoking `codegen.sh`.
- [x] `packages/contracts/generated/json-schema/*.schema.json` are committed intermediates.
- [x] `packages/contracts/ts/*.ts` are generated mirrors with source banners.

## Manual-Only Verifications

None for the executed Phase 5 scope. Phase 5 is contract/codegen infrastructure and is fully covered by automated checks.

The visual/live §14 checks previously listed here belong to deferred SC-01 and will be validated in Phase 10 after the v2.0 animation refactor.

## Validation Audit 2026-05-08

| Metric | Count |
|--------|-------|
| Executed requirements audited | 1 |
| Gaps found | 0 |
| Resolved by existing tests | 5 |
| Escalated/manual-only | 0 |
| Deferred out-of-phase items removed from Phase 5 map | 1 |

## Commands Run During Audit

| Command | Result |
|---------|--------|
| `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests -q` | passed, 7 tests |
| `npm run check:contracts` | passed, regenerated six TS files with no generated diff |
| `npm --workspace apps/renderer run typecheck` | passed |
| Generated artifact shape checks | passed: six banners, six schemas, nine WS guards, no duplicated `ActionIntent` / `AudioPayloadMessage` in `ws-message.ts`, required nullable fields preserved |

## Validation Sign-Off

- [x] All executed tasks have automated verification.
- [x] Sampling continuity is satisfied for the executed one-plan phase.
- [x] Wave 0 references for SC-02 exist and pass.
- [x] No watch-mode flags are used.
- [x] Feedback latency is under 1 minute.
- [x] `nyquist_compliant: true` is set in frontmatter.

**Approval:** validated
