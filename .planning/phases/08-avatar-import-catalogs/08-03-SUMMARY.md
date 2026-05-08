---
phase: 08-avatar-import-catalogs
plan: 03
subsystem: ui
tags: [react, renderer, avatar-import, vitest, ipc]

requires:
  - phase: 08-avatar-import-catalogs
    provides: "08-01/08-02 contracts, sidecar import endpoints, and preload API bridge"
provides:
  - "Dedicated avatar-import renderer route wired through AppShell and Settings"
  - "Single-page avatar import review screen with variant/event catalog editors"
  - "Placeholder-name save gate and inline variant-code validation"
  - "Vitest coverage for placeholder gate, save-disabled UX, Cubism 5.3 reject, row delete, and reserved names"
affects: [phase-06-plugin-runtime, phase-07-code-dispatch, phase-09-slider-hud]

tech-stack:
  added: []
  patterns:
    - "Renderer route branches continue to flow through AppStore view state"
    - "Avatar import UI stores user-visible strings in COPY.AVATAR_IMPORT"
    - "Review route uses test-only _testInitialPlan injection for DOM tests"

key-files:
  created:
    - apps/renderer/src/screens/AvatarImport/AvatarImport.tsx
    - apps/renderer/src/screens/AvatarImport/VariantTable.tsx
    - apps/renderer/src/screens/AvatarImport/EventTable.tsx
    - apps/renderer/src/screens/AvatarImport/usePlaceholderGate.ts
    - apps/renderer/src/screens/AvatarImport/AvatarImport.module.css
    - apps/renderer/tests/AvatarImport.test.tsx
  modified:
    - apps/renderer/src/state/route-store.ts
    - apps/renderer/src/state/app-store.tsx
    - apps/renderer/src/chrome/AppShell.tsx
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/src/lib/copy.ts

key-decisions:
  - "AvatarImport tests live under apps/renderer/tests because the current Vitest include pattern does not discover src/**/__tests__."
  - "Settings uses the existing useStore().setView path instead of adding a second route-store dependency."
  - "Structured commit endpoint errors are normalized before rendering so jsonschema failures appear inline."

patterns-established:
  - "Variant validation is shared via getVariantCodeErrors so table rendering and Save gating use identical rules."
  - "Re-import badges are derived by stable hotkey_id comparisons against existing_overrides."

requirements-completed: [IMP-07]

duration: 7min
completed: 2026-05-08
---

# Phase 08 Plan 03: Avatar Import Review Route Summary

**Dedicated React avatar-import route with single-page catalog review, placeholder save gate, Settings entrypoint, and IPC-backed save flow**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-08T08:50:04Z
- **Completed:** 2026-05-08T08:57:17Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Wired `'avatar-import'` through `Route`, `View`, AppShell rendering, and Settings "Edit avatar catalogs".
- Built the review route: folder picker landing, detected-type header, Variants table, Events table, warnings, sticky footer, Save/Cancel, unsupported Cubism 5.3/no-model3 rejection screens.
- Implemented variant placeholder gating for `^exp_?\d+$` only, plus slug/reserved/duplicate validation that disables Save.
- Added row delete, source-name display, `{code}` preview, NEW/edited badges, and `window.api.commitAvatarOverrides({ ...plan, variants, events })` redirect-to-chat save flow.
- Added 9 Vitest cases covering placeholder logic, Save disabled/enabled UX, Cubism 5.3 rejection, delete-row behavior, and reserved-name errors.

## Task Commits

1. **Task 1: Route plumbing** - `f2396ee` (feat)
2. **Task 2 RED: Avatar import review tests** - `079d43c` (test)
3. **Task 2 GREEN: Hook, tables, review route behavior** - `d5364d6` (feat)
4. **Task 3: Save-flow hardening** - `8714212` (fix)

## Files Created/Modified

