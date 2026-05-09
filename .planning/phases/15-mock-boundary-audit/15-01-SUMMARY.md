---
phase: 15-mock-boundary-audit
plan: 15-01
subsystem: renderer-mock-boundaries
tags:
  - renderer
  - electron
  - tests
  - mock-boundary
requires:
  - 15-01-PLAN.md
provides:
  - production mock-boundary guard
  - real docs/log shell actions
  - Chat without scripted fixture injection
affects:
  - apps/renderer/src/state/app-store.tsx
  - apps/renderer/src/screens/Chat/Chat.tsx
  - apps/electron-main/src/ipc.ts
key-files:
  created:
    - apps/renderer/tests/mock-boundary.test.ts
    - apps/renderer/tests/LLMSetup.test.tsx
    - .planning/phases/15-mock-boundary-audit/15-UAT.md
  modified:
    - apps/renderer/src/state/app-store.tsx
    - apps/renderer/src/dev/DevPanel.tsx
    - apps/renderer/src/screens/Chat/Chat.tsx
    - apps/renderer/src/chrome/LogsDrawer.tsx
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/src/screens/LLMSetup/LLMSetup.tsx
    - apps/electron-main/preload/index.ts
    - apps/electron-main/src/ipc.ts
  deleted:
    - apps/renderer/src/dev/__mocks__/mock-backend.ts
key-decisions:
  - Obsolete dev mock backend deleted after normal production and DevPanel flows stopped importing it.
  - Docs/log opening uses narrow preload methods instead of arbitrary renderer shell access.
requirements-completed:
  - MOCK-01
  - MOCK-02
  - MOCK-03
  - MOCK-04
duration: 7 min
completed: 2026-05-09
---

# Phase 15 Plan 01: Audit and Enforce Mock Boundaries Summary

Phase 15 removed the remaining normal-flow dependencies on dev mocks and added static and behavioral tests to keep them out.

## Execution

| Task | Commit | Result |
|------|--------|--------|
| Add mock-boundary guard | `b0556eb` | Added RED Vitest guard for dev mock imports, named mock APIs, scripted fixtures, and mock alert copy in production renderer source. |
| Enforce production boundary | `2e60a27` | Moved banner/toast state into the production app store, removed scripted Chat injection, deleted the obsolete dev mock backend, and added real Electron docs/log actions. |

## What Changed

- `AppStoreProvider` no longer subscribes to `mockBanners` or `mockToasts`; banners/toasts are production-owned state.
- `Chat` renders persisted history plus live streaming messages only; `SCRIPTED_CONVO`, `chat:inject`, and local `chatMessages` are gone.
- `DevPanel` still has design-review controls, but they route through production store actions and no longer depend on mock observables.
- `LogsDrawer`, Settings Diagnostics, LLM setup help, and Chat VTS docs use narrow preload methods:
  - `openLogFolder()`
  - `openSetupHelp()`
  - `openVtsDocs()`
- `apps/renderer/src/dev/__mocks__/mock-backend.ts` was deleted because it had no remaining legitimate consumers.

## Verification

```powershell
npm --workspace apps/renderer run test -- --run mock-boundary.test.ts Chat.test.tsx Settings.test.tsx logs-drawer-intent.test.tsx LLMSetup.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx
```

Result: 7 files passed, 49 tests passed.

```powershell
npm --workspace apps/renderer run typecheck
```

Result: passed.

```powershell
npm --workspace apps/electron-main run build
```

Result: passed.

```powershell
rg -n "@/dev/__mocks__|mockStatus|mockBanners|mockToasts|mockSafeStorage|SCRIPTED_CONVO|PLACEHOLDER_THREADS|startSidecarLogs" apps/renderer/src -g "!dev/**"
rg -n "alert\('\(mock\)|Would open" apps/renderer/src apps/electron-main/src apps/electron-main/preload
```

Result: both returned no matches.

## Deviations from Plan

**[Rule 2 - Missing critical cleanup] Deleted the obsolete dev mock backend**  
Found during: Task 6 final grep.  
Issue: after normal production code stopped importing the dev mock backend, the prescribed `rg` command still matched the dev mock module itself on Windows because the `!dev/**` glob did not exclude `apps/renderer/src/dev/**`.  
Fix: deleted `apps/renderer/src/dev/__mocks__/mock-backend.ts`; DevPanel already had replacement store-backed controls.  
Files modified: `apps/renderer/src/dev/__mocks__/mock-backend.ts`.  
Verification: final mock-boundary test and both `rg` guards passed.  
Commit hash: `2e60a27`.

**Total deviations:** 1 auto-fixed.  
**Impact:** positive; the stale mock surface is gone instead of merely isolated.

## Issues Encountered

None.

## Self-Check: PASSED

- All four Phase 15 requirements are covered.
- All plan verification commands passed.
- No production renderer source imports or references the named dev mock APIs.
- No mock alert copy remains in renderer/main/preload source.
- Summary and UAT artifacts were created.
