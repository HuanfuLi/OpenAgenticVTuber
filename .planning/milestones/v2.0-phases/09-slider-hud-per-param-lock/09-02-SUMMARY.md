---
phase: 09-slider-hud-per-param-lock
plan: 02
subsystem: renderer-hud
tags: [electron, react, websocket, hud, vitest, fastapi]

requires:
  - phase: 09-slider-hud-per-param-lock
    provides: Plan 09-01 sidecar /hud/ws, 15 Hz HudTap, lock_state merge, and rig capabilities metadata
  - phase: 08-avatar-import-catalogs
    provides: RigCapabilities payload with writable params, ranges, and cdi3 display names
provides:
  - Dedicated Electron HUD BrowserWindow opened from Settings via ipc:hud:open
  - Hash-routed renderer HUD at #/hud without AppShell chrome
  - Scrollable slider row UI backed by /admin/rig-capabilities and /hud/ws
  - Optimistic drag-to-lock and explicit toggle-to-unlock flow with reconnect replay
  - Live UAT approval after HUD row filtering and stream liveness fixes
affects: [09-slider-hud-per-param-lock, renderer-hud, phase-10-verification]

tech-stack:
  added: []
  patterns:
    - Electron multi-BrowserWindow factory with renderer hash routing and before-quit cleanup
    - Renderer HUD route branch outside AppShell using window.location.hash
    - WebSocket hook with 1.5s reconnect, buffered set-lock replay, and sidecar-confirmed locked_ids

key-files:
  created:
    - apps/electron-main/src/hud-window.ts
    - apps/renderer/src/screens/HUD/HUD.tsx
    - apps/renderer/src/screens/HUD/HudHeader.tsx
    - apps/renderer/src/screens/HUD/HudFilterChips.tsx
    - apps/renderer/src/screens/HUD/HudParamRow.tsx
    - apps/renderer/src/screens/HUD/HudFooterStatus.tsx
    - apps/renderer/src/screens/HUD/HudErrorState.tsx
    - apps/renderer/src/screens/HUD/HudEmptyState.tsx
    - apps/renderer/src/screens/HUD/HudLoadingState.tsx
    - apps/renderer/src/screens/HUD/useHudStream.ts
    - apps/renderer/tests/HUD.test.tsx
    - apps/renderer/tests/HudParamRow.test.tsx
  modified:
    - apps/electron-main/src/index.ts
    - apps/electron-main/src/ipc.ts
    - apps/electron-main/preload/index.ts
    - apps/electron-main/preload/index.d.ts
    - apps/renderer/src/App.tsx
    - apps/renderer/src/index.css
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/src/lib/icons.tsx
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/tests/Settings.test.tsx
    - sidecar/src/sidecar/admin/rig_capabilities.py
    - sidecar/src/sidecar/avatar/rig_capabilities.py
    - sidecar/src/sidecar/compositor/compositor.py
    - sidecar/src/sidecar/compositor/lock_filter.py
    - sidecar/src/sidecar/ws/hud_handlers.py

key-decisions:
  - "The HUD route is hash-routed at #/hud and intentionally bypasses AppShell so the secondary window has no main chrome."
  - "The HUD displays the sidecar-provided hud_visible_param_ids subset instead of every writable RigCapabilities row, keeping the operator surface to real VTS input params."
  - "The HUD stream is independent of VTS writer availability so operator discovery and lock telemetry do not go dead when VTS is not actively writable."

patterns-established:
  - "HudRoot composes header, filters, param rows, footer status, connection banner, and toast handling around useHudStream."
  - "HudParamRow owns transient drag state while locked_ids from the sidecar remains the durable source of truth."
  - "Settings exposes the HUD as an always-available operator tool below the body motion plugin selector."

requirements-completed: [HUD-03, HUD-04]

duration: 62min
completed: 2026-05-09
---

# Phase 09 Plan 02: Renderer Slider HUD Summary

**Electron-hosted slider HUD with rig-derived visible params, optimistic per-param locks, reconnect replay, and approved live operator UAT**

## Performance

- **Duration:** 62 min including checkpoint fixes and re-verification
- **Started:** 2026-05-09T04:49:15Z
- **Completed:** 2026-05-09T05:51:34Z
- **Tasks:** 5
- **Files modified:** 27

## Accomplishments

- Added `createHudWindow()`, `closeHudWindow()`, `ipc:hud:open`, preload `openHud()`, and before-quit HUD cleanup.
- Added the `#/hud` renderer branch so the HUD mounts as `<HudRoot>` without the main app shell.
- Built the HUD component tree: header, filter chips, scrollable param rows, native range sliders, lock toggles, footer counts, warning/error/empty/loading states, and toast handling.
- Added `useHudStream` for `/hud/ws` frames, optimistic `set-lock`, explicit `clear-lock`, reconnect, and buffered intent replay.
- Added Settings "Open HUD" entry point and tests for the button/helper/click behavior.
- Completed Task 5 live UAT after fixes; user replied `pass`.

