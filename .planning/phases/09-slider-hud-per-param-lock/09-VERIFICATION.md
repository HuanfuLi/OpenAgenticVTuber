---
phase: 09-slider-hud-per-param-lock
verified: 2026-05-09T06:00:02Z
status: passed
score: 5/5 must-haves verified
---

# Phase 9: Slider HUD + Per-Param Lock Verification Report

**Phase Goal:** A user opens a separate HUD BrowserWindow from Settings, sees a rig-derived slider list excluding system-primitive params, receives 15 Hz `/hud/ws` frames, locks params via `set-lock`, clears them via `clear-lock`, and those session-only locks apply last in the compositor until explicitly cleared.
**Verified:** 2026-05-09T06:00:02Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Settings opens a separate HUD BrowserWindow routed to `#/hud`, not the main shell | ✓ VERIFIED | `apps/electron-main/src/hud-window.ts` creates a single 420x640 BrowserWindow loading `#/hud`; `ipc.ts` registers `hud:open`; `Settings.tsx` calls `window.api.openHud()`; `App.tsx` branches to `HudRoot` outside `AppShell`. |
| 2 | HUD renders a usable rig-derived slider list excluding system primitives | ✓ VERIFIED | `HUD.tsx` fetches `/admin/rig-capabilities`, uses `hud_visible_param_ids` when present and filters `hud_excluded_param_ids`; `lock_filter.py` resolver-maps `ParamMouthOpenY -> MouthOpen`; renderer and sidecar tests assert mouth rows are absent. Live smoke returned 18 Teto `hud_visible_param_ids`. |
| 3 | `/hud/ws` streams live param frames at 15 Hz only for HUD clients | ✓ VERIFIED | `server.py` exposes `/hud/ws`; `HudTap` subscribers are created on connect and removed on disconnect; `Compositor._tick` publishes when `tick_count % 4 == 0`; live smoke observed `param-frame`. |
| 4 | Slider lock and clear messages reach sidecar lock state and locks apply last | ✓ VERIFIED | `useHudStream.ts` sends `set-lock` / `clear-lock`; `hud_handlers.py` validates C2S messages, writes `app.state.lock_state`, and rejects primitive-owned params; `Compositor` receives the same dict and writes lock values after idle/speech/plugin/cursor before clamp/write. Live smoke confirmed `FaceAngleX=15` held and `locked_ids` contained `FaceAngleX`. |
| 5 | Locks are session-only and live operator UAT passed | ✓ VERIFIED | `server.py` seeds `app.state.lock_state = {}` in lifespan; no HUD persistence hooks found; tests cover plain-dict/no-persistence behavior. User replied `pass` for live UAT after the backend stream/lock fix. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/contracts/py/contracts/hud_message.py` | HUD S2C/C2S discriminated unions | ✓ VERIFIED | Five message kinds and two union exports present; package import spot-check printed `ok`. |
| `packages/contracts/ts/hud-message-s2c.ts`, `hud-message-c2s.ts` | Generated TS mirrors | ✓ VERIFIED | `HudMessageS2C` / `HudMessageC2S` exported from generated files and `packages/contracts/ts/index.ts`. |
| `sidecar/src/sidecar/compositor/lock_filter.py` | Primitive exclusion and HUD-visible helpers | ✓ VERIFIED | `SYSTEM_PRIMITIVE_OVERRIDES` remains one entry, `MouthOpen`; exclusions derive through resolver mapping; visible IDs prefer bounded VTS-input params. |
| `sidecar/src/sidecar/compositor/hud_tap.py` | Non-blocking HUD fanout | ✓ VERIFIED | Subscriber queues, unsubscribe, drop-oldest backpressure behavior implemented. |
| `sidecar/src/sidecar/compositor/compositor.py` | Locks-last merge and 15 Hz HUD publish | ✓ VERIFIED | Lock values are resolved, primitive-guarded, written to `set_acc`, then clamped; HUD publish occurs before VTS I/O at every fourth tick. |
| `sidecar/src/sidecar/admin/rig_capabilities.py` | `GET /admin/rig-capabilities` | ✓ VERIFIED | Returns active `RigCapabilities` plus `hud_excluded_param_ids` and `hud_visible_param_ids`; empty fallback is non-stub behavior for inactive compositor. |
| `sidecar/src/sidecar/ws/hud_handlers.py` | HUD C2S routing and push loop | ✓ VERIFIED | Validates `HudMessageC2S`, mutates lock state, confirms/rejects set-lock, clears both original/resolved IDs, filters primitive params from pushed frames. |
| `sidecar/src/sidecar/ws/server.py` | `/hud/ws`, shared lock state, admin router | ✓ VERIFIED | Lifespan owns `lock_state`/`hud_tap`; `Compositor` receives both; `/hud/ws` subscribes/unsubscribes; admin rig router mounted. |
| `apps/electron-main/src/hud-window.ts` | Separate HUD window | ✓ VERIFIED | Single-instance BrowserWindow, `#/hud`, no `setAlwaysOnTop`, no HUD store persistence. |
| `apps/renderer/src/screens/HUD/*` | HUD route, rows, filters, stream hook | ✓ VERIFIED | `HudRoot`, rows, filters, footer, states, toast, and `useHudStream` are implemented and wired. |
| `apps/renderer/src/screens/Settings/Settings.tsx` | Settings entry point | ✓ VERIFIED | Open HUD button and helper text present; click invokes `window.api.openHud()`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Settings | Electron main HUD factory | `window.api.openHud()` -> `ipcMain.handle('hud:open')` -> `createHudWindow()` | ✓ WIRED | Preload bridge, IPC handler, cleanup, and factory all present. |
| HUD route | Sidecar capabilities | `fetch(.../admin/rig-capabilities)` from `HUD.tsx` | ✓ WIRED | Response populates row params from `hud_visible_param_ids` or writable-minus-excluded fallback. |
| HUD route | `/hud/ws` | `new WebSocket(.../hud/ws)` in `useHudStream.ts` | ✓ WIRED | Hook parses `param-frame`, tracks locks, reconnects every 1.5s, and closes on unmount. |
| `/hud/ws` | Compositor lock state | `route_hud_c2s` mutates `app.state.lock_state`; `Compositor` receives same dict | ✓ WIRED | Set/clear affect compositor-visible state; live smoke verified held frame value. |
| Compositor | HUD subscribers | `self._hud_tap.publish(frame, dict(self._lock_state))` | ✓ WIRED | Publish is non-blocking and decimated by `tick_count % 4`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `HUD.tsx` | `params` | `GET /admin/rig-capabilities` | Yes - endpoint reads `compositor._capabilities` and derived HUD lists | ✓ FLOWING |
| `useHudStream.ts` | `paramValues`, `lockedIds` | `/hud/ws` `param-frame` | Yes - `hud_push_loop` drains `HudTap`, which receives compositor frames | ✓ FLOWING |
| `HudParamRow.tsx` | slider value and lock state | Props from `HudRoot` state | Yes - values flow from WS frames plus optimistic lock state | ✓ FLOWING |
| `hud_handlers.py` | `lock_state` | C2S `set-lock` / `clear-lock` | Yes - shared FastAPI app-state dict consumed by compositor | ✓ FLOWING |
| `rig_capabilities.py` | HUD visible/excluded IDs | Active compositor capabilities | Yes - resolver-derived helpers, not hardcoded empty data | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command / Source | Result | Status |
| --- | --- | --- | --- |
| Sidecar HUD/compositor/admin/avatar tests | Orchestrator: `uv run pytest tests/compositor tests/ws tests/admin tests/avatar/test_rig_capabilities.py -q` | 87 passed | ✓ PASS |
| Renderer HUD/Settings tests | Orchestrator: `npx vitest run tests/HUD.test.tsx tests/HudParamRow.test.tsx tests/Settings.test.tsx` | 18 passed | ✓ PASS |
| Renderer typecheck | Orchestrator: `npm run typecheck:renderer` | passed | ✓ PASS |
| Electron main typecheck | Orchestrator: `npx tsc -p apps/electron-main/tsconfig.json --noEmit` | passed | ✓ PASS |
| Contract drift gate | Orchestrator: `npm run check:contracts` | passed | ✓ PASS |
| Live backend smoke | Orchestrator/user supplied | Capabilities returned 18 Teto HUD-visible IDs; `/hud/ws` emitted `param-frame`; `set-lock FaceAngleX=15` confirmed; subsequent frames held `FaceAngleX=15` and reported locked ID | ✓ PASS |
| Live operator UAT | User reply | `pass` | ✓ PASS |
| Contract package exports | `cd packages/contracts; uv run --project py python -c "from contracts import HudMessageS2C, HudMessageC2S, HudParamFrameMessage, HudSetLockMessage; print('ok')"` | `ok` | ✓ PASS |
| Single pyvts import guard | `rg -n "import pyvts" sidecar/src` | exactly one match: `sidecar/src/sidecar/vts/pyvts_writer.py` | ✓ PASS |
| HUD window no always-on-top/persistence | `rg -n "setAlwaysOnTop|store\\.set.*hud|electron-store.*hud" apps/electron-main/src/hud-window.ts` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| HUD-01 | `09-01-PLAN.md` | Dedicated `/hud/ws` only for HUD lifecycle | ✓ SATISFIED | `/hud/ws` endpoint subscribes on connect, unsubscribes and closes task on disconnect; renderer hook opens on HUD mount and closes on unmount. |
| HUD-02 | `09-01-PLAN.md` | 15 Hz compositor HUD tap | ✓ SATISFIED | `Compositor` publishes through `HudTap` on `tick_count % 4 == 0`; tests and live smoke passed. |
| HUD-03 | `09-02-PLAN.md` | Scrollable rig-derived rows with name/value/slider/lock and range bounds | ✓ SATISFIED | `HUD.tsx` builds params from capabilities; `HudParamRow` renders label, 2-decimal value, range input with min/max/step, and lock switch. |
| HUD-04 | `09-02-PLAN.md` | Drag sends `set-lock`; optimistic UI; sidecar lock state is source of truth; manual unlock only | ✓ SATISFIED | `HudParamRow` sends set-lock on non-trivial drag and does not clear on pointer-up; lock button sends clear only when locked; sidecar confirms and compositor consumes shared state. |
| HUD-05 | `09-01-PLAN.md` | Locks apply last; primitive safety remains | ✓ SATISFIED | `Compositor` applies locks after all drivers; primitive-owned IDs are skipped; live FaceAngleX lock held. |
| HUD-06 | `09-01-PLAN.md` | HUD excludes primitive-owned params including namespace-mapped mouth params | ✓ SATISFIED | `hud_excluded_param_ids` excludes direct `MouthOpen` and mapped `ParamMouthOpenY`; renderer filters sidecar-provided exclusions; tests assert absence. |
| HUD-07 | `09-01-PLAN.md` | Lock state is process-memory/session-only | ✓ SATISFIED | `app.state.lock_state = {}` in lifespan; no HUD persistence hooks; session-only tests present. |
| HUD-08 | `09-01-PLAN.md` | `GET /admin/rig-capabilities` first-open population endpoint | ✓ SATISFIED | Endpoint mounted and returns `RigCapabilities` plus HUD metadata; renderer fetches it on mount/reconnect. |

