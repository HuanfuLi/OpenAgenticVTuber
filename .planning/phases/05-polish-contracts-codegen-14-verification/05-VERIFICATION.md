---
phase: 05-polish-contracts-codegen-14-verification
verified: 2026-05-08T06:35:02Z
status: passed
score: 9/9 must-haves verified
---

# Phase 05: Polish, Contracts Codegen Verification Report

**Phase Goal:** Land the codegen pipeline that closes SC-02. Pydantic source-of-truth should regenerate six TypeScript mirrors; npm run check:contracts should pass; renderer typecheck should pass. SC-01 is explicitly deferred to Phase 10 and is not in Phase 05 scope.
**Verified:** 2026-05-08T06:35:02Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Engineer can run the contract codegen and produce six TS files | VERIFIED | `npm run check:contracts` invoked `run-codegen.cjs`, wrote all six files, and exited 0. `packages/contracts/ts/` contains six generated files. |
| 2 | Re-running codegen is idempotent with no generated-file drift | VERIFIED | `git diff --exit-code packages/contracts/ts/ packages/contracts/generated/` exited 0 after regeneration. |
| 3 | Every regenerated TS file has a GENERATED banner naming its Pydantic source | VERIFIED | `rg "^// GENERATED FROM" packages/contracts/ts` found banners in all six TS mirrors. |
| 4 | WSMessage retains nine variants with required literal `type` discriminators | VERIFIED | `ws-message.ts` exports a nine-arm `WSMessage` union and required literal `type` fields for `text-input`, `display-text`, `shutdown`, `audio`, `control`, `full-text`, `force-new-message`, `error`, and `log`. |
| 5 | Renderer typecheck passes against generated contracts | VERIFIED | `npm --workspace apps/renderer run typecheck` exited 0. |
| 6 | Optional Pydantic fields become required nullable TS fields | VERIFIED | `audio-payload.ts` contains `audio: string \| null`; `action-intent.ts` contains `duration_ms: number \| null`; neither is optional. |
| 7 | Discriminator type guards are present in regenerated `ws-message.ts` | VERIFIED | Nine guards are exported: `isTextInput`, `isDisplayText`, `isShutdown`, `isAudioPayload`, `isControl`, `isFullText`, `isForceNewMessage`, `isError`, `isLog`. |
| 8 | Cross-file dedup works for `AudioPayloadMessage` and `ActionIntent` | VERIFIED | `ws-message.ts` imports `AudioPayloadMessage`, `DisplayTextField`, and `ActionIntent` via `import type`; declarations live in owner files. |
| 9 | Schema-mutation tests cover required-field forcing | VERIFIED | `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests -q` passed 7 tests, including required-field and idempotence coverage. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/contracts/codegen.sh` | Bash entry point resolving sidecar venv Python and invoking codegen | VERIFIED | Exists and executes `packages/contracts/scripts/codegen.py` through `$PYTHON`. |
| `packages/contracts/scripts/run-codegen.cjs` | Windows-safe npm runner for the bash entry point | VERIFIED | `package.json` scripts call this runner; it spawns `./packages/contracts/codegen.sh`. |
| `packages/contracts/scripts/codegen.py` | Pydantic -> JSON Schema -> jsts -> TS wrapper | VERIFIED | Contains `force_required`, `post_process`, `dedup_cross_file`, `emit_guards`, and `subprocess.run` for `json-schema-to-typescript`. |
| `packages/contracts/tests/test_codegen_schema_mutation.py` | Unit tests for required-field schema mutation | VERIFIED | Imports `force_required` and asserts AudioPayload required fields plus recursion/idempotence behavior. |
| `packages/contracts/tests/test_codegen_drift.py` | Idempotence drift test | VERIFIED | Runs codegen twice and checks generated output remains byte-identical/clean. |
| `package.json` | devDependency and contract scripts | VERIFIED | Declares `json-schema-to-typescript@15.0.4`, `codegen:contracts`, and `check:contracts`. |
| `packages/contracts/ts/*.ts` | Six generated TypeScript mirrors | VERIFIED | All six exist with generated banners and expected exported shapes. |
| `packages/contracts/generated/json-schema/*.schema.json` | Six committed JSON Schema intermediates | VERIFIED | All six schema files exist under `packages/contracts/generated/json-schema/`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` | `packages/contracts/scripts/run-codegen.cjs` | `codegen:contracts` and `check:contracts` scripts | VERIFIED | Both scripts use `node packages/contracts/scripts/run-codegen.cjs`. |
| `run-codegen.cjs` | `packages/contracts/codegen.sh` | child-process spawn | VERIFIED | Runner spawns `./packages/contracts/codegen.sh`. |
| `codegen.sh` | `packages/contracts/scripts/codegen.py` | resolved sidecar Python exec | VERIFIED | Script ends with `exec "$PYTHON" packages/contracts/scripts/codegen.py "$@"`. |
| `codegen.py` | Pydantic models in `packages/contracts/py/contracts/` | `from contracts import ...` | VERIFIED | Imports all six source models/unions before schema generation. |
| `codegen.py` | `json-schema-to-typescript` | `npx --yes json-schema-to-typescript` through `subprocess.run` | VERIFIED | `run_jsts()` resolves `npx`/`npx.cmd` and invokes jsts. |
| Renderer WS consumers | generated `@contracts/ws-message` | Vite/TS alias | VERIFIED | `apps/renderer/src/ws/client.ts` and `store.ts` import `@contracts/ws-message`; typecheck passes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `codegen.py` | JSON Schema per target | Pydantic `model_json_schema()` / `TypeAdapter(...).json_schema()` | Yes | FLOWING |
| `codegen.py` | TypeScript output | committed JSON Schema passed to `json-schema-to-typescript` | Yes | FLOWING |
| `apps/renderer/src/ws/store.ts` | `WSMessage` typing and guards | `@contracts/ws-message` generated file | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Contract regeneration and drift guard | `npm run check:contracts` | Wrote six TS files; generated diff clean | PASS |
| Contract tests | `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests -q` | `7 passed` | PASS |
| Renderer compile against generated contracts | `npm --workspace apps/renderer run typecheck` | `tsc --noEmit` exited 0 | PASS |
| Required nullable fields in schema | Node script checking `audio-payload.schema.json.required` | all required fields present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SC-02 | `05-01-PLAN.md` | Pydantic models are the source of truth; final phase replaces hand-written TS with codegen | SATISFIED | Codegen pipeline exists, regenerates six TS mirrors from Pydantic schema, drift guard and renderer typecheck pass. |
| SC-01 | Deferred from Phase 05 to Phase 10 | Formal six-criterion skeleton verification record | DEFERRED | `REQUIREMENTS.md` maps `SC-01` to `Phase 5 -> Phase 10`; Roadmap Phase 05 states SC-01 is not in scope after the 2026-05-08 pivot. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No blocker or warning anti-patterns found in modified contract/codegen files. |

### Human Verification Required

None. Phase 05 is contract/codegen infrastructure with automated verification. Live §14 behavior verification is explicitly deferred to Phase 10.

### Gaps Summary

No gaps found. SC-02 is achieved: Pydantic source-of-truth regenerates six TypeScript mirrors, generated files remain clean after drift check, contract tests pass, and the renderer typechecks against the generated contract surface.

---

_Verified: 2026-05-08T06:35:02Z_
_Verifier: Claude (gsd-verifier)_
