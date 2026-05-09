---
phase: 11-status-app-state-reality
type: research
created: 2026-05-09
requirements:
  - STAT-01
  - STAT-02
  - STAT-03
  - STAT-04
  - STAT-05
---

# Phase 11 Research: Status & App State Reality

## Goal

Replace remaining status/app-state lies in the normal renderer path with state derived from shipped runtime systems:

- persisted setup config from Electron `safeStorage`
- sidecar lifecycle events from Electron main
- VTube Studio reachability/auth state from the sidecar
- non-secret app preferences from Electron `electron-store`

This phase is intentionally narrow. Settings content cleanup belongs to Phase 12; broad mock-boundary enforcement belongs to Phase 13.

## Current Findings

### Renderer status still depends on dev mocks

`apps/renderer/src/state/app-store.tsx` imports `mockSafeStorage`, `mockStatus`, `mockBanners`, and `mockToasts`. The Phase 11 critical issues are `mockSafeStorage` and `mockStatus`:

- setup completion is initialized from `mockSafeStorage.get('hasCompletedSetup')`
- LLM config is initialized from `mockSafeStorage.get('llmConfig')`
- logs drawer state is persisted to `mockSafeStorage`
- `status` is initialized from `mockStatus.get()` and subscribed through `mockStatus.subscribe`
- real sidecar lifecycle events are bridged into `mockStatus.set(...)`

This means normal chrome can still show `qwen2.5` and scripted reconnect state even though the setup gate already has real config persistence.

### StatusIcon mutates fake state

`apps/renderer/src/chrome/StatusIcon.tsx` imports `mockStatus`. Its "Re-test connection" button:

- sets `llm` amber with `reconnecting...`
- waits 600 ms
- sets `llm` green with `qwen2.5-7b - LM Studio - last reply 423ms`

This directly violates STAT-01 and STAT-04.

### Settings connection section repeats the same fake reconnect

`apps/renderer/src/screens/Settings/Settings.tsx` reads real persisted config via `window.api.getStoredConfig()`, but still imports `mockStatus` for the connection re-test button and writes the same hardcoded `qwen2.5` detail. Phase 12 owns broader Settings copy, but Phase 11 should remove this mock status mutation because it affects the shared status surface.

### Real setup config already exists

`apps/renderer/src/state/setup-store.ts` hydrates from `window.api.getStoredConfig()` and completes setup through `window.api.saveStoredConfig()`.

Electron main already exposes:

- `config:load`
- `config:save`
- `config:clear`

through `apps/electron-main/src/ipc.ts`, backed by `apps/electron-main/src/safe-storage.ts`.

The Phase 11 implementation should reuse this path and avoid introducing a second LLM config store.

### Non-secret app preference storage is partially present

`apps/electron-main/src/window-store.ts` already uses `electron-store` and has a `chrome` object:

- `logsDrawerEnabled`
- `logsDrawerHeight`
- `logsDrawerCollapsed`

But only `window:getState` is exposed through IPC today. `apps/renderer/src/state/theme-provider.tsx` still persists theme preferences through `mockSafeStorage`.

Phase 11 should expose narrowly scoped Electron-store IPC for chrome/theme preferences and replace `mockSafeStorage` in the normal renderer state providers.

### Sidecar readiness is already real

`apps/electron-main/src/sidecar.ts` tracks real sidecar readiness and crash state:

- `getReadyUrl()`
- `onReady(...)`
- `onCrash(...)`
- `restartSidecar()`

`apps/electron-main/preload/index.ts` exposes `getReadyUrl`, `onSidecarReady`, and `onSidecarCrash`.

The renderer should keep these events as the authority for the sidecar row. The bug is that they currently write into `mockStatus` instead of production status state.

### VTS status is not exposed yet

The sidecar has a basic `GET /health` endpoint that returns only `{status: "ok"}`. VTS writer/auth lifecycle is built during FastAPI lifespan:

- `writer = PyvtsSafeWriter()`
- `handshake_task = asyncio.create_task(connect_and_authenticate(writer))`
- successful auth logs `[VTS-HANDSHAKE] auth-success`
- handshake failures are caught and logged, and the sidecar continues

`app.state.writer` and `app.state.handshake_task` are set only on the successful construction path after the handshake block. There is no `/admin/vts-status` endpoint today.

Phase 11 should add a small admin endpoint that reports real sidecar-known VTS state without creating a second pyvts client. It can combine:

- sidecar boot state (`startup_error_message`, writer presence)
- handshake task result/exception
- Windows VTS window detection via `sidecar.vts.window_detect.find_vts_hwnd(force_reprobe=True)`

This is sufficient for truthful UI state. It should not add a second VTS writer or a second authentication client.

## Implementation Shape

1. Move production status types/helpers out of `dev/__mocks__/mock-backend.ts` into a real renderer module, for example `apps/renderer/src/state/status-types.ts`.
2. Replace app-store `mockStatus` with local production state initialized from real setup config and sidecar readiness.
3. Add a sidecar `/admin/vts-status` endpoint that reads existing sidecar state and window detection.
4. Add Electron IPC/preload wrappers for sidecar health/VTS status and sidecar restart if the status retry action remains actionable.
5. Replace `mockSafeStorage` with existing `safeStorage` for LLM config and Electron-store IPC for chrome/theme preferences.
6. Leave `mockBanners`, `mockToasts`, `SCRIPTED_CONVO`, and dev panel controls to Phase 13 unless a Phase 11 status requirement directly touches them.

## Risks

- App-store hydration is async, while the old mock store was sync. Tests should assert the default/loading row is truthful and then updates after `getStoredConfig()` resolves.
- VTS status must not create a second pyvts connection. Use existing `app.state` and window detection only.
- `config:save` currently restarts the sidecar. Do not add a retry path that silently saves config or changes provider settings.
- Settings connection cleanup should stay limited to removing fake status mutation; Phase 12 owns the rest of Settings placeholder work.

## Verification Targets

- No production import of `mockStatus` in `app-store.tsx`, `StatusIcon.tsx`, or `Settings.tsx`.
- No production import of `mockSafeStorage` in `app-store.tsx` or `theme-provider.tsx`.
- No hardcoded `qwen2.5`, scripted latency, or `last reply 423ms` in normal status code.
- Sidecar lifecycle tests still prove crash/respawn state reaches the status store.
- Sidecar admin tests prove `/admin/vts-status` reports authenticated, pending, unavailable, and no-window states without a second writer.
