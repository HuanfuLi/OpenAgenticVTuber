---
phase: 07-three-category-code-parsing-dispatch
plan: 02
subsystem: contracts
tags: [typescript, json-schema, codegen, dispatch, contracts]
requires:
  - phase: 07-three-category-code-parsing-dispatch
    provides: Python Dispatch contract and codegen registration from 07-01
provides:
  - Generated Dispatch TypeScript and JSON Schema mirrors
  - AudioPayload/EventEntry/WSMessage generated mirrors aligned to Dispatch
  - Removal of generated ActionIntent TypeScript and JSON Schema mirrors
affects: [contract-consumers, parser-dispatch, renderer-types, websocket-payloads]
tech-stack:
  added: []
  patterns: [Pydantic discriminated union generated as named TypeScript alias]
key-files:
  created:
    - packages/contracts/generated/json-schema/dispatch.schema.json
    - packages/contracts/ts/dispatch.ts
  modified:
    - packages/contracts/scripts/codegen.py
    - packages/contracts/generated/json-schema/audio-payload.schema.json
    - packages/contracts/generated/json-schema/avatar-import-plan.schema.json
    - packages/contracts/generated/json-schema/avatar-overrides.schema.json
    - packages/contracts/generated/json-schema/event-entry.schema.json
    - packages/contracts/generated/json-schema/ws-message.schema.json
    - packages/contracts/ts/audio-payload.ts
    - packages/contracts/ts/event-entry.ts
    - packages/contracts/ts/index.ts
    - packages/contracts/ts/ws-message.ts
  deleted:
    - packages/contracts/generated/json-schema/action-intent.schema.json
    - packages/contracts/ts/action-intent.ts
key-decisions:
  - "Generated TS mirrors expose a named Dispatch union rather than repeating ActionCode | VariantToggle | EventFire inline."
  - "Nested generated schemas for avatar import/overrides were committed because the global contract drift guard covers all packages/contracts/generated output."
patterns-established:
  - "Top-level discriminated unions may need explicit TS alias post-processing when json-schema-to-typescript emits only variant interfaces."
requirements-completed: [PARSE-03, PARSE-06]
duration: 8min
completed: 2026-05-09
---

# Phase 07 Plan 02: Generated Dispatch Mirror Summary

**Generated Dispatch TypeScript and JSON Schema mirrors replace ActionIntent, with AudioPayload dispatches wired as `Dispatch[]`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-09T00:14:35Z
- **Completed:** 2026-05-09T00:22:21Z
- **Tasks:** 1
- **Files modified:** 14

## Accomplishments

- Regenerated contract mirrors from the Python `Dispatch` source of truth.
- Added `packages/contracts/ts/dispatch.ts` and `packages/contracts/generated/json-schema/dispatch.schema.json`.
- Updated audio, event-entry, and websocket mirrors to use ordered dispatch records and event fallback metadata.
- Removed generated `ActionIntent` TS/schema artifacts and updated the TS barrel export.

## Task Commits

1. **Task 1: Regenerate Dispatch mirrors and remove ActionIntent mirrors** - `d114d7e` (feat)

## Files Created/Modified

- `packages/contracts/scripts/codegen.py` - Adds post-processing so generated mirrors expose `Dispatch` and use `Dispatch[]`.
- `packages/contracts/ts/dispatch.ts` - Generated `ActionCode`, `VariantToggle`, `EventFire`, and `Dispatch` TS mirror.
- `packages/contracts/generated/json-schema/dispatch.schema.json` - Generated discriminated-union JSON Schema.
- `packages/contracts/ts/audio-payload.ts` - Replaces `actions: ActionIntent[]` with `dispatches: Dispatch[]`.
- `packages/contracts/generated/json-schema/audio-payload.schema.json` - Replaces `ActionIntent` payload schema with Dispatch union items.
- `packages/contracts/ts/event-entry.ts` - Adds `hotkey_id` and `duration_is_fallback`.
- `packages/contracts/generated/json-schema/event-entry.schema.json` - Adds event hotkey and fallback metadata.
- `packages/contracts/ts/ws-message.ts` - Imports Dispatch-aware audio payload mirrors.
- `packages/contracts/generated/json-schema/ws-message.schema.json` - Reflects Dispatch-bearing audio messages.
- `packages/contracts/ts/index.ts` - Exports `ActionCode`, `Dispatch`, `EventFire`, and `VariantToggle`.
- `packages/contracts/generated/json-schema/avatar-import-plan.schema.json` - Regenerated nested EventEntry schema.
- `packages/contracts/generated/json-schema/avatar-overrides.schema.json` - Regenerated nested EventEntry schema.
- `packages/contracts/ts/action-intent.ts` - Deleted obsolete generated mirror.
- `packages/contracts/generated/json-schema/action-intent.schema.json` - Deleted obsolete generated mirror.

