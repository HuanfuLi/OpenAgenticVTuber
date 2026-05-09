---
phase: 15-mock-boundary-audit
researched: 2026-05-09T11:40:00-04:00
status: complete
context: skipped by user choice; planned from roadmap, requirements, and code inspection
---

# Phase 15 Research: Mock Boundary Audit

## Research Goal

Identify remaining dev mocks, scripted fixtures, and alert-only actions that still leak into normal user flows after Phases 11-14, then shape Phase 15 as a focused cleanup with regression coverage.

## Current Mock Boundary Shape

Dev mocks are centralized in `apps/renderer/src/dev/__mocks__/mock-backend.ts`:

- `mockSafeStorage`
- `mockStatus`
- `mockBanners`
- `mockToasts`
- `SCRIPTED_CONVO`
- `PLACEHOLDER_THREADS`
- `startSidecarLogs`

`DevPanel` is correctly mounted only behind `import.meta.env.DEV` in `apps/renderer/src/App.tsx`. Its mock controls are acceptable only if they stay self-contained or route through explicit development store actions. Production store code should not subscribe to `mockStatus`, `mockBanners`, or `mockToasts`.

## Confirmed Production-Flow Leaks

### App Store Still Imports Dev Mocks

`apps/renderer/src/state/app-store.tsx` imports `mockBanners`, `mockToasts`, and their types from the dev mock module. Because `AppStoreProvider` wraps normal app chrome, this means production user flows still subscribe to mock banner/toast state even though status now comes from real APIs.

This is the largest boundary violation for `MOCK-01` and `MOCK-02`.

Recommended fix:

- Move `Banners`, `Toast`, and app-owned banner/toast state into production store code or a small production `chrome-events` module.
- Let `DevPanel` call production store actions through `useStore()` for design-review forcing instead of importing mock banners/toasts/status into the store.
- Keep `mockBanners`/`mockToasts` only if they are strictly local to the dev panel, or delete them if no longer needed.
- Either replace the `mockStatus` status cycler with an explicit dev-only store patch action, or remove that dead design-review control when the production store stops subscribing to `mockStatus`.

### Chat Still Imports Scripted Fixture and Mock Banner Mutators

`apps/renderer/src/screens/Chat/Chat.tsx` imports `mockBanners` and `SCRIPTED_CONVO` from the dev mock module. It listens for `chat:inject`, writes scripted messages into `chatMessages`, merges those messages with real persisted history, and uses `mockBanners.set(...)` from normal banner buttons.

This violates `MOCK-01` because scripted conversation fixtures are reachable from normal Chat code, and it risks confusing Phase 13 history semantics because `chatMessages` remains a second transcript source.

Recommended fix:

- Remove `SCRIPTED_CONVO`, `chat:inject`, `chatMessages`, and `setChatMessages` from normal Chat rendering.
- If scripted demo injection is still useful, keep it entirely inside a development-only surface that does not mutate the production chat transcript state.
- Replace banner button mock mutations with real actions or truthful disabled buttons:
  - LLM retry should call `refreshStatus()`.
  - VTS auth should call `restartSidecar()` or a VTS re-auth path if available.
  - Sidecar restart should call `restartSidecar()`.

### Mock Alert Actions Remain in Normal UI

Current matches:

- `apps/renderer/src/screens/Chat/Chat.tsx`
  - VTube Studio docs button: `alert('(mock) Would open: VTube Studio docs')`
- `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx`
  - setup help link: `alert('(mock) Would open: setup help docs')`
- `apps/renderer/src/chrome/LogsDrawer.tsx`
  - open log folder: `alert('(mock) Would open: ~/Library/Logs/AgenticLLMVTuber')`
- `apps/renderer/src/screens/Settings/Settings.tsx`
  - diagnostics open log folder duplicates the same mock alert

Recommended fix:

- Add preload/main IPC for real external actions:
  - `openExternalUrl(url)` or narrower `openVtsDocs()` / `openSetupHelp()`.
  - `openLogFolder()` using Electron `shell.openPath(app.getPath('logs'))` or a project-specific log directory if one is already established.
- Prefer narrow APIs over arbitrary URL/path opening if feasible.
- If a real target is not ready, disable the control with truthful copy instead of leaving a mock alert.

## Tests and Guards Available

Renderer tests already cover the affected surfaces:

- `apps/renderer/tests/Chat.test.tsx`
- `apps/renderer/tests/Settings.test.tsx`
- `apps/renderer/tests/logs-drawer-intent.test.tsx`
- `apps/renderer/tests/AppStoreStatus.test.tsx`
- `apps/renderer/tests/StatusIcon.test.tsx`

There is no top-level `tests/` directory; sidecar tests live under `sidecar/tests/`, and renderer tests live under `apps/renderer/tests/`.

Recommended new coverage:

- A static boundary test or script that fails if non-dev renderer source imports from `@/dev/__mocks__` or references named dev mocks.
- A static guard that fails on `alert('(mock)` and `Would open` under normal source.
- Chat tests proving no scripted conversation content appears in normal chat, and Retry/Restart buttons call real store actions.
- Settings/LogsDrawer tests proving Open log folder uses `window.api.openLogFolder`.
- Electron-main/preload typecheck/build proving new IPC APIs are typed.

## Planning Recommendation

Use one Phase 15 plan.

The phase is an audit-plus-cleanup pass, not a new product feature. One plan should touch the renderer store, Chat, log/help actions, preload/main IPC, and focused tests together so mock-boundary assertions land in the same change that removes the current violations.

## Verification Commands

Recommended automated checks:

```powershell
npm --workspace apps/renderer run test -- --run Chat Settings logs-drawer-intent AppStoreStatus StatusIcon
npm --workspace apps/renderer run typecheck
npm --workspace apps/electron-main run build
```

Recommended static checks after cleanup:

```powershell
rg -n "@/dev/__mocks__|mockStatus|mockBanners|mockToasts|mockSafeStorage|SCRIPTED_CONVO|PLACEHOLDER_THREADS|startSidecarLogs" apps/renderer/src -g "!dev/**"
rg -n "alert\('\(mock\)|Would open" apps/renderer/src apps/electron-main/src apps/electron-main/preload
```

Expected result: no matches outside `apps/renderer/src/dev/**`, tests, or explicit documentation.

## Risks

| Risk | Mitigation |
|------|------------|
| DevPanel loses useful design-review toggles | Keep dev-only controls, but route them through production store actions instead of production store importing mocks. |
| Removing `chatMessages` breaks tests that rely on local echo | Preserve live chat behavior through `appendUserMessage`, persisted conversation history, and WS messages; update tests to assert those real sources. |
| Opening arbitrary external URLs expands preload surface too much | Prefer narrow preload methods for known docs/log actions. |
| Static grep tests are too broad and catch test mocks | Scope guards to production source or allow explicit `src/dev/**` and `tests/**` exceptions. |
| Log folder path differs by OS | Use Electron `app.getPath('logs')` or a centralized resolver; tests can assert IPC invocation rather than OS-specific path text. |

## Open Questions

None requiring user input. The roadmap and requirements are specific enough, and user selected planning without `CONTEXT.md`.

## RESEARCH COMPLETE
