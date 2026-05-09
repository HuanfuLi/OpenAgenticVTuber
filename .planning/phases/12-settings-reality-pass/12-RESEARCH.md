# Phase 12: Settings Reality Pass - Research

**Researched:** 2026-05-09
**Status:** Complete

## RESEARCH COMPLETE

## Phase Summary

Phase 12 should be implemented as one Settings-focused renderer/Electron-main plan. Phase 11 status plumbing is already present: the renderer store has `refreshStatus()`, VTS status maps through `window.api.getVtsStatus()`, Electron main exposes `sidecar:restart`, and the sidecar exposes `GET /admin/vts-status`. Phase 12 can therefore focus on replacing stale Settings placeholders and adding a few missing bridge APIs rather than building status infrastructure from scratch.

## Current Code State

### Settings Surface

- `apps/renderer/src/screens/Settings/Settings.tsx` still renders stale placeholder sections through `C.PLACEHOLDERS`.
- It has a real `ConnectionSection`, `PluginSection`, `TTSSection`, `AppearanceSection`, and partial `DiagnosticsSection`.
- `Avatar catalogs` is already a real section with a button routing to `avatar-import`, but old `Avatars` and `Per-avatar settings` placeholders still render because `PLACEHOLDERS.filter((p) => p.num < 5)` includes nums 2, 3, and 4.
- `DiagnosticsSection` has a disabled log-level select with `DIAG_LOG_LEVEL_HELP: 'Coming in milestone-2.'`.
- `DiagnosticsSection` still has a mock log-folder alert. This is adjacent to log-level work, but broad mock-action cleanup maps to Phase 13 (`MOCK-03`), so Phase 12 should not balloon unless implementation naturally adds a real open-log-folder bridge.

### Phase 11 Status Plumbing Available

- `apps/renderer/src/state/app-store.tsx` now uses real `window.api` status/storage APIs:
  - `refreshStatus()`
  - `restartSidecar()`
  - `getStoredConfig()`
  - `getReadyUrl()`
  - `getVtsStatus()`
  - `getChromeState()` / `saveChromeState()`
- `apps/renderer/src/chrome/StatusIcon.tsx` already renders live LLM/VTS/sidecar rows and refreshes via `refreshStatus()`.
- `apps/electron-main/preload/index.ts` exposes `getVtsStatus()` and `restartSidecar()`.
- `apps/electron-main/src/ipc.ts` implements `sidecar:getVtsStatus` by calling `GET /admin/vts-status`; it implements `sidecar:restart`.
- `sidecar/src/sidecar/admin/status.py` reports VTS states from `app.state.writer`, `handshake_task`, and Win32 window detection.

### Avatar Metadata Gaps

- `sidecar/src/sidecar/admin/avatar.py` already has `GET /admin/avatar/import/current?avatar_id=...`.
- Electron `window-store.ts` persists `currentAvatarId`, and `ipc.ts` writes it after `avatar:commitOverrides`.
- Renderer Settings currently cannot ask Electron main for the current avatar id or current avatar import plan in one call. Plan should add bridge methods rather than hardcoding `teto`.
- `AvatarImport.tsx` currently starts empty unless `_testInitialPlan` is provided. Editing current avatar from Settings needs either a route-level initial plan handoff or a component path that fetches current metadata on entry.

### VTS Token Reset

- `sidecar/src/sidecar/vts/pyvts_writer.py` defaults the VTS token path to `sidecar/.vts_token.txt`.
- `connect_and_authenticate()` reads/writes the token through pyvts; deleting the file and restarting the sidecar is enough to force re-auth prompt on next VTS connect.
- Implement this in Electron main as a high-level troubleshooting action:
  - delete the known token file if present
  - restart the sidecar
  - refresh status in renderer
- Do not expose token file paths in renderer.

### Log-Level Preference

- `window-store.ts` already stores chrome and theme preferences in electron-store; extend this pattern with `logLevel`.
- The user decision scopes Phase 12 logging to renderer/main-process UI logging first. That avoids sidecar loguru reconfiguration complexity.
- A small helper can gate renderer console output and main-process forwarded log verbosity, but the Settings select must be real and persisted even if the exact filtering is simple in this plan.
- Use levels `error`, `warn`, `info`, `debug` per CONTEXT D-14.

## Recommended Implementation Shape

One plan is enough:

1. Extend bridge/store contracts:
   - current avatar id/current avatar plan
   - VTS token reset/re-auth
   - log-level preference
2. Update Settings:
   - replace avatar/VTS/conversation/memory placeholders with explicit sections
   - keep plugins, TTS, appearance, diagnostics, about
   - remove `PLACEHOLDERS` entries for nums 2, 3, 4, 7, 8 from the rendered Settings flow
   - keep future sections for Voice in, Skills, Agent, Scheduler, Form factor, Hotkeys unless copy needs milestone wording correction for SET-07
3. Tests:
   - Settings tests for avatar combined section, degraded state, VTS status/troubleshooting disclosure, Conversation truth summary, Memory disabled v4.0 copy, functional log-level select, and no stale `Coming in milestone-2` in relevant sections
   - Electron main/preload tests if test harness exists; otherwise renderer tests can mock `window.api`
   - Sidecar/admin status tests already exist and should remain green

## Risks and Guardrails

- Do not implement saved conversation history in Phase 12. It is explicitly deferred in CONTEXT D-09.
- Do not implement Memory. Memory is visible but disabled and points to v4.0.
- Do not make renderer own VTS state or call pyvts. Renderer calls high-level Electron APIs only.
- Do not assume Teto when metadata is unavailable. Use `currentAvatarId` from Electron store if exposed; otherwise show unavailable/degraded copy.
- Keep Phase 13 mock-boundary cleanup separate unless a mock exists directly in the Phase 12 target surface and can be replaced cheaply.

## Verification Targets

- `npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx`
- `npm --workspace apps/renderer run typecheck`
- `python -m pytest sidecar/tests/admin/test_status_endpoint.py sidecar/tests/avatar/test_admin_avatar.py -q`

## Open Implementation Decisions for Executor

- Exact mechanism for passing current avatar plan into `AvatarImport`: route state, store field, or component auto-load mode. Any is acceptable if `Edit current` reliably opens populated current metadata.
- Whether real log folder open is included opportunistically. If included, use Electron `shell.openPath`/`app.getPath('logs')` or `userData` logs path; otherwise leave for Phase 13.