## Component Tree And File Inventory

- `apps/electron-main/src/hud-window.ts` - single-instance secondary BrowserWindow sized 420x640, routed to `#/hud`, no always-on-top and no persisted placement.
- `apps/renderer/src/App.tsx` - top-level hash route guard that renders `HudRoot` without `GatedShell`.
- `apps/renderer/src/screens/HUD/HUD.tsx` - orchestrates capability fetch, filters, rows, footer, warning banner, and avatar-changed toast.
- `apps/renderer/src/screens/HUD/useHudStream.ts` - owns `/hud/ws`, param frames, locked IDs, reconnect timer, and outbound lock messages.
- `apps/renderer/src/screens/HUD/HudParamRow.tsx` - displays name, value, slider, and lock/unlock switch with local drag state.
- `apps/renderer/src/screens/Settings/Settings.tsx` - adds the always-visible Open HUD button below the body motion plugin selector.
- `apps/renderer/src/lib/copy.ts`, `apps/renderer/src/lib/icons.tsx`, and `apps/renderer/src/index.css` - HUD copy, Lock/Unlock icons, and hand-rolled route styling.

## useHudStream Contract

- Connects to `${readyUrl}/hud/ws` after `window.api.getReadyUrl()`.
- Accepts `param-frame`, `lock-confirmed`, and `lock-rejected` messages from the generated HUD contract.
- Sends `set-lock` on slider drag and `clear-lock` on lock-toggle click.
- Maintains `paramValues`, `lockedIds`, connection state, and a last-frame marker for UI filtering and footer counts.
- Reconnects every 1.5s after disconnect, re-fetches capabilities through `HudRoot`, and replays buffered `set-lock` intents when the socket reopens.
- Detects locked_ids dropping from non-empty to empty and shows `Avatar changed - locks cleared.` after avatar re-import / sidecar restart.

## Task Commits

1. **Task 1: Electron HUD window bridge** - `a27ef8f` (feat)
2. **Task 2 RED: HUD renderer tests** - `46b1b70` (test)
3. **Task 2/3 GREEN: Renderer HUD route and component tree** - `afbf83b` (feat)
4. **Task 4: Settings HUD entry point** - `02e0cc7` (feat)
5. **Checkpoint docs: initial verification pause** - `311f78a` (docs)
6. **Fix: copy/route guard alignment** - `9325228` (fix)
7. **Fix: visible slider param normalization** - `9b10f96` (fix)
8. **Checkpoint docs: re-verification pause** - `9e1e1be` (docs)
9. **Fix: HUD stream independent of VTS writer** - `460658d` (fix)

## Verification

- `cd apps/renderer && npx vitest run tests/HudParamRow.test.tsx tests/HUD.test.tsx` - passed during plan execution.
- `cd apps/renderer && npx vitest run tests/Settings.test.tsx` - passed during plan execution.
- `cd apps/renderer && npx tsc --noEmit` - passed during plan execution.
- `cd apps/electron-main && npx tsc --noEmit` - passed during plan execution.
- `npm run check:contracts` - passed during plan execution.
- Live backend smoke after `460658d`:
  - `/admin/rig-capabilities` returned 549 writable IDs, 18 `hud_visible_param_ids`, and excluded `MouthOpen` plus `ParamMouthOpenY`.
  - `/hud/ws` emitted `param-frame`.
  - Direct `set-lock` for `FaceAngleX=15` returned `lock-confirmed`.
  - Subsequent frames showed `FaceAngleX` at `15.0` and `locked_ids` containing `FaceAngleX`.

## UAT Outcome

Task 5 is **approved / PASS**. The user replied `pass` after live HUD UAT re-verification.

Observed failures and fixes before approval:

- Initial HUD row list exposed the full writable surface: 529 rows. Fixed by consuming sidecar `hud_visible_param_ids`, reducing the live operator HUD to 18 VTS input params while still leaving full CDI3/Cubism data in RigCapabilities.
- Initial live HUD stream could appear zero/dead when the compositor/VTS writer path was not producing usable frames. Fixed by making the compositor HUD tap publish non-blocking snapshots and keeping the HUD stream independent of VTS writer availability.
- FaceAngleX lock smoke passed after the fix: direct `set-lock` confirmed, the frame stream stayed live, the value held at `15.0`, and `locked_ids` reported `FaceAngleX`.