All eight HUD requirement IDs declared across plan frontmatter are accounted for. No Phase 9 HUD requirement in `REQUIREMENTS.md` is orphaned from the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/renderer/src/App.tsx` | 30 | `return null` while setup is loading | ℹ️ Info | Existing normal loading branch; not a HUD stub. |
| `apps/electron-main/src/ipc.ts` | 46 | `return null` for canceled file picker | ℹ️ Info | Existing expected cancellation path; not related to HUD. |
| `apps/renderer/src/screens/Settings/Settings.tsx` | 352, 498, 513, 530, 631, 642 | Existing placeholder/settings modal text | ℹ️ Info | Pre-existing non-HUD settings placeholders; Open HUD entry is implemented. |
| `sidecar/src/sidecar/ws/server.py` | 66 | Existing TODO about env-var spawn wiring | ℹ️ Info | Pre-existing unrelated comment; not in HUD path. |

No blocker HUD stubs, hollow props, hardcoded empty data sources, persistence hooks, second VTS client, or orphaned HUD artifacts were found.

### Human Verification Required

None. The live operator UAT was completed after the stream-liveness and visible-param fixes, and the user replied `pass`.

### Gaps Summary

No gaps found. Phase 9's sidecar, renderer, contract, and Electron entry-point paths are implemented, wired, data-backed, tested, and live-UAT approved.

---

_Verified: 2026-05-09T06:00:02Z_
_Verifier: Claude (gsd-verifier)_