- `apps/renderer/src/screens/AvatarImport/AvatarImport.tsx` - Dedicated route, IPC folder-pick/import/save flow, unsupported-rig handling, re-import badges.
- `apps/renderer/src/screens/AvatarImport/VariantTable.tsx` - Variant editor with code input, source display, preview, delete control, validation, and badges.
- `apps/renderer/src/screens/AvatarImport/EventTable.tsx` - Event editor with code input, source motion file, preview, delete control, and empty state.
- `apps/renderer/src/screens/AvatarImport/usePlaceholderGate.ts` - Placeholder save-gate logic for `^exp_?\d+$`.
- `apps/renderer/src/screens/AvatarImport/AvatarImport.module.css` - Route/table/footer/badge styling.
- `apps/renderer/tests/AvatarImport.test.tsx` - Focused DOM and placeholder-gate coverage.
- `apps/renderer/src/chrome/AppShell.tsx` - AvatarImport render branch.
- `apps/renderer/src/screens/Settings/Settings.tsx` - Settings entrypoint.
- `apps/renderer/src/lib/copy.ts` - `COPY.AVATAR_IMPORT` strings and Settings avatar catalog copy.
- `apps/renderer/src/state/route-store.ts` - Route union extension.
- `apps/renderer/src/state/app-store.tsx` - View union extension.

## Decisions Made

- Placed tests in `apps/renderer/tests` because `apps/renderer/vite.config.ts` only includes `tests/**/*.test.{ts,tsx}`.
- Used `useStore().setView('avatar-import')` in Settings to match the AppShell state surface already in use.
- Kept user-visible route copy in `COPY.AVATAR_IMPORT`, including unsupported Cubism 5.3 and no-model3 messages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a temporary AvatarImport route stub during Task 1**
- **Found during:** Task 1
- **Issue:** AppShell needed to import `<AvatarImport />` before the full route existed, and Task 1 required `npx tsc --noEmit` to pass.
- **Fix:** Added a minimal route component in Task 1, then replaced it with the full implementation in Task 2/3.
- **Files modified:** `apps/renderer/src/screens/AvatarImport/AvatarImport.tsx`
- **Verification:** `cd apps/renderer && npx tsc --noEmit`
- **Committed in:** `f2396ee`, superseded by `d5364d6`

**2. [Rule 3 - Blocking] Moved planned test location to configured Vitest test tree**
- **Found during:** Task 2
- **Issue:** The plan named `src/screens/AvatarImport/__tests__/AvatarImport.test.tsx`, but the current Vitest config would not discover that path.
- **Fix:** Created `apps/renderer/tests/AvatarImport.test.tsx` so `npm test -- --run AvatarImport` executes the coverage.
- **Files modified:** `apps/renderer/tests/AvatarImport.test.tsx`
- **Verification:** `cd apps/renderer && npm test -- --run AvatarImport`
- **Committed in:** `079d43c`, `d5364d6`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both kept the requested verification meaningful; no product-scope expansion.

## Issues Encountered

- The non-interactive executor did not run the native-dialog dogfood smoke on `Live2D/重音テト/`, did not verify an atomic `_avatar_overrides.yaml` write through the actual UI, and did not delete milestone-1 Teto YAML files. This remains the manual Phase 8 exit gate.
- Cubism 5.3 reject UX was verified by synthetic renderer test data, not by an operator-selected moc3 header-version-6 fixture.
- Re-import badges are rendered and derived from `existing_overrides` by `hotkey_id`; operator visual verification with a real `_avatar_overrides.yaml` is still needed.

## Verification

- `cd apps/renderer && npm test -- --run AvatarImport` - PASS, 9 tests.
- `cd apps/renderer && npx tsc --noEmit` - PASS.

## Known Stubs

None in the AvatarImport implementation. `_testInitialPlan` is test-only injection and is not used by production flow.

## User Setup Required

Manual dogfood verification remains:

- Run the Electron app.
- Navigate Settings -> "Edit avatar catalogs".
- Choose `Live2D/重音テト/`.
- Rename placeholders, delete irrelevant rows, Save, and confirm `_avatar_overrides.yaml` is written.

## Next Phase Readiness

The renderer surface now consumes `AvatarImportPlan`, `VariantEntry`, `EventEntry`, and `AvatarOverrides` contracts from 08-01/08-02. Phase 6 can rely on the contracts and UI review path existing, while Phase 7 still owns runtime dispatch of `{variant}` and `<event>` codes.

## Self-Check: PASSED

- Created files verified present: AvatarImport route, VariantTable, EventTable, usePlaceholderGate, CSS module, AvatarImport tests, and this summary.
- Commits verified present: `f2396ee`, `079d43c`, `d5364d6`, `8714212`.

---
*Phase: 08-avatar-import-catalogs*
*Completed: 2026-05-08*