## Decisions Made

- Kept `Dispatch` as the public TS alias so consumers do not depend on a repeated inline union shape.
- Committed the avatar import/overrides generated schema drift because `npm run check:contracts` validates the whole generated schema directory, and those files embed the updated `EventEntry` shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Dispatch alias post-processing to codegen**
- **Found during:** Task 1
- **Issue:** The generator emitted `ActionCode`, `VariantToggle`, and `EventFire` interfaces, but no top-level `export type Dispatch`; audio mirrors also used an inline union instead of `Dispatch[]`.
- **Fix:** Added a narrow post-processing rule in `packages/contracts/scripts/codegen.py` to append the named alias and import/use `Dispatch` in generated audio payload mirrors.
- **Files modified:** `packages/contracts/scripts/codegen.py`
- **Verification:** `npm run check:contracts`; marker checks for `export type Dispatch` and `dispatches: Dispatch[]`.
- **Committed in:** `d114d7e`

**2. [Rule 3 - Blocking] Included nested generated schemas required by the drift guard**
- **Found during:** Task 1
- **Issue:** Regenerating `EventEntry` also changed nested EventEntry definitions inside avatar import and avatar overrides schemas; leaving them unstaged made `npm run check:contracts` fail.
- **Fix:** Included the regenerated nested schema mirrors with the task output.
- **Files modified:** `packages/contracts/generated/json-schema/avatar-import-plan.schema.json`, `packages/contracts/generated/json-schema/avatar-overrides.schema.json`
- **Verification:** `npm run check:contracts`
- **Committed in:** `d114d7e`

---

**Total deviations:** 2 auto-fixed blocking issues.
**Impact on plan:** Both fixes were required for the generated mirror contract to satisfy the plan and for the global drift guard to pass.

## Issues Encountered

- A parallel 07-04 docs commit initially picked up the staged 07-02 generated files before the 07-02 task commit command ran. A later 07-04 correction removed those unrelated mirror changes from HEAD, so I re-staged and committed the generated contract mirrors correctly as `d114d7e`.

## Known Stubs

None. Stub-pattern scan hits in generated schemas were intentional `is_placeholder` schema fields, not placeholder implementation stubs.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm run check:contracts` -> passed.
- Acceptance marker checks passed for `export type Dispatch`, `dispatches: Dispatch[]`, `hotkey_id: string`, `duration_is_fallback: boolean`, and dispatch schema `discriminator`.
- `Test-Path packages/contracts/ts/action-intent.ts` -> False.
- `Test-Path packages/contracts/generated/json-schema/action-intent.schema.json` -> False.
- `rg "ActionIntent" packages/contracts/ts packages/contracts/generated/json-schema` -> no matches.

## Next Phase Readiness

Parser/runtime plans can import the generated `Dispatch` union and rely on audio payload mirrors carrying `dispatches: Dispatch[]`. Event dispatch plans can consume `hotkey_id` and `duration_is_fallback` in generated mirrors.

## Self-Check: PASSED

Verified summary and generated mirror files exist, obsolete generated ActionIntent files are absent, and commit `d114d7e` is present in git history.

---
*Phase: 07-three-category-code-parsing-dispatch*
*Completed: 2026-05-09*