## Decisions Made

- HUD row visibility uses `hud_visible_param_ids` when present, falling back to writable minus excluded IDs only for compatibility.
- The renderer treats sidecar frames as the source of truth for locked state after optimistic drag feedback.
- The HUD WebSocket remains useful for discovery and lock telemetry even if VTS is disconnected or the writer is not actively flushing params.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned HUD route/copy with tests and runtime path**
- **Found during:** Task 5 pre-checkpoint verification
- **Issue:** The route guard and copy strings diverged from the test/runtime expectation.
- **Fix:** Adjusted `hud-window.ts`, `App.tsx`, HUD copy, and HUD tests to the settled hash-route/copy contract.
- **Files modified:** `apps/electron-main/src/hud-window.ts`, `apps/renderer/src/App.tsx`, `apps/renderer/src/lib/copy.ts`, `apps/renderer/tests/HUD.test.tsx`
- **Verification:** Renderer HUD tests passed.
- **Committed in:** `9325228`

**2. [Rule 1 - Bug] Normalized HUD-visible params to VTS input rows**
- **Found during:** Task 5 live UAT
- **Issue:** The HUD rendered the broad writable RigCapabilities set, producing 529 rows and making the live operator surface unusable.
- **Fix:** Added sidecar and renderer support for `hud_visible_param_ids`, preserving the full writable contract while rendering only meaningful HUD slider rows.
- **Files modified:** `apps/renderer/src/screens/HUD/HUD.tsx`, `apps/renderer/src/screens/HUD/HudParamRow.tsx`, `sidecar/src/sidecar/admin/rig_capabilities.py`, `sidecar/src/sidecar/avatar/rig_capabilities.py`, `sidecar/src/sidecar/compositor/lock_filter.py`, `sidecar/src/sidecar/ws/hud_handlers.py`, related tests
- **Verification:** Live smoke returned 18 `hud_visible_param_ids`; HUD tests and sidecar tests covered the filtering path.
- **Committed in:** `9b10f96`

**3. [Rule 1 - Bug] Kept HUD stream live independent of VTS writer**
- **Found during:** Task 5 re-verification
- **Issue:** The HUD stream could look dead or stuck at zero because frame publication was tied too closely to the writer/compositor flush path.
- **Fix:** Made the compositor publish non-blocking HUD snapshots on its own cadence so `/hud/ws` remains live even when VTS writer output is unavailable.
- **Files modified:** `sidecar/src/sidecar/compositor/compositor.py`, `sidecar/tests/compositor/test_hud_tap.py`
- **Verification:** Live smoke saw `/hud/ws` emit `param-frame`; `FaceAngleX=15` lock confirmed and persisted in subsequent frames.
- **Committed in:** `460658d`

---

**Total deviations:** 3 auto-fixed bugs
**Impact on plan:** All fixes were required for Task 5 correctness and live operability. No architecture change or new dependency was introduced.

## Known Stubs

None blocking this plan. Stub scan matches were existing placeholders in unrelated legacy screens/tests plus intentional test empty lists/nulls and HUD transient null state; no HUD row, stream, lock, or Settings entry-point stub prevents the plan goal.

## Issues Encountered

- The live Teto rig exposed hundreds of CDI3/Cubism writable params, but only a small subset maps to useful VTS tracking inputs for operator sliders. The sidecar now reports both full writable IDs and HUD-visible IDs.
- The HUD needed to remain a discovery/control surface when VTS writer availability is imperfect; the stream now uses non-blocking compositor snapshots.

## User Setup Required

None - Task 5 live UAT was completed and approved.

## Carry-Forward For Phase 10

- Re-run the lock-vs-LLM variant behavior during the Phase 10 verification ceremony if VTS and the configured LLM are both active.
- Include a quick HUD smoke in Phase 10: capabilities returns 18 HUD-visible rows for Teto, `/hud/ws` emits frames, and `FaceAngleX` can be locked/cleared without blocking the writer.
- The current active Teto event catalog is still empty, so event-specific UAT remains prerequisite-gated outside this HUD plan.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/09-slider-hud-per-param-lock/09-02-SUMMARY.md`.
- Commit check passed for `a27ef8f`, `46b1b70`, `afbf83b`, `02e0cc7`, `311f78a`, `9325228`, `9b10f96`, `9e1e1be`, and `460658d`.
- Summary records Task 5 approved/PASS, the 529 row to 18 `hud_visible_param_ids` fix, the non-blocking HUD stream fix, and the `FaceAngleX` lock smoke pass.

---
*Phase: 09-slider-hud-per-param-lock*
*Completed: 2026-05-09*
