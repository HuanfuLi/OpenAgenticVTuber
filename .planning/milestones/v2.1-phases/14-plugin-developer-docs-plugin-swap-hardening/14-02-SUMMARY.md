---
phase: 14-plugin-developer-docs-plugin-swap-hardening
plan: 14-02
subsystem: plugins-ui-status
tags: [plugins, settings, status, electron, sidecar, fallback]
requires:
  - phase: 14-plugin-developer-docs-plugin-swap-hardening
    provides: sample plugin and plugin documentation from 14-01
provides:
  - Plugin runtime status endpoint
  - Settings invalid-manifest display and selected-plugin restart flow
  - Status popover plugin health row
  - Tests for fallback/null and invalid-plugin reporting
affects: [settings, status, electron-main, sidecar]
tech-stack:
  added: []
  patterns:
    - Plugin health is reported separately from global chat/sidecar health
    - Broken selected plugins preserve config and degrade to NullPlugin
key-files:
  created:
    - sidecar/src/sidecar/admin/plugin.py
    - sidecar/tests/admin/test_plugin_status_endpoint.py
  modified:
    - apps/electron-main/src/sidecar.ts
    - apps/electron-main/src/ipc.ts
    - apps/electron-main/preload/index.ts
    - apps/renderer/src/state/status-types.ts
    - apps/renderer/src/state/app-store.tsx
    - apps/renderer/src/chrome/StatusIcon.tsx
    - apps/renderer/src/screens/Settings/Settings.tsx
    - sidecar/src/sidecar/plugins/loader.py
    - sidecar/src/sidecar/plugins/supervisor.py
    - sidecar/src/sidecar/ws/server.py
key-decisions:
  - "Plugin failure is a plugin-health degradation, not a chat-health failure."
  - "Invalid selected plugins keep the selected config and run fallback/null motion instead of reverting silently."
patterns-established:
  - "Renderer status rows can carry domain-specific health without changing worst-of global app status."
requirements-completed: [PLUGDOC-03, PLUGDOC-04, PLUGDOC-05]
duration: 45min
completed: 2026-05-09
---

# Phase 14 Plan 14-02: Plugin Listing, Swap, Restart, And Health Hardening Summary

**Plugin swapping now restarts the sidecar, preserves broken selections, and surfaces runtime fallback health in Settings and Status**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-09T09:31:00-04:00
- **Completed:** 2026-05-09T09:34:00-04:00
- **Tasks:** 6
- **Files modified:** 18

## Accomplishments

- Added `/admin/plugin/status` and `PluginSupervisor.runtime_status()` for selected, loaded, fallback, lifecycle, and developer-detail reporting.
- Hardened Settings plugin listing so invalid manifests remain visible and selectable with warning/details.
- Wired plugin health into preload, app state, Settings, and the Status popover while keeping chat availability independent.
- Confirmed config save still restarts the sidecar, and plugin changes mark `restart pending` immediately in renderer state.

## Task Commits

1. **Plugin status, invalid listing, restart/status UI, and tests** - `d0d4f7c` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/admin/plugin.py` - Runtime plugin status endpoint.
- `sidecar/src/sidecar/plugins/supervisor.py` - Lifecycle/fallback/circuit-open status reporting.
- `apps/electron-main/src/sidecar.ts` - Valid/invalid plugin catalog entries.
- `apps/electron-main/src/ipc.ts` and `preload/index.ts` - Plugin status bridge.
- `apps/renderer/src/screens/Settings/Settings.tsx` - Invalid plugin warnings and runtime health display.
- `apps/renderer/src/chrome/StatusIcon.tsx` - Plugin health row and developer details.

## Decisions Made

- Treated plugin health as its own row so broken motion does not imply chat is unavailable.
- Kept invalid manifests selectable so developers can preserve intended config while fixing the plugin.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Renderer typecheck surfaced the dev mock `StatusSnapshot` missing plugin fields; updated the mock to match the new status contract.

## Verification

- `cd sidecar; uv run pytest tests/plugins/test_plugin_sdk.py tests/plugins/test_sample_plugin.py tests/plugins/test_default_plugin.py tests/plugins/test_manifest_loader.py tests/plugins/test_supervisor.py tests/admin/test_plugin_status_endpoint.py -q` - 33 passed.
- `npm run typecheck:renderer` - passed.
- `npm --workspace apps/renderer run test -- --run Settings StatusIcon` - 26 passed.
- `npm --workspace apps/electron-main run build` - passed.
- `git diff --check` - passed with CRLF normalization warnings only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 14 is implemented and ready for human UAT: sample plugin selection/restart, broken plugin fallback, selected config preservation, and chat availability while plugin motion is degraded.

---
*Phase: 14-plugin-developer-docs-plugin-swap-hardening*
*Completed: 2026-05-09*
