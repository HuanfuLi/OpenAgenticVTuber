---
phase: 05-polish-contracts-codegen-14-verification
plan: 01
subsystem: contracts
tags: [pydantic, json-schema, typescript, codegen, renderer-typecheck]
requires:
  - phase: 01-plumbing-process-lifecycle
    provides: Pydantic contract package and hand-written TS mirror layout
provides:
  - Pydantic-to-JSON-Schema-to-TypeScript codegen pipeline for six contract surfaces
  - Committed JSON Schema intermediates for contract drift auditing
  - Contract codegen and drift tests
affects: [renderer, sidecar, contracts, phase-10-verification]
tech-stack:
  added: [json-schema-to-typescript@15.0.4]
  patterns: [Pydantic source-of-truth, committed generated intermediates, npm drift guard]
key-files:
  created:
    - packages/contracts/codegen.sh
    - packages/contracts/scripts/codegen.py
    - packages/contracts/scripts/run-codegen.cjs
    - packages/contracts/tests/test_codegen_schema_mutation.py
    - packages/contracts/tests/test_codegen_drift.py
    - packages/contracts/generated/json-schema/*.schema.json
  modified:
    - package.json
    - package-lock.json
    - .gitignore
    - packages/contracts/ts/*.ts
key-decisions:
  - "force_required marks const, anyOf-null, and defaulted Pydantic fields required before TypeScript generation."
  - "Cross-file duplicate declarations are removed by OWNER_FILE mapping and replaced with import type statements."
  - "Generated files use a two-line GENERATED banner naming the Pydantic source file."
  - "json-schema-to-typescript is invoked through npx --yes; npm scripts use a Windows-safe runner that still executes codegen.sh."
patterns-established:
  - "Run npm run check:contracts after Pydantic contract changes to regenerate and fail on drift."
  - "Keep packages/contracts/generated/json-schema/ committed alongside generated TypeScript."
requirements-completed: [SC-02]
duration: 9min
completed: 2026-05-08
---

# Phase 05 Plan 01: Contracts Codegen Summary

**Pydantic contracts now regenerate six TypeScript mirrors through JSON Schema with a committed drift guard**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-08T06:18:39Z
- **Completed:** 2026-05-08T06:27:56Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Added `json-schema-to-typescript@15.0.4`, `codegen:contracts`, and `check:contracts`.
- Added `packages/contracts/codegen.sh` plus the Python wrapper that emits six JSON Schema files and six TypeScript mirrors.
- Replaced all six `packages/contracts/ts/*.ts` files with generated output preserving required discriminators, nullable fields, cross-file imports, and nine WSMessage guards.
- Added seven contract tests: six schema-mutation tests and one idempotence drift test.

## Task Commits

1. **Task 1 RED: codegen tests** - `b18c8f7` (test)
2. **Task 1 GREEN: scaffold codegen** - `296a512` (feat)
3. **Task 2: generated contracts** - `f24b186` (feat)

## Files Created/Modified

- `packages/contracts/scripts/codegen.py` - Pydantic JSON Schema emission, `force_required`, jsts invocation, post-processing, cross-file dedup, guard emission.
- `packages/contracts/codegen.sh` - Bash entry point resolving the sidecar venv Python.
- `packages/contracts/scripts/run-codegen.cjs` - Windows-safe npm/test runner that invokes the bash entry point when system `bash.exe` points at unavailable WSL.
- `packages/contracts/generated/json-schema/*.schema.json` - committed intermediate schemas for all six contract surfaces.
- `packages/contracts/ts/*.ts` - regenerated TypeScript contract mirrors.
- `packages/contracts/tests/test_codegen_schema_mutation.py` - unit coverage for required-field schema mutation.
- `packages/contracts/tests/test_codegen_drift.py` - byte-idempotence regression test.
- `package.json` / `package-lock.json` - dev dependency and contract scripts.
- `.gitignore` - explicit note that generated JSON Schema files are committed.

## Decisions Made

- `force_required()` treats `const`, `anyOf` containing `null`, and any `default` as required so defaulted literals and Optional fields remain required in TypeScript.
- Cross-file dedup keeps declarations in owner files and imports them elsewhere; `AudioPayloadMessage` and `ActionIntent` are not redeclared in `ws-message.ts`.
- Generated banners are two-line comments naming the Pydantic source and regeneration command.
- `npm run check:contracts` is the durable drift guard: run it after contract model edits and commit both `packages/contracts/ts/` and `packages/contracts/generated/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed WSMessage recursion test to union variants**
- **Found during:** Task 1
- **Issue:** Pydantic includes nested non-message `$defs` such as `ActionIntent`; the test incorrectly asserted every `$defs` entry had a `type` field.
- **Fix:** Test now checks only `oneOf` discriminator variants.
- **Files modified:** `packages/contracts/tests/test_codegen_schema_mutation.py`
- **Verification:** Schema-mutation tests pass.
- **Committed in:** `296a512`

**2. [Rule 3 - Blocking] Resolved Windows subprocess lookup for `npx`**
- **Found during:** Task 2
- **Issue:** Windows Python could not spawn bare `npx` from the Git Bash-launched script.
- **Fix:** `codegen.py` resolves `npx` / `npx.cmd` with `shutil.which()`.
- **Files modified:** `packages/contracts/scripts/codegen.py`
- **Verification:** Codegen exits 0 and writes all six outputs.
- **Committed in:** `f24b186`

**3. [Rule 3 - Blocking] Added Windows-safe npm/test runner for broken system bash shim**
- **Found during:** Task 2
- **Issue:** `C:\Windows\System32\bash.exe` points at WSL, but this machine has no `/bin/bash`; tests and npm scripts failed when invoking bare `bash`.
- **Fix:** Added `run-codegen.cjs` to prefer Git Bash on Windows while still executing `packages/contracts/codegen.sh`.
- **Files modified:** `package.json`, `packages/contracts/scripts/run-codegen.cjs`, `packages/contracts/tests/test_codegen_drift.py`
- **Verification:** `npm run check:contracts` and all contract tests pass.
- **Committed in:** `f24b186`

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** No scope creep; fixes were required for correctness on the current Windows environment.

## Known Stubs

None.

## Verification

- `C:\Program Files\Git\bin\bash.exe ./packages/contracts/codegen.sh` - passed.
- `git diff --exit-code packages/contracts/ts/ packages/contracts/generated/` - passed.
- `npm --workspace apps/renderer run typecheck` - passed.
- `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests/ -v` - passed, 7 tests.
- `npm run check:contracts` - passed.

Note: bare `bash ./packages/contracts/codegen.sh` from PowerShell resolves to the Windows WSL shim on this machine and fails outside the repo. Git Bash itself and the npm wrapper both execute the required bash entry point successfully.

## User Setup Required

None.

## Open Follow-ups

- Optional `.github/workflows/contracts-drift.yml` can wire `npm run check:contracts` into CI.
- If contract tooling grows, consider moving the dev dependency into a dedicated `packages/contracts/ts/package.json`.

## Next Phase Readiness

SC-02 is complete. Future Pydantic contract changes have a repeatable regeneration command and drift check.

## Self-Check: PASSED

- Found summary, codegen entry point, Python wrapper, Windows-safe runner, generated WS schema, and generated WS TypeScript.
- Found task commits `b18c8f7`, `296a512`, and `f24b186` in git history.

---
*Phase: 05-polish-contracts-codegen-14-verification*
*Completed: 2026-05-08*
