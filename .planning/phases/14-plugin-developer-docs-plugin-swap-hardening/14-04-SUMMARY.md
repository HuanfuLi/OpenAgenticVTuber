---
phase: 14-plugin-developer-docs-plugin-swap-hardening
plan: 14-04
subsystem: renderer-websocket-chat
tags: [renderer, websocket, chat, sidecar, restart, gap-closure]
requires:
  - phase: 14-plugin-developer-docs-plugin-swap-hardening
    provides: Phase 14 restart-adjacent UAT gap diagnosis
provides:
  - Sidecar-ready URL switching in renderer WebSocket client
  - Stale reconnect prevention after sidecar restart
  - Streaming chat transient-state reset on sidecar reconnect
  - Regression coverage for restart reconnect behavior
affects: [renderer, chat, websocket]
tech-stack:
  added: []
  patterns:
    - WebSocket reconnects use a generation token to ignore stale socket handlers after URL replacement
key-files:
  created:
    - apps/renderer/tests/ws-client-restart.test.ts
  modified:
    - apps/renderer/src/ws/client.ts
    - apps/renderer/src/ws/store.ts
    - apps/renderer/tests/Chat.test.tsx
key-decisions:
  - "The WS client subscribes once to sidecar:ready and treats a changed URL as a replacement sidecar instance."
  - "Sidecar replacement emits a reconnect event only after the new socket opens, so chat resets transient turn state at the correct time."
patterns-established:
  - "Renderer sidecar restart handling must cancel stale reconnect timers and ignore stale socket close/message handlers."
requirements-completed: []
duration: 10min
completed: 2026-05-09
---

# Phase 14 Plan 14-04: Reconnect Chat WebSocket After Sidecar Restart Summary

**Renderer WebSocket restart handling for chat input re-enable**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-09T10:36:00-04:00
- **Completed:** 2026-05-09T10:41:00-04:00
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Updated the renderer WebSocket singleton to subscribe to every `sidecar:ready` event and switch to a new URL after sidecar restart.
- Added a generation token and reconnect timer cleanup so stale sockets cannot reconnect to old sidecar URLs.
- Added a sidecar reconnect event that fires when a replacement socket opens.
- Reset streaming chat transient state on sidecar reconnect so stale input-disabled/speaking/pending-turn state does not survive a sidecar restart.
- Added regression tests for URL switching, stale reconnect prevention, reconnect event timing, and chat input re-enable behavior.

## Task Commits

1. **Renderer restart reconnect fix** - `3b384cf` (fix)

## Files Created/Modified

- `apps/renderer/src/ws/client.ts` - Added sidecar-ready subscription, URL replacement, generation guard, and reconnect event subscription.
- `apps/renderer/src/ws/store.ts` - Resets streaming chat state after a replacement sidecar socket opens.
- `apps/renderer/tests/ws-client-restart.test.ts` - Covers restart URL switching and stale reconnect suppression.
- `apps/renderer/tests/Chat.test.tsx` - Covers input re-enable after reconnect clears transient streaming state.

## Decisions Made

- Kept restart-specific chat reset outside the low-level WS client by exposing a reconnect event consumed by `ws/store.ts`.
- Fired the reconnect event only after the new socket opens, avoiding premature reset while the sidecar is still starting.
- Preserved the existing fixed-backoff reconnect behavior for transient disconnects on the same URL.

## Deviations from Plan

Added a dedicated `ws-client-restart.test.ts` instead of putting all restart coverage in `Chat.test.tsx`, because direct client tests are cleaner for stale socket/timer behavior.

## Issues Encountered

None.

## Verification

- `npm run typecheck:renderer` - passed.
- `npm --workspace apps/renderer run test -- --run Chat Settings StatusIcon ws-client-restart` - 35 passed.
- `git diff --check` - passed with CRLF normalization warnings only.

## User Setup Required

Manual UAT still required: switch plugins a few times, wait for sidecar restart to settle, and confirm the chat input re-enables without a full app restart.

## Next Phase Readiness

Ready for `$gsd-verify-work 14` recheck focused on chat input behavior after plugin-switch sidecar restarts.

---
*Phase: 14-plugin-developer-docs-plugin-swap-hardening*
*Completed: 2026-05-09*
