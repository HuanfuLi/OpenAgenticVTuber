# Phase 9: Slider HUD + Per-Param Lock — Research

**Researched:** 2026-05-08
**Domain:** Sidecar-side compositor lock state + secondary FastAPI WebSocket + Electron multi-BrowserWindow + Phase 7 codegen pipeline integration
**Confidence:** HIGH (almost every finding is verified against in-tree code anchors that already exist in the repo; LiteLLM/pyvts/Electron stack is locked by CLAUDE.md and not in scope to re-research)

## Summary

Phase 9 adds **two new sidecar surfaces** (`/hud/ws` WebSocket + `GET /admin/rig-capabilities` HTTP) wired into the **existing 60Hz Compositor** via a new `LockState` data structure inserted between `clamp_and_validate` and the `set_acc/add_acc` merge, plus **a new Electron BrowserWindow** that loads the existing renderer bundle on a `/hud` route hash. Every locked decision in CONTEXT.md (D-A1..D-D3) maps to a code anchor that already exists in the tree — this is a wire-up phase, not a new-architecture phase.

The five technical questions raised in the orchestrator prompt all have evidence-driven answers. The most important findings:

1. **HUD-exclusion namespace is already an unsolved mismatch in code.** `RigCapabilities.writable_param_ids` is built from rig source files (Cubism param IDs like `ParamMouthOpenY`); `SYSTEM_PRIMITIVE_OVERRIDES` is keyed by VTS tracking input names (`MouthOpen`). The resolver `_VTS_INPUT_PARAM_MAP` already maps Cubism→VTS in the forward direction. **Recommendation:** extend `lock_filter.py` with a `hud_excluded_param_ids(capabilities)` helper that does the inverse-resolution (Cubism param → VTS tracking input → membership check). Do NOT extend the dict to dual-key — single source of truth wins.

2. **Avatar re-import already restarts the sidecar wholesale** (`apps/electron-main/src/ipc.ts:74` — `restartSidecar()` after every `avatar:commitOverrides`). This means D-D3 ("clear all locks on re-import") is **already free** — the sidecar process restart wipes process memory including `lock_state`. The renderer toast is the only new wiring needed; the sidecar side requires nothing because there's no in-process re-import path.

3. **The 15Hz HUD tap should sample the compositor's emitted frame, not run a separate scheduler.** The Compositor already emits one `ParamFrame` per 60Hz tick to `writer.inject_params(frame)`. A `hud_tap` sidecar module subscribes to compositor-emitted frames, decimates 60→15Hz with a `tick_count % 4 == 0` gate, and broadcasts the snapshot to all connected `/hud/ws` clients. This is option (a) in the orchestrator's proposal — decimation counter inside `Compositor._tick`. Justification below.

**Primary recommendation:** Plan 09-01 = sidecar (compositor LockState + lock_filter slot + hud_tap + `/hud/ws` endpoint + `/admin/rig-capabilities` endpoint + HudMessage codegen integration). Plan 09-02 = renderer (BrowserWindow spawn IPC + `#/hud` route branch in App.tsx + HudRoot component tree per UI-SPEC + `useHudStream` hook + Settings "Open HUD" button).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. HUD Window Topology**
- **D-A1:** HUD lives in a **separate Electron BrowserWindow**, not a tab inside the main AppShell. The same renderer bundle loads the `/hud` route; the new window is created from `electron-main` on user action.
- **D-A2:** Entry point is a **"Open HUD" button in the Settings screen** — same section as the existing Phase 6 "Body motion plugin" radio group is a natural neighbor. No BottomRail tab change. No global hotkey for v1.
- **D-A3:** Window default behavior is **focused-only top-most** (Electron BrowserWindow default; do NOT call `setAlwaysOnTop`). When the user clicks back to VTube Studio, the HUD recedes; when the user wants to read it, they click on it.
- **D-A4:** Window position and size are **NOT persisted** across launches — every fresh open uses default size, OS-default placement.

**B. Lock × variant / event Interaction**
- **D-B1:** **Lock wins** against LLM-driven `{variant}` / `<event>` writes via 60Hz re-injection through the compositor; lock_filter is the last contributor before `clamp_and_validate` and `inject_params`.
- **D-B2:** **No "variant overriding" badge.** lock-vs-variant is not a conflict that the user needs visualized — lock is doing its job.
- **D-B3:** **HUD does NOT expose params the user cannot meaningfully lock.** HUD slider list = `RigCapabilities.writable_param_ids - keys(SYSTEM_PRIMITIVE_OVERRIDES)`.
- **D-B4:** **`SYSTEM_PRIMITIVE_OVERRIDES` semantics extended.** Single source of truth, no second list.
- **D-B5:** **ARCH-12 list itself stays at one entry (`MouthOpen`).** variant / event do NOT enter this list because they don't go through compositor merge.

**C. HudMessage Contract Shape**
- **D-C1:** **HudMessage joins the Phase 7 codegen pipeline.** Same JSON Schema → Pydantic + TS chain that produced `Dispatch`.
- **D-C2:** **Type is split by direction** — `HudMessageS2C` and `HudMessageC2S` are separate union types.
- **D-C3:** **Five message kinds:** S2C: `param-frame`, `lock-confirmed`, `lock-rejected`. C2S: `set-lock`, `clear-lock`.
- **D-C4:** **`param-frame` is a full snapshot every 15 Hz tick** — `{param_id: value}` for all currently-relevant params plus `locked_ids: list[str]`. No delta encoding.
- **D-C5:** **`lock-rejected` is retained but never surfaces in UI.** ERROR-log channel only.

**D. Lock Boundary Behaviors**
- **D-D1:** **Reject is designed out**, not handled with toast.
- **D-D2:** **Lock lifetime: drag-engage, manual-disengage.** Lock auto-engages on first non-trivial drag movement. Releasing the mouse does NOT release the lock. Persists until user explicitly clicks lock toggle off (or avatar re-import / app restart).
- **D-D3:** **Avatar re-import clears all locks.** When `RigCapabilities` changes mid-session, sidecar wipes `lock_state` entirely and renderer's HUD shows a toast.

### Claude's Discretion (Plan-time territory)
- HUD throttle exact rate: 15 Hz default; 30 Hz fallback if 15 Hz looks stuttery
- Filter set for the param list (writable / animating / locked): default to all-three filters
- HUD-exclusion namespace resolution: plan-phase researcher confirms whether exclusion runs through `compositor/param_id_resolver.py` reverse mapping or extends the dict to carry both forms
- Compositor lock_state ownership: instance attribute on Compositor vs. separate `LockState` class injected as constructor arg
- 15Hz hud_tap implementation: decimation counter inside `_tick` vs. separate asyncio task subscribing to a queue vs. polling `latest_frame` accessor
- Settings "Open HUD" button placement within `<PluginSection>` vs. a new sibling section

### Deferred Ideas (OUT OF SCOPE)
- Event-in-flight badge (Phase 7 forward-compat)
- Lock import / export (HUD-07 session-only)
- HUD inside main window (detachable) — rejected v1
- HUD-side LLM prompt suggestion ("don't drive these locked params")
- Filter chips / sort dropdown beyond the three-chip default
- HUD throttle rate tuning beyond 15Hz default
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HUD-01 | Sidecar exposes `/hud/ws` opened only when HUD route is mounted; closed on unmount | FastAPI `@app.websocket("/hud/ws")` next to existing `/ws` at `sidecar/src/sidecar/ws/server.py:426`. Lazy lifecycle is the FastAPI default (no work needed for "open on mount, close on unmount"). |
| HUD-02 | Compositor taps emit step at 15Hz throttle; ParamFrame deltas pushed to `/hud/ws` | `Compositor._tick` already maintains `self._tick_count`. Decimation gate `if self._tick_count % 4 == 0: hud_tap.publish(frame, lock_state)` adds 4 lines. |
| HUD-03 | Renderer HUD shows scrollable list of writable params from `RigCapabilities`, excluding `SYSTEM_PRIMITIVE_OVERRIDES` keys; slider value bounded by `RigCapabilities.ranges[param_id]` | `RigCapabilities` already has `writable_param_ids` and `param_ranges` (note: the field is `param_ranges`, not `ranges`). UI-SPEC's `<HudParamRow>` consumes both. |
| HUD-04 | Slider drag fires `set-lock(param_id, value)` over `/hud/ws`; renderer optimistic; sidecar single-source-of-truth in `compositor.lock_state` | `set_acc: dict[str, tuple[float, float]]` already exists in `_tick`; lock_filter inserts a final `set_acc[locked_id] = (locked_value, 1.0)` overwrite. |
| HUD-05 | Compositor merge applies locks LAST; system primitives override locks via merge order | `clamp_and_validate(frame, capabilities)` is the current last step; lock_filter slots between merge accumulators and clamp. ARCH-05 fixes this slot. |
| HUD-06 | HUD param list excludes any param ID present in `SYSTEM_PRIMITIVE_OVERRIDES` (resolver-mapped) | NEW helper `compositor.lock_filter.hud_excluded_param_ids(capabilities)` does inverse-mapping via `_VTS_INPUT_PARAM_MAP`. |
| HUD-07 | Lock state is session-only — process memory in sidecar, cleared on app restart | `compositor.lock_state` is a `dict[str, float]` instance attribute; restart wipes it for free. |
| HUD-08 | New `GET /admin/rig-capabilities` HTTP endpoint returns rig param IDs + ranges + expressions + hotkeys for HUD's first-open population | `app.state.compositor` already holds `capabilities`. Add a `router.get("/admin/rig-capabilities")` returning `RigCapabilities.model_dump(mode='json')`. ~10 LOC. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are load-bearing for this phase. Plan-phase MUST verify compliance:

- **Tech stack locked:** Electron 40 + React 19.2.x + Vite 6 + TS 5.7 + Python 3.12 + FastAPI 0.136.1 + Uvicorn 0.46.0. No alternative library suggestions.
- **Localhost-only WS** (PROJECT_DESIGN §10): the new `/hud/ws` endpoint binds the same `127.0.0.1:<port>` socket as the existing `/ws`. CORS middleware is already configured for both `localhost` and `null` origins (server.py:413).
- **Single pyvts writer (ARCH-06):** lock writes do NOT add a new VTS API client. Locks influence the compositor's `set_acc` accumulator BEFORE `writer.inject_params()`, so the existing `PyvtsSafeWriter` is the sole VTS callsite. CI grep test `tests/architecture/test_pyvts_writer_singleton.py` continues to pass.
- **KV-cache prefix-stable system prompt (Phase 2 D-17):** Phase 9 adds NO LLM-prompt content. The HUD does not rebuild the prompt on lock changes.
- **GSD workflow enforcement:** All file edits flow through GSD commands.
- **No mid-conversation rebuild of system prompt (ARCH-09):** No HUD action triggers an orchestrator rebuild.
- **Hand-rolled CSS + inline-SVG icons** (Phase 1 DELTA — no shadcn): UI-SPEC adds two new icons (`Lock`, `Unlock`) to `apps/renderer/src/lib/icons.tsx` via the existing `makeIcon(paths)` factory. No third-party icon library install.

---

## Standard Stack

The phase introduces NO new third-party libraries. All dependencies already exist in the project:

### Core (already installed, verified versions in repo)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **FastAPI** | 0.136.1 (locked CLAUDE.md) | Hosts `/hud/ws` and `GET /admin/rig-capabilities` next to existing `/ws` and `/admin/avatar/*` | Already running; second WebSocket endpoint is a `@app.websocket("/hud/ws")` decorator. |
| **Uvicorn** | 0.46.0 (locked) | ASGI server | Already running single-worker. |
| **websockets** (Uvicorn's WS implementation) | 14.x | WS protocol surface | No second WS library needed. |
| **Pydantic** | 2.x (already in tree, see `contracts/dispatch.py`) | `HudMessageS2C` / `HudMessageC2S` source-of-truth | Same Pydantic source the codegen toolchain consumes. |
| **json-schema-to-typescript** | 15.0.4 (devDependency, root `package.json:24`) | TS generation from JSON Schema | Already running for `Dispatch`, `RigCapabilities`, etc. New HudMessage targets append to `TARGETS` list in `packages/contracts/scripts/codegen.py:47-60`. |
| **Electron** | 40.x (locked) | New `BrowserWindow` for HUD | Already creating windows in `apps/electron-main/src/index.ts:21-70`. |
| **React** | 19.2.x (locked, `apps/renderer/package.json:12`) | HUD route components | Same renderer bundle as main app. |
| **Vitest** | 4.1.5 (`apps/renderer/package.json:24`) | Renderer unit tests for HUD components | Existing tests in `apps/renderer/tests/`. |
| **pytest** + **pytest-asyncio** | (existing in `sidecar/`) | Backend tests for lock_filter, hud_tap, /hud/ws round-trip | Existing pattern in `sidecar/tests/compositor/`. |
| **fastapi.testclient** + **httpx** (transitive) | from FastAPI | Integration test for `/admin/rig-capabilities` | Existing pattern in `sidecar/tests/avatar/test_admin_avatar.py`. |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **loguru** | (existing) | `[HUD-LOCK]`, `[HUD-TAP]`, `[HUD-WS]` log lines for the Logs drawer | Match existing `[COMPOSITOR]`, `[INTENT]` style. |
| **`@testing-library/react`** | 16.3.2 | Render + interact with HUD components in vitest | Existing `Settings.test.tsx` pattern. |
| **`jsdom`** | 29.1.1 | DOM emulation for vitest | Existing pattern. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Why Standard Stays |
|------------|-----------|----------|--------------------|
| Single uvicorn process hosting both `/ws` and `/hud/ws` | Separate uvicorn worker for HUD | Process isolation between HUD and conversation pipeline | Adds a second port + second sidecar lifecycle; CONTEXT.md D-A2/D-A3 do not require it; HUD is observation-side not write-side. |
| Sidecar push of param-frame snapshots over `/hud/ws` | HTTP polling at 15Hz from renderer to `GET /admin/param-frame` | Simpler protocol, no WS plumbing | 15Hz polling on Windows costs ~1ms/call * 15 = 15ms/sec just in TCP setup; WS push is canonical for a continuous stream |
| Decimation counter inside `Compositor._tick` (option a) | Separate asyncio task that subscribes to a `latest_frame` async-queue (option b) | Better separation of concerns; HUD lifecycle independent of compositor lifecycle | Adds a queue, a consumer task, and lifecycle plumbing for ~zero benefit — `tick_count % 4` is one branch. Compositor already owns the tick rate truth. |
| `Compositor.latest_frame` attribute polled by hud_tap (option c) | Same separation argument | Race risk between writer and reader; needs an asyncio.Lock for snapshot consistency | Decimation publishes IMMUTABLE `ParamFrame` to subscribers — no shared mutable state to lock. |
| HudMessage as separate Pydantic union (D-C2 split S2C / C2S) | Single union with `direction` discriminator | Type system catches accidental wrong-direction sends at compile time (TS) | Aligns with D-C2 verbatim. |
| HUD inside main BrowserWindow as React route | New BrowserWindow per D-A1 | Detachable would let user dock or undock | User explicitly rejected detachable in CONTEXT.md "Specifics" section. |
| `electron-store` to persist HUD position/size | Per D-A4, no persistence | User explicitly excluded persistence — discovery tool, not a saved layout. | D-A4 locked. |

**Installation (already complete — listed for reference):**
```bash
# Already in pyproject.toml / package.json:
# uv add fastapi==0.136.1 uvicorn==0.46.0 pydantic loguru pytest pytest-asyncio
# npm install (root) — json-schema-to-typescript@15.0.4 already in devDeps
# (apps/renderer) npm install — react, vitest, testing-library already declared
```

**Version verification:** Skipped because every package is already pinned in the repo. Verified against `apps/renderer/package.json:12-25`, root `package.json:23-25`, and CLAUDE.md locked-stack table.

---

## Architecture Patterns

### Recommended Module Structure (additions only — net new files marked NEW)

```
sidecar/src/sidecar/
├── compositor/
│   ├── compositor.py             # MODIFIED — accepts lock_state arg; applies lock_filter
│   ├── lock_filter.py            # MODIFIED — adds hud_excluded_param_ids() helper + LockState class
│   ├── hud_tap.py                # NEW — 15Hz decimation gate, fanout to subscribers
│   └── param_id_resolver.py      # UNCHANGED (read-only — reverse mapping consumed by lock_filter)
├── ws/
│   ├── server.py                 # MODIFIED — adds /hud/ws endpoint + /admin/rig-capabilities GET
│   └── hud_handlers.py           # NEW — set_lock / clear_lock C2S handlers
└── admin/
    └── rig_capabilities.py       # NEW — GET /admin/rig-capabilities router (mirrors admin/avatar.py shape)

packages/contracts/py/contracts/
└── hud_message.py                # NEW — Pydantic source-of-truth for HudMessageS2C + HudMessageC2S

packages/contracts/
├── scripts/codegen.py            # MODIFIED — TARGETS append + OWNER_FILE entries
├── generated/json-schema/
│   └── hud-message.schema.json   # GENERATED
└── ts/
    └── hud-message.ts            # GENERATED

apps/electron-main/
├── src/
│   ├── index.ts                  # MODIFIED — accept hud window from ipc.openHud
│   ├── ipc.ts                    # MODIFIED — adds 'hud:open' channel
│   └── hud-window.ts             # NEW — createHudWindow() factory
└── preload/
    └── index.ts                  # MODIFIED — adds api.openHud()

apps/renderer/src/
├── App.tsx                       # MODIFIED — top-level route branch on window.location.hash
├── screens/
│   ├── HUD/                      # NEW directory
│   │   ├── HUD.tsx               # NEW — <HudRoot>
│   │   ├── HudHeader.tsx         # NEW
│   │   ├── HudFilterChips.tsx    # NEW
│   │   ├── HudParamRow.tsx       # NEW
│   │   ├── HudFooterStatus.tsx   # NEW
│   │   ├── HudErrorState.tsx     # NEW
│   │   └── useHudStream.ts       # NEW — WS hook
│   └── Settings/Settings.tsx     # MODIFIED — adds "Open HUD" button
├── lib/
│   ├── icons.tsx                 # MODIFIED — adds Lock + Unlock SVGs
│   └── copy.ts                   # MODIFIED — adds COPY.HUD block
└── index.css                     # MODIFIED — appends HUD route CSS section
```

### Pattern 1: Compositor LockState as Constructor-Injected dict

**What:** `Compositor.__init__` accepts `lock_state: dict[str, float]` constructed in `lifespan()` and shared with WS handlers via `app.state.lock_state`. The compositor reads but does NOT mutate; WS handlers mutate.

**When to use:** This is the standard sidecar pattern (matches `app.state.compositor`, `app.state.writer`, `app.state.discrete_dispatcher` in server.py:334-346).

**Example:**
```python
# sidecar/src/sidecar/ws/server.py (in lifespan, after compositor construction)
lock_state: dict[str, float] = {}
app.state.lock_state = lock_state
compositor = Compositor(
    writer=writer,
    idle_driver=idle_drv,
    speech_driver=speech_drv,
    plugin_driver=plugin_adapter,
    capabilities=capabilities,
    cursor_driver=cursor_drv,
    lock_state=lock_state,  # NEW — same object referenced by both compositor and ws handlers
)

# sidecar/src/sidecar/compositor/compositor.py — _tick after merge, before clamp
# (per ARCH-05 ordering: ... → cursor → primitive_overrides → lock_filter → clamp → inject)
for param_id, locked_value in self._lock_state.items():
    # SYSTEM_PRIMITIVE_OVERRIDES already excluded at HUD-side, so any param here is lockable
    set_acc[param_id] = (locked_value, 1.0)
```

**Why this works:** The compositor only READS `self._lock_state` per tick; the WS handler MUTATES it on `set_lock`/`clear_lock`. Python's GIL makes a single-key dict assign/del atomic. No lock needed.

### Pattern 2: 15Hz HUD Tap via Tick Decimation (option a)

**What:** Compositor runs at 60Hz already (`Compositor.TICK_HZ = 60`). The `_tick` method emits one `ParamFrame` per call. Add a publish call gated on `tick_count % 4 == 0`.

**When to use:** Always preferred for sub-Hz periodic taps when a parent loop already runs at the higher rate. Adds zero scheduling complexity.

**Example:**
```python
# sidecar/src/sidecar/compositor/compositor.py
async def _tick(self, now: float) -> None:
    # ... existing merge ...
    frame = clamp_and_validate(ParamFrame(...), self._capabilities)
    try:
        await self._writer.inject_params(frame)
    except Exception as exc:
        logger.warning(f"[COMPOSITOR] writer.inject_params failed: {exc!r}")

    # NEW — HUD tap (15Hz = every 4th 60Hz tick)
    if self._hud_tap is not None and self._tick_count % 4 == 0:
        self._hud_tap.publish(frame, dict(self._lock_state))  # snapshot dict to avoid races
```

```python
# sidecar/src/sidecar/compositor/hud_tap.py — NEW
import asyncio
from contracts import ParamFrame

class HudTap:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=8)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def publish(self, frame: ParamFrame, lock_state_snapshot: dict[str, float]) -> None:
        # Non-blocking — drop oldest if subscriber is slow (15Hz means a 533ms backlog at 8 deep)
        for q in self._subscribers:
            try:
                q.put_nowait((frame, lock_state_snapshot))
            except asyncio.QueueFull:
                try:
                    q.get_nowait()  # drop oldest
                    q.put_nowait((frame, lock_state_snapshot))
                except asyncio.QueueEmpty:
                    pass
```

**Why decimation, not separate task:** A separate asyncio task subscribed to a queue introduces a second producer cadence (compositor produces frames; task consumes-then-publishes); the decimation gate publishes inline at the exact moment a fresh frame is computed, which is the lowest possible latency to the HUD. The orchestrator's option (b) pattern would help if hud_tap had heavy work to do per publish (e.g., diffing); since publish is just `put_nowait`, the gate inline is cleaner.

**Why not `latest_frame` polling (option c):** Polling means the HUD sees stale frames between publishes; the snapshot's `tick_n` would be inconsistent (polled at T but represents work done at T-50ms in the worst case). Not a correctness issue but observability is muddier.

### Pattern 3: Dual WebSocket Endpoint Coexistence

**What:** Two `@app.websocket(...)` decorators in `server.py`, both inside the same FastAPI app instance. They share `app.state` (writer, compositor, lock_state) but each handler owns its own `WebSocket` instance.

**When to use:** Whenever the protocol surface needs separate concerns (here: conversation envelope vs. HUD diagnostic stream).

**Example:**
```python
# sidecar/src/sidecar/ws/server.py (additions)

@app.websocket("/hud/ws")
async def hud_websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    # subscribe to compositor's hud_tap (built in lifespan)
    hud_tap = app.state.hud_tap
    queue = hud_tap.subscribe()
    push_task = asyncio.create_task(_hud_push_loop(ws, queue))
    try:
        while True:
            raw = await ws.receive_json()
            await route_hud_c2s(ws, raw, app.state)  # set_lock / clear_lock
    except WebSocketDisconnect:
        log.info("HUD WS client disconnected.")
    except Exception:
        log.exception("HUD WS handler error; closing connection.")
        try:
            await ws.close(code=1011)
        except Exception:
            pass
    finally:
        push_task.cancel()
        hud_tap.unsubscribe(queue)
```

**Why coexistence works without contention:**
- Both endpoints share the same uvicorn event loop
- `app.state.writer` (PyvtsSafeWriter) — both can read, but only `compositor._tick` calls `inject_params`. HUD WS writes only to `app.state.lock_state` (a dict), never to the writer directly.
- Lifespan startup/shutdown is one-shot per process — no per-WS lifecycle
- WebSocketDisconnect on either endpoint does NOT affect the other (FastAPI/Starlette routes WS connections per endpoint independently)
- One `/ws` and 0..N `/hud/ws` connections coexist — the renderer normally has exactly one of each

**Confirmed by code anchor:** Existing `/ws` endpoint is at `server.py:426-442`. The patterns at lines 433 (`receive_json`), 435 (`WebSocketDisconnect`), 437 (`Exception`+1011 close) are the templates `/hud/ws` follows verbatim.

### Pattern 4: HudMessage Codegen Integration

**What:** Add `HudMessageS2C` and `HudMessageC2S` Pydantic union types to a new `contracts/hud_message.py`, register them as TARGETS in `packages/contracts/scripts/codegen.py`, run `npm run codegen:contracts`, commit the generated TS + JSON Schema files. Drift gate: `npm run check:contracts` (root `package.json:17`) catches divergence in CI.

**Example:**
```python
# packages/contracts/py/contracts/hud_message.py — NEW
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field


# S2C (server -> client)

class HudParamFrameMessage(BaseModel):
    """Full snapshot pushed at 15Hz per D-C4."""
    kind: Literal["param-frame"] = "param-frame"
    tick_n: int
    params: dict[str, float]      # { param_id: current_value } — full snapshot
    locked_ids: list[str]          # currently-locked param IDs


class HudLockConfirmedMessage(BaseModel):
    kind: Literal["lock-confirmed"] = "lock-confirmed"
    param_id: str
    value: float


class HudLockRejectedMessage(BaseModel):
    """ERROR-log channel only per D-C5; never surfaces in UI."""
    kind: Literal["lock-rejected"] = "lock-rejected"
    param_id: str
    reason: str


HudMessageS2C = Annotated[
    Union[HudParamFrameMessage, HudLockConfirmedMessage, HudLockRejectedMessage],
    Field(discriminator="kind"),
]


# C2S (client -> server)

class HudSetLockMessage(BaseModel):
    kind: Literal["set-lock"] = "set-lock"
    param_id: str
    value: float


class HudClearLockMessage(BaseModel):
    kind: Literal["clear-lock"] = "clear-lock"
    param_id: str


HudMessageC2S = Annotated[
    Union[HudSetLockMessage, HudClearLockMessage],
    Field(discriminator="kind"),
]
```

```python
# packages/contracts/scripts/codegen.py (additions)
from contracts import (  # noqa: E402
    # ... existing imports ...
    HudMessageS2C,  # NEW
    HudMessageC2S,  # NEW
)

TARGETS = [
    # ... existing entries ...
    (HudMessageS2C, "hud-message-s2c", "hud_message", "HudMessageS2C"),  # NEW
    (HudMessageC2S, "hud-message-c2s", "hud_message", "HudMessageC2S"),  # NEW
]

OWNER_FILE = {
    # ... existing ...
    "HudMessageS2C": "hud-message-s2c",
    "HudMessageC2S": "hud-message-c2s",
    "HudParamFrameMessage": "hud-message-s2c",
    "HudLockConfirmedMessage": "hud-message-s2c",
    "HudLockRejectedMessage": "hud-message-s2c",
    "HudSetLockMessage": "hud-message-c2s",
    "HudClearLockMessage": "hud-message-c2s",
}
```

Also update `packages/contracts/py/contracts/__init__.py` to export `HudMessageS2C`, `HudMessageC2S`, and the seven new message classes.

### Pattern 5: Electron Multi-BrowserWindow with Hash-Routing

**What:** `apps/electron-main/src/hud-window.ts` exports `createHudWindow()`. Called from a new `ipcMain.handle('hud:open', ...)`. Loads the same renderer bundle but with `#/hud` appended to URL or file path. Window is owned by main process; closure cleans up automatically.

**Example:**
```typescript
// apps/electron-main/src/hud-window.ts — NEW
import { BrowserWindow, type BrowserWindow as BW } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

let hudWindow: BW | null = null

export function createHudWindow(): BW {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.focus()
    return hudWindow
  }
  hudWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 480,
    title: 'AgenticLLMVTuber — HUD',  // per UI-SPEC Copywriting Contract
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  hudWindow.on('ready-to-show', () => hudWindow!.show())
  hudWindow.on('closed', () => { hudWindow = null })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    hudWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/hud`)
  } else {
    hudWindow.loadFile(join(__dirname, '../../../renderer/out/index.html'), { hash: 'hud' })
  }
  return hudWindow
}

export function closeHudWindow(): void {
  if (hudWindow && !hudWindow.isDestroyed()) hudWindow.close()
}
```

```typescript
// apps/electron-main/src/ipc.ts — addition inside registerIpc
import { createHudWindow } from './hud-window'

ipcMain.handle('hud:open', () => {
  createHudWindow()
})
```

```typescript
// apps/electron-main/preload/index.ts — addition
const api = {
  // ... existing ...
  openHud: (): Promise<void> => ipcRenderer.invoke('hud:open'),
}
```

```typescript
// apps/renderer/src/App.tsx — top-level branch
function App() {
  // Detect HUD route on first mount via hash; do NOT use react-router (project pattern is hand-rolled)
  const isHudWindow = typeof window !== 'undefined' && window.location.hash === '#/hud'

  return (
    <ThemeProvider>
      <AppStoreProvider>
        <div className="app-window">
          {isHudWindow ? <HudRoot /> : <GatedShell />}
        </div>
        {import.meta.env.DEV && <DevPanel />}
      </AppStoreProvider>
    </ThemeProvider>
  )
}
```

**Why hash-routing not query-string:** `loadFile` with hash is a single Electron API call that survives both dev (`loadURL`) and prod (`loadFile`) paths cleanly. Query strings on `file://` URLs sometimes break on Windows. Hash also avoids reload-on-navigation (vite/React both treat hash changes as in-page).

**Why `createHudWindow()` enforces single-window:** UI-SPEC §"Out-of-Scope Visual Decisions" — "Multiple HUD windows: v1 supports one HUD at a time; opening the button when a HUD already exists focuses the existing window rather than spawning a second one."

### Anti-Patterns to Avoid

- **Anti-pattern: Compositor instantiating its own LockState.** The compositor must NOT own writable lock state because WS handlers also need to mutate it. Constructor-injected shared dict is the canonical pattern (matches existing app.state pattern).
- **Anti-pattern: HudMessage as a single union.** The orchestrator prompt notes D-C2 split. A unified union loses the compile-time direction guard.
- **Anti-pattern: Using `setAlwaysOnTop` for the HUD window.** D-A3 explicitly forbids it. OS-default focused-only behavior is the locked design.
- **Anti-pattern: Persisting HUD locks via `electron-store`.** D-A4 + HUD-07 explicitly forbid persistence.
- **Anti-pattern: Streaming param-frame as a delta.** D-C4 mandates full snapshots; delta encoding adds reconciliation complexity for ~zero localhost-bandwidth cost.
- **Anti-pattern: `lock-rejected` toast.** D-C5 + D-D1: never surfaces in UI. Console-error-level only.
- **Anti-pattern: Adding `MouthOpen` to `RigCapabilities.writable_param_ids`.** It's already there in the rig source files (Cubism `ParamMouthOpenY`); the HUD-exclusion rule operates on the resolver-mapped form.
- **Anti-pattern: Mutating `lock_state` from inside `_tick`.** Compositor reads only; WS handlers write only. Single-writer discipline avoids races even though Python GIL makes most operations safe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TS contract types for HudMessage | Hand-write TS mirroring Pydantic | Phase 7 codegen pipeline (`packages/contracts/scripts/codegen.py`) | `npm run check:contracts` is the drift gate; hand-written TS will diverge silently. |
| HUD route resolution | Install react-router-dom | `window.location.hash === '#/hud'` branch in App.tsx | Project pattern is hand-rolled (no router installed); single-line hash detection is the entire requirement. |
| Slider component | Build a custom slider (drag handlers, ARIA, keyboard, etc.) | Native `<input type="range">` with custom CSS targeting `::-webkit-slider-runnable-track` etc. (UI-SPEC §HudSlider) | Native slider gives keyboard accessibility, ARIA, pointer/touch events, screen reader announcement for free. |
| WebSocket reconnect logic | New reconnect implementation | Reuse the main `/ws` reconnect pattern from `apps/renderer/src/state/...` (existing 1.5s cadence per UI-SPEC IP-5) | The main WS already has battle-tested reconnect; HUD inherits the same constants. |
| BrowserWindow position persistence | Wire `electron-store` for `hud-window` key | Per D-A4: do nothing | Locked decision rules out implementation. |
| Lock conflict UX | Modal/toast/badge for "lipsync overrides your lock" | Designed-out-by-exclusion: HUD never shows the param at all (D-B3, D-D1) | The conflict is impossible by construction once exclusion is in place. |
| `RigCapabilities` change-detection in renderer | Add a long-poll or WS push for capability updates | Sidecar restarts on `avatar:commitOverrides` (`apps/electron-main/src/ipc.ts:74`); HUD's WS reconnect handles it for free; toast on reconnect by hash | The path is already wired via existing avatar flow. |
| 15Hz scheduler | New asyncio.create_task scheduler | Decimation inside compositor `_tick` | One branch on `tick_count % 4`. |
| `MouthOpen` exclusion via dict-lookup at every HUD render | Compute on every render | Memoize `hud_excluded_param_ids(capabilities)` at HUD mount + on capabilities-change | RigCapabilities is frozen at boot, so memoize-once is correct. |

**Key insight:** Phase 9 is mostly **wiring existing primitives together**. The only NEW abstractions are `LockState` (a dict), `HudTap` (a queue fanout), `HudMessage` Pydantic types, and the React component tree per UI-SPEC. Everything else is "add a line here, add a router there".

---

## Compositor Lock Filter Integration (Question 1 — HUD-exclusion namespace resolution)

**Problem (verified by reading code):**

- `RigCapabilities.writable_param_ids` is built in `sidecar/src/sidecar/avatar/rig_capabilities.py:17-58` from rig source files (`*.model3.json` Groups[].Ids[], `*.vtube.json` ParameterSettings[].OutputLive2D, `*.cdi3.json` keys). All entries are **Cubism param IDs** (e.g., `ParamMouthOpenY`, `ParamAngleX`, `ParamBHandIN`).
- `SYSTEM_PRIMITIVE_OVERRIDES` in `sidecar/src/sidecar/compositor/lock_filter.py:1` contains **VTS tracking input names** (`MouthOpen`).
- `_VTS_INPUT_PARAM_MAP` in `compositor/param_id_resolver.py:10-19` maps Cubism → VTS in the FORWARD direction:
  ```python
  _VTS_INPUT_PARAM_MAP = {
      "ParamAngleX": "FaceAngleX",
      "ParamMouthOpenY": "MouthOpen",
      ...
  }
  ```

**Recommendation: build the inverse mapping in `lock_filter.py`, not by extending `SYSTEM_PRIMITIVE_OVERRIDES` to dual-key.**

Reasoning:
- ARCH-12 deliberately documents `SYSTEM_PRIMITIVE_OVERRIDES` as keyed by VTS tracking input names (the dimension that lipsync writes). Dual-keying conflates "the merge override semantics" with "the HUD exclusion lookup".
- The forward mapping `_VTS_INPUT_PARAM_MAP` IS the source of truth for the namespace conversion; building an inverse from it costs ~5 LOC.
- `RigCapabilities.writable_param_ids` may also contain VTS tracking inputs themselves (the `MouthOpen` is in `VTS_TRACKING_INPUT_PARAM_IDS` set), so exclusion needs to match BOTH "Cubism param whose VTS-mapped form is in OVERRIDES" AND "VTS tracking input directly in OVERRIDES".

**Code (NEW addition to `compositor/lock_filter.py`):**

```python
from sidecar.compositor.param_id_resolver import _VTS_INPUT_PARAM_MAP

# Inverse map for HUD-exclusion: VTS tracking input name -> set of Cubism param IDs that resolve to it
_VTS_TO_CUBISM_REVERSE: dict[str, set[str]] = {}
for cubism_id, vts_id in _VTS_INPUT_PARAM_MAP.items():
    _VTS_TO_CUBISM_REVERSE.setdefault(vts_id, set()).add(cubism_id)


def hud_excluded_param_ids(writable_param_ids: list[str]) -> set[str]:
    """Return the subset of writable_param_ids hidden from HUD per HUD-06 / ARCH-12.

    A param ID is excluded if EITHER:
    1. It is a VTS tracking input name directly in SYSTEM_PRIMITIVE_OVERRIDES (e.g., "MouthOpen"), OR
    2. It is a Cubism param ID that the resolver maps TO a VTS tracking input in
       SYSTEM_PRIMITIVE_OVERRIDES (e.g., "ParamMouthOpenY" -> "MouthOpen" -> excluded).

    Single source of truth: SYSTEM_PRIMITIVE_OVERRIDES. The reverse map is derived
    from _VTS_INPUT_PARAM_MAP at module load time; no second list to maintain.
    """
    excluded: set[str] = set()
    for param_id in writable_param_ids:
        # case 1: direct VTS-tracking-input membership
        if param_id in SYSTEM_PRIMITIVE_OVERRIDES:
            excluded.add(param_id)
            continue
        # case 2: Cubism ID whose VTS-mapped form is overridden
        vts_form = _VTS_INPUT_PARAM_MAP.get(param_id)
        if vts_form and vts_form in SYSTEM_PRIMITIVE_OVERRIDES:
            excluded.add(param_id)
    return excluded
```

**Where it's called:**
- `GET /admin/rig-capabilities`: returns `RigCapabilities` AS-IS (raw rig data); the renderer applies the exclusion. UI-SPEC §HudRoot says "computes the visible param list (= `writable_param_ids - SYSTEM_PRIMITIVE_OVERRIDES`)".
- BUT: a sidecar-side authoritative test must assert exclusion (per ROADMAP SC-5 "verified by an automated test that boots a default rig and asserts the HUD payload excludes the dict's keys").
- **Plan-time decision:** the `GET /admin/rig-capabilities` response should include both the raw `RigCapabilities` AND a `hud_excluded_param_ids: list[str]` field so the renderer doesn't need to re-implement the resolver. Keeps namespace logic single-source on the sidecar side.

**Alternative considered and REJECTED:** Extending `SYSTEM_PRIMITIVE_OVERRIDES` to be a `dict[str, list[str]]` carrying both names — rejected because ARCH-12 explicitly documents the semantic of "params where lipsync wins over user lock", and adding a second namespace conflates that with HUD UX concerns. Single source, derived inverse.

**Confidence:** HIGH (verified by reading lock_filter.py:1-8, param_id_resolver.py:10-19, rig_capabilities.py:17-58, clamp.py:35).

---

## FastAPI Dual WebSocket Coexistence (Question 2)

**Verified facts:**
- Existing `/ws` endpoint: `sidecar/src/sidecar/ws/server.py:426-442` (NOTE: orchestrator prompt said `:361` — actual line is `:426`; correcting).
- The endpoint is registered AFTER the `lifespan` and CORS middleware, before the `/admin/*` router includes (server.py:413-449).
- `app.state` shares: `compositor`, `writer`, `tts_gateway`, `orchestrator`, `discrete_dispatcher`, `variant_state_manager`, `event_completion_tracker`, `plugin_supervisor`, etc.
- Lifespan runs ONCE per uvicorn process; teardown only fires on full sidecar shutdown.

**Recommendation:**

Add `/hud/ws` next to `/ws` in the same `server.py`. Share `app.state.writer` indirectly only — HUD writes flow into `app.state.lock_state` (the dict), which `compositor._tick` reads on the next 60Hz cycle, which then issues the actual VTS write through the existing `PyvtsSafeWriter`. **No second writer instance.** ARCH-06 holds.

**Lifecycle interactions:**

| Event | `/ws` | `/hud/ws` |
|-------|-------|-----------|
| Sidecar boot | endpoint registered, no client yet | endpoint registered, no client yet |
| First main-window WS connect | `/ws` lifecycle starts | unaffected |
| HUD window open | unaffected | `/hud/ws` lifecycle starts on first message |
| HUD window close | unaffected | `WebSocketDisconnect` → handler returns; subscriber removed from `hud_tap` |
| Main window close (Electron quit) | sidecar shutdown → both endpoints close | ditto |
| Sidecar crash + auto-respawn | both endpoints unavailable until `/health` reports OK; both clients reconnect | ditto |
| Avatar re-import | sidecar restart (per `ipc.ts:74`); both endpoints transient-unavailable | renderer HUD shows reconnect banner; on reconnect, `lock_state` is empty and HUD reflects that |

**Confidence:** HIGH (FastAPI/Starlette canonical pattern, verified against existing `/ws` shape; `app.state` is the documented sharing mechanism).

---

## 15Hz HUD Tap Implementation (Question 3) — see Pattern 2 above

Recommendation: **option (a) decimation inside `Compositor._tick`**, with an injected `HudTap` subscriber registry.

Justification:
- Compositor already runs at 60Hz; decimation gate is one if-statement
- Snapshotting `dict(self._lock_state)` per publish ensures the HUD sees a coherent view
- Subscribers are queues; a slow subscriber drops oldest (drop-tail) so the compositor never blocks on HUD I/O
- Independent of compositor's existing fall-behind threshold (compositor already drops on overrun; HUD inherits that)
- Zero new asyncio tasks, zero new lifecycle plumbing

Why not (b) separate task: see Pattern 2 above.

Why not (c) latest_frame polling: see Pattern 2 above.

**Plan-time decision deferred:** if perceptual benchmark on real Teto rig shows 15Hz looks stuttery (rare for ParamFrame which represents subtle continuous animation), bump to 30Hz by changing `% 4` to `% 2`. UI-SPEC's footer status copy `"15 Hz"` becomes parametric.

---

## Electron Multi-Window (Question 4) — see Pattern 5 above

Verified: `apps/electron-main/src/index.ts:21-70` is the existing `createWindow` template. The new `apps/electron-main/src/hud-window.ts` mirrors that structure minus persistence (no `store.set('window', ...)`) and minus mainWindow lifecycle hooks (HUD has no IPC dependency on `cleanupIpc`).

**Window destruction:** `hudWindow.on('closed', () => { hudWindow = null })` is sufficient. The renderer's `<HudRoot>` `useEffect` cleanup closes `/hud/ws` and the cascade is automatic. The main window's `cleanupIpc` should NOT call `closeHudWindow()` — the HUD window stays open through main-window minimize/restore (per UI-SPEC §"focused-only top-most" framing).

**HOWEVER:** `before-quit` (`apps/electron-main/src/index.ts:113-126`) currently calls `cleanupIpc?.()` and `shutdownSidecar()`. The HUD window's renderer is still mounted at this point — it will receive a flood of WS disconnect errors as the sidecar dies. Recommended fix: in `before-quit`, also close `hudWindow` first (it's a child of the same Electron process; `app.quit()` closes all BrowserWindows automatically, but explicit cleanup avoids transient log noise).

**Confidence:** HIGH (multi-window is canonical Electron pattern; verified against existing `createWindow`).

---

## Phase 7 Codegen Pipeline Integration (Question 5) — see Pattern 4 above

**Verified codegen flow** (read from `packages/contracts/scripts/codegen.py:46-318`):

1. Pydantic model in `contracts/py/contracts/<name>.py`
2. Re-export from `contracts/py/contracts/__init__.py` (so `codegen.py:25-41` can import it)
3. Add `(Model, "kebab-case-name", "snake_case_module", "PrimaryClassName")` tuple to `TARGETS` list (codegen.py:47-60)
4. Add cross-file ownership entries to `OWNER_FILE` map (codegen.py:62-85)
5. Run `npm run codegen:contracts` (root `package.json:16`) — this invokes `packages/contracts/scripts/run-codegen.cjs` which calls `python -m packages.contracts.scripts.codegen`
6. Generated outputs:
   - `packages/contracts/generated/json-schema/<kebab-name>.schema.json`
   - `packages/contracts/ts/<kebab-name>.ts`
7. Drift gate: `npm run check:contracts` (root `package.json:17`) runs codegen + `git diff --exit-code` over the two output dirs

**For HudMessage specifically:**

Two TARGETS entries (one for S2C, one for C2S), both pointing at the same `hud_message.py` source module. The `force_required` mutator (codegen.py:100-129) handles `Literal["..."]` discriminators correctly (already proven by `Dispatch` which has the same shape).

**TS output prediction:**

```typescript
// packages/contracts/ts/hud-message-s2c.ts (generated)
export type HudMessageS2C =
  | HudParamFrameMessage
  | HudLockConfirmedMessage
  | HudLockRejectedMessage;

export interface HudParamFrameMessage {
  kind: 'param-frame';
  tick_n: number;
  params: { [k: string]: number };
  locked_ids: string[];
}
// ... etc.
```

**Existing test pattern** to mirror: `packages/contracts/tests/test_codegen.py:54-64` asserts that generated artifacts contain expected names. Add equivalent assertions for `HudMessageS2C`/`HudMessageC2S`.

**Confidence:** HIGH (codegen pipeline is exercised by 12 existing TARGETS; HudMessage is structurally identical to `Dispatch`).

---

## Compositor `lock_state` Integration (Question 6)

**Verified:**
- `Compositor` is constructed once in lifespan (`server.py:325-332`).
- The merge order in `_tick` (`compositor.py:90-110`) currently is: `idle → speech → plugin → cursor → clamp_and_validate → writer.inject_params`.
- `add_acc: dict[str, float]` and `set_acc: dict[str, tuple[float, float]]` are the two accumulators.
- `clamp_and_validate(frame, capabilities)` is the LAST step before `writer.inject_params`.

**ARCH-05 specifies:** `Idle → Speech → Plugin → Cursor → primitive-overrides → lock_filter → clamp → pyvts.inject_params`.

**Plan-time recommendation: add the lock filter slot between cursor and clamp, with system-primitive overrides as a separate prior step.**

**Code:**

```python
# sidecar/src/sidecar/compositor/compositor.py — _tick after cursor merge
# (per ARCH-05; primitive_overrides currently handled implicitly because
#  speech_driver writes to MouthOpen via set_acc — that's already the override)

# NEW: apply locks to set_acc as the last contributor
for param_id, locked_value in self._lock_state.items():
    # SYSTEM_PRIMITIVE_OVERRIDES already excluded at HUD-side per HUD-06,
    # so any param here is safe to lock. Defense-in-depth: skip if the
    # param has been written to set_acc by a higher-priority slot
    # (system primitive override). Today, only MouthOpen falls into this case
    # and it's already excluded from the HUD payload — but the assert is cheap.
    if param_id in SYSTEM_PRIMITIVE_OVERRIDES:
        continue  # impossible-by-construction; defense in depth
    set_acc[param_id] = (locked_value, 1.0)
    # Also clear add_acc for this param so add doesn't add on top of set
    add_acc.pop(param_id, None)

frame = clamp_and_validate(ParamFrame(...), self._capabilities)
```

**Data structure:**
- `lock_state: dict[str, float]` — keyed by param ID (Cubism form, e.g., `ParamAngleX`), value is the locked numeric value
- Owned by `lifespan()`, passed to `Compositor.__init__`, also referenced in `app.state.lock_state` for WS handlers

**Setter location:**
- `set_lock(param_id, value)` and `clear_lock(param_id)` are functions in `sidecar/src/sidecar/ws/hud_handlers.py` (NEW)
- They mutate `app.state.lock_state` directly
- They emit `HudLockConfirmedMessage` back to the originating WS

**Plan-time decision deferred:** whether to expose `set_lock`/`clear_lock` as Compositor methods (encapsulation) or as standalone functions (simpler). **Recommendation: standalone functions in `hud_handlers.py`** — the dict is the contract; encapsulation adds nothing because compositor doesn't react to lock changes (it just reads on the next tick).

**Range validation:** `clamp_and_validate` already enforces ranges via `_clamp_param_value` (clamp.py:29-31). A locked value outside `RigCapabilities.param_ranges[param_id]` will be silently clamped — good. The renderer's slider UI bounds the value to the range so this should never fire (D-D1).

**Confidence:** HIGH (verified against compositor.py:83-120 and clamp.py:34-80).

---

## Avatar Re-Import Lock-Clear Hook (Question 7)

**Critical finding:** Avatar re-import currently performs a **full sidecar restart** via `restartSidecar()` in `apps/electron-main/src/ipc.ts:74` (called inside the `avatar:commitOverrides` handler).

**This means D-D3 ("clear all locks on re-import") is implicitly handled:**

1. User completes avatar import in main window's AvatarImport screen
2. Renderer calls `window.api.commitAvatarOverrides(plan)`
3. `ipc.ts:62-77` posts to `/admin/avatar/import/commit`, then calls `restartSidecar()` (line 74)
4. Sidecar process is killed and respawned
5. Lifespan runs again with fresh `lock_state = {}`
6. Both `/ws` and `/hud/ws` are unavailable for ~1-3s
7. Renderer HUD's `<HudErrorState>` banner shows "HUD lost connection — reconnecting…"
8. Renderer reconnects to `/hud/ws` after sidecar `[READY]`
9. First `param-frame` shows `locked_ids: []` because the new sidecar has empty lock_state
10. NEW: renderer's `useHudStream` hook detects "first frame after reconnect has fewer locked_ids than last-known" and fires the `useStore().pushToast({ text: 'Avatar changed — locks cleared.' })` toast

**Plan-time decision:** the toast trigger is renderer-side, fired on reconnect when locked_ids drops to empty and previously had entries. NO new IPC channel needed. NO new sidecar message needed.

**Alternative considered:** Adding a sidecar-side `capabilities-changed` HudMessage that explicitly tells the HUD "fetch /admin/rig-capabilities again". This would be needed if avatar re-import were a hot-path (no restart). Since it's a restart, the WS reconnect IS the signal. Simpler.

**Plan-time decision deferred:** whether to also re-fetch `/admin/rig-capabilities` on every reconnect, or only on the avatar-changed path. **Recommendation: re-fetch on every reconnect.** Capabilities are static-per-session anyway; re-fetch is one HTTP GET and ensures correctness through any future "in-process avatar swap" milestone.

**If a future milestone moves avatar re-import to in-process** (no sidecar restart), THEN add a sidecar→HUD `capabilities-changed` message + a `clear_all_locks()` function in `hud_handlers.py`. NOT in scope for Phase 9.

**Confidence:** HIGH (verified against `ipc.ts:62-77`).

---

## Settings "Open HUD" Button Placement (Question 8)

**Verified location:** `apps/renderer/src/screens/Settings/Settings.tsx:305-370` is the `<PluginSection>` component. It currently renders:

1. `<h2>{C.PLUGINS_HEADER}</h2>` (line 349)
2. `<div className="group-help">{C.PLUGINS_HELP}</div>` (line 350)
3. Either `<div className="placeholder-line muted">{C.PLUGINS_EMPTY}</div>` (line 352) or a `<div className="radio-group">` of `<RadioRow>` plugin selectors (lines 354-365)
4. Optional `<div className="tx-sm muted mt-2">{status}</div>` (line 367)

**Recommendation:** Add the "Open HUD" button INSIDE `<PluginSection>` directly below the radio group, before the optional status line:

```tsx
{plugins.length > 0 && (
  <div className="row mt-3" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <button
      className="btn btn-secondary"
      onClick={() => window.api?.openHud?.()}
    >
      {COPY.HUD.OPEN_HUD_BUTTON}  {/* "Open HUD" per UI-SPEC */}
    </button>
    <span className="tx-sm muted">{COPY.HUD.OPEN_HUD_HELP}</span>
  </div>
)}
{status && <div className="tx-sm muted mt-2">{status}</div>}
```

**IPC wiring:**
- `apps/electron-main/preload/index.ts` adds `openHud: (): Promise<void> => ipcRenderer.invoke('hud:open')` to the `api` object
- `apps/electron-main/preload/index.d.ts` extends the `RendererApi` type
- `apps/electron-main/src/ipc.ts` adds `ipcMain.handle('hud:open', () => createHudWindow())` inside `registerIpc(window)`
- `apps/electron-main/src/ipc.ts` cleanup section adds `ipcMain.removeHandler('hud:open')`

**Visibility gating:** Only show "Open HUD" when `plugins.length > 0` so the button appears below an actual plugin selection, not below the empty-state copy. Plan-time decision; alternative is "always show" — UI-SPEC §"Settings → Plugins-section button" frames it as a generic diagnostic affordance, so always-show may be more correct. **Recommendation: always-show** because the HUD works even without a plugin selected (system writes still flow through the compositor).

**Confidence:** HIGH (verified against Settings.tsx:305-370 and UI-SPEC §HudHeader Pre-population).

---

## Common Pitfalls

### Pitfall 1: HUD Tap Drops Frames Silently on Slow Subscriber

**What goes wrong:** A renderer that's hung (debug breakpoint, slow GC, OS scheduling lag) lets its WS recv buffer back up; the HUD `param-frame` queue at maxsize=8 starts dropping oldest. User sees stale data without knowing.

**Why it happens:** Drop-tail is the only viable backpressure strategy for a 15Hz live feed; closing the WS would lose user lock state.

**How to avoid:** Surface drop count in the footer status strip (`COPY.HUD.FOOTER_TEMPLATE` extended to `"{N} params · {M} locked · 15 Hz · {drops} drops"` when drops > 0). Alternative: emit `[HUD-TAP-DROP] subscriber=<peer> dropped_n=<count>` log.

**Warning signs:** Footer status shows non-zero drops; HUD lag visually obvious.

### Pitfall 2: BrowserWindow Created Before Renderer Bundle Is Loaded

**What goes wrong:** In dev mode (`is.dev` branch), the HUD window calls `loadURL(${ELECTRON_RENDERER_URL}#/hud)` but Vite's dev server may not have finished serving the bundle yet. Window opens with a blank white screen.

**Why it happens:** Vite dev server timing.

**How to avoid:** Use `webContents.once('did-fail-load', ...)` to retry once after 250ms in dev only. In prod (`loadFile`), this isn't an issue because the bundle is on local disk.

**Warning signs:** Blank HUD window in `npm run dev`.

### Pitfall 3: `lock_state` Survives Compositor Replacement

**What goes wrong:** If a future plan re-creates the Compositor mid-session (e.g., for a body-sway strategy hot-swap), the new compositor must receive the SAME `app.state.lock_state` reference, not a fresh dict.

**Why it happens:** Forgetting to re-pass the existing dict; constructing a fresh `lock_state = {}` inside the new instance.

**How to avoid:** `lock_state` is owned by `lifespan()`, not by `Compositor`. Compositor receives a reference; replacing the compositor uses the same reference.

**Warning signs:** User-set locks vanish silently when an unrelated runtime config change triggers compositor reconstruction.

### Pitfall 4: `param-frame` Shape Mismatch Between Sidecar and Renderer

**What goes wrong:** Sidecar emits `params: dict[str, float]` keyed by VTS tracking input names (after compositor merge), but renderer expects Cubism param IDs to match `RigCapabilities.writable_param_ids`.

**Why it happens:** The compositor's emitted `ParamFrame` (`add_params`, `set_params`) is keyed by whatever the drivers wrote, which is the post-resolve form (VTS names like `FaceAngleX`, `MouthOpen`). The renderer's HUD UI shows rows keyed by `RigCapabilities.writable_param_ids` (Cubism form like `ParamAngleX`, `ParamMouthOpenY`).

**How to avoid:** The HUD `param-frame` payload should expose values in the **Cubism form** (matching what the renderer renders). Use the inverse `_VTS_TO_CUBISM_REVERSE` map to translate VTS-form keys back to Cubism form before publishing. Some Cubism IDs (`ParamBHandIN`, `ParamJoy`) have no VTS mapping — they pass through unchanged.

**Warning signs:** HUD rows show `0.000` even though VTS is visibly animating; or HUD rows show some-but-not-all params updating.

**Resolution code (NEW in `compositor/hud_tap.py`):**

```python
def _to_hud_payload(frame: ParamFrame) -> dict[str, float]:
    """Translate compositor frame (post-resolve, VTS form) to HUD form (Cubism form)."""
    out: dict[str, float] = {}
    for key, value in frame.add_params.items():
        cubism_keys = _VTS_TO_CUBISM_REVERSE.get(key, {key})
        for ck in cubism_keys:
            out[ck] = value
    for key, (value, weight) in frame.set_params.items():
        cubism_keys = _VTS_TO_CUBISM_REVERSE.get(key, {key})
        for ck in cubism_keys:
            out[ck] = value * weight  # rough composite
    return out
```

This is approximate (ignores additive vs. set distinction) but adequate for a diagnostic HUD. Plan-time can refine if needed.

### Pitfall 5: WS Disconnection During Drag

**What goes wrong:** User drags slider; mid-drag the WS disconnects (sidecar restart, network); renderer keeps optimistic-locking but lock never reaches sidecar. On reconnect, lock state is lost.

**Why it happens:** Optimistic UI without a buffer-and-replay mechanism.

**How to avoid:** UI-SPEC IP-5 already specifies: "while disconnected, slider drags during the disconnected period buffer in renderer state but do NOT fire WS sends until reconnection". On reconnect, replay any buffered `set-lock` messages.

**Warning signs:** User locks a param, sees the visual lock, then a few seconds later a disconnect banner appears, then on reconnect the lock visual is correct but the sidecar's `lock_state` doesn't have the entry. Specifically, observe whether the `lock-confirmed` arrives.

### Pitfall 6: HUD Window Receives `before-quit` Race

**What goes wrong:** User clicks main window close (Cmd+W or X); `before-quit` fires; sidecar starts shutting down; HUD window's `/hud/ws` gets disconnected mid-message; renderer logs scary error; user closes HUD; everything quits.

**Why it happens:** Two BrowserWindows + one sidecar; quitting closes them all but in indeterminate order.

**How to avoid:** In `index.ts:113-126` `before-quit` handler, explicitly `closeHudWindow()` BEFORE `shutdownSidecar()`. The HUD window's `closed` event triggers WS unsubscribe, then sidecar shutdown is clean.

**Warning signs:** Spurious `[HUD-WS] handler error: WebSocketDisconnect` log lines on app quit.

### Pitfall 7: Codegen Drift After Adding HudMessage

**What goes wrong:** Plan adds `hud_message.py` and `__init__.py` re-exports but forgets to update `codegen.py:TARGETS` or `OWNER_FILE`. CI passes locally because `npm run codegen:contracts` was never invoked. A fresh `npm run check:contracts` in CI fails.

**Why it happens:** `check:contracts` is the gate, not `codegen:contracts`; running codegen and committing the output is required.

**How to avoid:** Make `npm run check:contracts` part of the plan's verification steps. The drift gate's failure mode is the test signal.

**Warning signs:** `git diff --exit-code` reports differences in `packages/contracts/ts/` or `packages/contracts/generated/`.

### Pitfall 8: Theme Class Not Applied to HUD Window

**What goes wrong:** Main window has `theme-midnight-sky` class on `<html>`; HUD window opens, shows light-theme defaults because `theme-provider`'s init read missed.

**Why it happens:** Each Electron BrowserWindow has its own renderer process and own DOM; `<html>` class is per-window. localStorage IS shared across same-process renderers (and Electron uses one renderer process per BrowserWindow by default with contextIsolation: true), but ThemeProvider's bootstrap may run before localStorage hydration.

**How to avoid:** UI-SPEC §"Theme harmony" already specifies the bootstrap path: HUD window reads localStorage; falls back to `theme-midnight-sky` if read fails. Plan-time: verify the `useTheme` hook works in a route mounted without `AppShell`.

**Warning signs:** HUD opens in different visual theme than the main window.

---

## Code Examples (verified patterns from existing repo)

### Example 1: Adding a WebSocket endpoint (verbatim shape from existing `/ws`)

```python
# sidecar/src/sidecar/ws/server.py:426-442 — TEMPLATE
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_json()
            await route(ws, raw)
    except WebSocketDisconnect:
        log.info("WS client disconnected.")
    except Exception:
        log.exception("WS handler error; closing connection.")
        try:
            await ws.close(code=1011)
        except Exception:
            pass
```

The new `/hud/ws` follows this pattern verbatim, with `route` replaced by `route_hud_c2s` and an additional `push_task` for the 15Hz fanout.

### Example 2: Compositor stub fixture for testing (verbatim from existing tests)

```python
# sidecar/tests/compositor/conftest.py — REUSE
class RecordingWriter:
    def __init__(self) -> None:
        self.frames: list[ParamFrame] = []
    async def inject_params(self, frame: ParamFrame) -> None:
        self.frames.append(frame)

# Phase 9 lock_filter test (NEW)
@pytest.mark.asyncio
async def test_lock_overrides_plugin_set_param(recording_writer) -> None:
    lock_state = {"ParamAngleX": 0.7}  # user locked this value
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"ParamAngleX": 0.0}),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(ParamFrame(set_params={"ParamAngleX": (0.3, 1.0)})),
        capabilities=_caps(),
        lock_state=lock_state,  # NEW
    )
    await compositor._tick(0.0)
    frame = recording_writer.frames[-1]
    assert frame.set_params["ParamAngleX"] == pytest.approx((0.7, 1.0))
    # plugin's 0.3 is overridden; idle's 0.0 in add_acc is cleared
    assert "ParamAngleX" not in frame.add_params
```

### Example 3: New Pydantic discriminated union (template from existing `Dispatch`)

See Pattern 4 above. The `Dispatch` union at `packages/contracts/py/contracts/dispatch.py:1-27` is the structural template for `HudMessageS2C` / `HudMessageC2S`.

### Example 4: Adding an admin HTTP route (template from `admin/avatar.py`)

```python
# sidecar/src/sidecar/admin/rig_capabilities.py — NEW
from fastapi import APIRouter, Request
from contracts.rig_capabilities import RigCapabilities

router = APIRouter(prefix="/admin")

@router.get("/rig-capabilities")
async def get_rig_capabilities(request: Request) -> dict:
    capabilities: RigCapabilities | None = getattr(request.app.state, "compositor", None)
    if capabilities is None:
        # Boot-degraded path; same shape as orchestrator-None case
        return RigCapabilities().model_dump(mode="json")
    caps = request.app.state.compositor._capabilities  # already constructed
    excluded = hud_excluded_param_ids(caps.writable_param_ids)
    return {
        **caps.model_dump(mode="json"),
        "hud_excluded_param_ids": sorted(excluded),
    }
```

Then in `server.py:445-449`:
```python
from .admin import rig_capabilities as admin_rig_capabilities  # noqa: E402
app.include_router(admin_rig_capabilities.router)
```

### Example 5: Renderer hook pattern (verbatim from existing `useStreamingMessages`)

The `apps/renderer/src/state/` directory contains the existing hook patterns; `useHudStream` follows the same shape: an effect that opens a WS on mount, returns a cleanup, exposes state via `useState`/`useReducer`.

---

## State of the Art

No technology shifts since the locked CLAUDE.md stack (May 2026). All recommendations align with that stack. Specific Phase 9 considerations:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HUD with override-badge UX | HUD-exclusion (D-B3) — designed-out conflict | 2026-05-08 (this discuss-phase) | Plan-phase MUST NOT expose `MouthOpen`; tests assert exclusion |
| HUD lock state persisted across sessions | Session-only (HUD-07) | At v2.0 design | No `electron-store` integration; D-A4 also opts out of window pos/size |
| Detachable HUD inside main window | Separate BrowserWindow (D-A1) | 2026-05-08 (this discuss-phase) | New `apps/electron-main/src/hud-window.ts`; new `'hud:open'` IPC channel |
| HUD `ranges` field name in REQUIREMENTS | Actual Pydantic field is `param_ranges` (rig_capabilities.py:21) | At Phase 8 land time | Plan-phase MUST use `param_ranges` to avoid runtime AttributeError |
| `RigCapabilities.writable_param_ids` includes `MouthOpen` AND `ParamMouthOpenY` separately | Yes — the rig has both forms in source files | At Phase 8 land time | HUD-exclusion handles both via the inverse-mapping helper |

**Deprecated/outdated:**
- `lock-rejected` toast UX: superseded by D-D1 + D-C5 (designed-out, ERROR-log only)
- "Override-badge" UX from original HUD-06 wording: superseded by HUD-exclusion (HUD-06 amendment 2026-05-08)
- HUD as 4th tab in BottomRail: superseded by D-A1 separate-window choice

---

## Open Questions

1. **Should the `param-frame` payload include only HUD-visible params (post-exclusion), or all writable params?**
   - What we know: D-C4 says "all currently-relevant params". UI-SPEC's `<HudParamRow>` only renders HUD-visible params.
   - What's unclear: if the sidecar pre-filters, the payload is smaller; if the renderer filters, the sidecar payload doubles as a debug surface.
   - Recommendation: sidecar pre-filters (smaller payload, single source of truth on exclusion). Plan-phase decides; either is acceptable.

2. **Should the HUD `param-frame` push frequency be configurable via env var, or hardcoded at 15Hz?**
   - What we know: 15Hz is the default; 30Hz fallback is a contingency.
   - What's unclear: whether perceptual benchmark on Teto rig will show stutter.
   - Recommendation: hardcode 15Hz for v1; add an env var only if a benchmark requires it. Footer status copy `"15 Hz"` becomes parametric on first reconfigure.

3. **Should `set_lock` automatically include the param's `value` from a prior `param-frame`, or require the renderer to send the exact slider value?**
   - What we know: D-C3 schema is `set-lock(param_id, value)` with explicit value.
   - What's unclear: edge case where renderer's last-known value is slightly stale (15Hz quantization) and user clicks lock-toggle to engage at the displayed value.
   - Recommendation: renderer sends the displayed value; sidecar accepts and confirms. Per UI-SPEC IP-2 the lock auto-engages on drag, not on toggle click — so the drag value IS the engagement value.

4. **Should the `/admin/rig-capabilities` endpoint live in a new `admin/rig_capabilities.py` file or be added to `admin/avatar.py`?**
   - What we know: existing pattern is one router file per admin concern.
   - Recommendation: new file (cleaner separation; `avatar` is import-flow, `rig-capabilities` is a static-per-session diagnostic surface).

5. **Should the lock_state dict be serialized to disk (e.g., for crash recovery) within a single session, even though HUD-07 says no cross-session persistence?**
   - What we know: HUD-07 says "session-only".
   - Recommendation: NO. Even within-session crash recovery is a complication beyond v1 scope. App restart = lock cleared, end of story.

6. **For the renderer test of `<HudParamRow>` slider drag interaction, can vitest + jsdom adequately simulate `pointermove` events?**
   - What we know: `@testing-library/react` + jsdom can do `fireEvent.pointerDown`, `fireEvent.pointerMove`, `fireEvent.pointerUp`.
   - What's unclear: whether jsdom's `<input type="range">` correctly responds to pointer events in the test environment.
   - Recommendation: check during plan-phase by writing a smoke test; if jsdom is inadequate, the integration test runs in a real Electron renderer.

7. **Plugin's `[joy]` action triggers the default plugin to write to `ParamHeartEyeR` etc. via plugin output (Phase 6). Should those be lockable?**
   - What we know: `RigCapabilities.writable_param_ids` includes them; `SYSTEM_PRIMITIVE_OVERRIDES` does not.
   - Recommendation: YES, lockable. The whole point of HUD locks is to override LLM/plugin-driven motion. ARCH-12 keeps the override list at one entry; everything else is HUD-controllable.

---

## Environment Availability

> Phase 9 is purely code/config additions. No new external tools, services, runtimes, or CLI utilities are introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| FastAPI | `/hud/ws` + `/admin/rig-capabilities` | ✓ | 0.136.1 (locked) | — |
| Uvicorn | ASGI host | ✓ | 0.46.0 (locked) | — |
| Pydantic | HudMessage source-of-truth | ✓ | 2.x | — |
| `json-schema-to-typescript` | TS codegen | ✓ | 15.0.4 | — |
| Electron | new BrowserWindow | ✓ | 40.x | — |
| React | renderer | ✓ | 19.2.x | — |
| Vitest | renderer tests | ✓ | 4.1.5 | — |
| pytest + pytest-asyncio | sidecar tests | ✓ | (existing) | — |
| `@testing-library/react` + jsdom | renderer interaction tests | ✓ | 16.3.2 / 29.1.1 | — |
| VTube Studio (running, authenticated) | NOT required for HUD; required only for compositor inject_params | ✓ when user runs it | 1.32.71 | HUD displays last-known params; locks still take effect on next inject |
| pyvts | already vendored, used by writer | ✓ | 0.3.3 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

**Backend (sidecar):**
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio (existing in `sidecar/pyproject.toml`) |
| Config file | `sidecar/pyproject.toml` (pytest config in `[tool.pytest.ini_options]`) |
| Quick run command | `cd sidecar && uv run pytest tests/compositor tests/ws -x` |
| Full suite command | `cd sidecar && uv run pytest -x` |

**Renderer (apps/renderer):**
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 + @testing-library/react 16.3.2 + jsdom 29.1.1 (existing in `apps/renderer/package.json`) |
| Config file | `apps/renderer/vite.config.*` (see Wave 0 — no separate vitest config; vite.config inherits) |
| Quick run command | `cd apps/renderer && npm run test -- HUD` |
| Full suite command | `cd apps/renderer && npm run test` |

**Contracts (codegen drift gate):**
| Property | Value |
|----------|-------|
| Framework | pytest (in `packages/contracts/tests/`) + npm script |
| Quick run command | `npm run check:contracts` |
| Full suite command | `npm run check:contracts && cd packages/contracts && uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HUD-01 | `/hud/ws` opens on connect, closes on disconnect | integration | `pytest sidecar/tests/ws/test_hud_ws.py::test_hud_ws_opens_and_closes -x` | ❌ Wave 0 |
| HUD-02 | Compositor emits HUD frames at 15Hz cadence | unit | `pytest sidecar/tests/compositor/test_hud_tap.py::test_decimation_15hz -x` | ❌ Wave 0 |
| HUD-03 | `RigCapabilities.writable_param_ids - SYSTEM_PRIMITIVE_OVERRIDES` is the visible list | unit | `pytest sidecar/tests/compositor/test_lock_filter.py::test_hud_excluded_param_ids -x` | ❌ Wave 0 |
| HUD-03 | Renderer renders `<HudParamRow>` per visible param with bounded slider | unit (renderer) | `cd apps/renderer && npm run test -- HudParamRow` | ❌ Wave 0 |
| HUD-04 | `set-lock(param_id, value)` mutates `compositor.lock_state` and confirms | integration | `pytest sidecar/tests/ws/test_hud_lock_roundtrip.py::test_set_lock_persists -x` | ❌ Wave 0 |
| HUD-04 | Renderer slider drag fires `set-lock` over WS | unit (renderer) | `cd apps/renderer && npm run test -- HudSlider` | ❌ Wave 0 |
| HUD-05 | Compositor merge applies locks LAST; lock holds against plugin set_params | unit | `pytest sidecar/tests/compositor/test_compositor.py::test_lock_overrides_plugin -x` | ❌ Wave 0 |
| HUD-06 | `MouthOpen` and `ParamMouthOpenY` both excluded from HUD payload | unit | `pytest sidecar/tests/compositor/test_lock_filter.py::test_mouth_excluded_in_both_namespaces -x` | ❌ Wave 0 |
| HUD-07 | App restart clears all lock state (process-memory only) | integration | `pytest sidecar/tests/ws/test_hud_session_only.py::test_lock_state_not_persisted -x` | ❌ Wave 0 |
| HUD-08 | `GET /admin/rig-capabilities` returns the rig payload synchronously | integration | `pytest sidecar/tests/admin/test_rig_capabilities_endpoint.py::test_get_returns_payload -x` | ❌ Wave 0 |
| Codegen | HudMessage S2C/C2S generated TS files exist and match Pydantic | unit | `cd packages/contracts && uv run pytest tests/test_codegen.py::test_hud_message_generated -x` | ❌ Wave 0 |
| Codegen drift | `npm run check:contracts` passes | integration | `npm run check:contracts` | ✅ existing |

### Sampling Rate

- **Per task commit:** `cd sidecar && uv run pytest tests/compositor tests/ws -x` (sub-15s) + `cd apps/renderer && npm run test -- HUD` (sub-30s)
- **Per wave merge:** `cd sidecar && uv run pytest -x` + `cd apps/renderer && npm run test` + `npm run check:contracts`
- **Phase gate:** Full suite green + manual smoke (open HUD, drag slider, observe Teto, click unlock)

### Wave 0 Gaps

- [ ] `sidecar/tests/ws/test_hud_ws.py` — covers HUD-01 (WS lifecycle) — NEW directory `tests/ws/` if absent
- [ ] `sidecar/tests/compositor/test_hud_tap.py` — covers HUD-02 (decimation cadence)
- [ ] `sidecar/tests/compositor/test_lock_filter.py` — covers HUD-03 + HUD-06 (exclusion + namespace coverage)
- [ ] `sidecar/tests/compositor/test_compositor.py` extension — covers HUD-05 (lock-overrides-plugin merge order)
- [ ] `sidecar/tests/ws/test_hud_lock_roundtrip.py` — covers HUD-04 (set-lock end-to-end)
- [ ] `sidecar/tests/ws/test_hud_session_only.py` — covers HUD-07 (no persistence)
- [ ] `sidecar/tests/admin/test_rig_capabilities_endpoint.py` — covers HUD-08 — NEW directory `tests/admin/` if absent
- [ ] `apps/renderer/tests/HUD.test.tsx` — covers HUD-03/HUD-04 renderer side
- [ ] `apps/renderer/tests/HudParamRow.test.tsx` — slider+lock-toggle interactions
- [ ] `packages/contracts/tests/test_codegen.py` extension — assert HudMessage* generated outputs (mirror existing `test_generated_outputs_export_default_plugin_action_binding`)
- [ ] `packages/contracts/py/contracts/hud_message.py` — Pydantic source (covered by NEW model + register in TARGETS)
- [ ] Renderer `vite.config.ts` — verify it has `test: { environment: 'jsdom' }` config; if not, add (existing tests in `apps/renderer/tests/` work, so likely already configured)

---

## Sources

### Primary (HIGH confidence — verified by reading the file)

- `sidecar/src/sidecar/compositor/lock_filter.py` (1-8) — current `SYSTEM_PRIMITIVE_OVERRIDES` shape
- `sidecar/src/sidecar/compositor/param_id_resolver.py` (1-75) — `_VTS_INPUT_PARAM_MAP` forward direction; `VTS_TRACKING_INPUT_PARAM_IDS` set; range table
- `sidecar/src/sidecar/compositor/compositor.py` (1-124) — Compositor class, merge order, _tick structure, TICK_HZ=60
- `sidecar/src/sidecar/compositor/clamp.py` (1-80) — clamp_and_validate, range enforcement
- `sidecar/src/sidecar/compositor/__init__.py` (1-19) — package exports
- `sidecar/src/sidecar/ws/server.py` (1-449) — lifespan, app state pattern, /ws endpoint shape, /admin/* router include
- `sidecar/src/sidecar/admin/avatar.py` (1-172) — admin router shape, request/response patterns
- `sidecar/src/sidecar/avatar/rig_capabilities.py` (1-71) — RigCapabilities builder + tag_vocabulary monkey-patch
- `sidecar/src/sidecar/vts/pyvts_writer.py` (1-202) — single VTS writer, ARCH-06 compliance reference
- `sidecar/tests/compositor/conftest.py` (1-55) — RecordingWriter, StubDriver, StubPluginDriver fixtures
- `sidecar/tests/compositor/test_compositor.py` (1-60) — Compositor test pattern
- `sidecar/tests/avatar/test_reimport.py` (1-56) — avatar re-import flow
- `apps/electron-main/src/index.ts` (1-127) — main process bootstrap, createWindow template
- `apps/electron-main/src/ipc.ts` (1-104) — IPC handler registration pattern, restartSidecar use, removeHandler cleanup
- `apps/electron-main/src/sidecar.ts` (1-315) — sidecar lifecycle, restartSidecar(), getSidecarHttpUrl, listBodyMotionPlugins
- `apps/electron-main/preload/index.ts` (1-62) — contextBridge `window.api` surface
- `apps/renderer/src/App.tsx` (1-43) — top-level branching, ThemeProvider+AppStoreProvider tree
- `apps/renderer/src/main.tsx` (1-13) — root mount
- `apps/renderer/src/screens/Settings/Settings.tsx` (1-653) — Settings layout, PluginSection placement, anchor pattern
- `apps/renderer/src/state/app-store.tsx` (1-244) — useStore, view enum, toasts, pushToast access
- `apps/renderer/src/state/route-store.ts` (1-37) — Route enum (`'chat' | 'agent' | 'settings' | 'avatar-import'` — note: needs adding `'hud'` if route-store is used for HUD; OR use hash-based detection per recommendation)
- `apps/renderer/tests/Settings.test.tsx` (1-92) — vitest+RTL pattern; how `window.api` is mocked
- `packages/contracts/py/contracts/__init__.py` (1-65) — re-export pattern
- `packages/contracts/py/contracts/dispatch.py` (1-27) — Annotated Union with Field(discriminator) template
- `packages/contracts/py/contracts/ws_message.py` (1-81) — discriminated union template for HudMessage
- `packages/contracts/py/contracts/rig_capabilities.py` (1-27) — RigCapabilities Pydantic shape (note `param_ranges` not `ranges`)
- `packages/contracts/scripts/codegen.py` (1-318) — codegen flow, TARGETS list, OWNER_FILE map, post_process pipeline
- `packages/contracts/tests/test_codegen.py` (1-98) — codegen-output assertion pattern
- `package.json` (1-26) — root scripts, devDependencies, workspace layout
- `apps/renderer/package.json` (1-26) — react/vitest versions
- `.planning/phases/09-slider-hud-per-param-lock/09-CONTEXT.md` (1-164) — D-A1..D-D3 + Specifics + Deferred Ideas
- `.planning/phases/09-slider-hud-per-param-lock/09-UI-SPEC.md` (1-487) — visual + interaction contract
- `.planning/REQUIREMENTS.md` HUD-01..HUD-08 (lines 115-122) — phase-09 requirement IDs + amendments
- `.planning/REQUIREMENTS.md` ARCH-05/06/12 (lines 67-74) — compositor merge order, single pyvts writer, system-primitive override list
- `.planning/ROADMAP.md` Phase 9 section (lines 232-253) — Goal + Success Criteria + Open Questions
- `CLAUDE.md` Tech Stack section — locked stack table

### Secondary (MEDIUM confidence — pattern-matched against existing implementations)

- `sidecar/tests/avatar/test_admin_avatar.py` — admin endpoint test pattern (file glob found; not opened — pattern inferred from `test_reimport.py`)
- `apps/renderer/tests/AvatarImport.test.tsx` — renderer integration test pattern (file glob found; not opened)

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All packages already in repo, locked by CLAUDE.md, version-pinned |
| Architecture (Compositor lock integration) | HIGH | Read compositor.py, clamp.py, lock_filter.py, ARCH-05 spec — consistent |
| Architecture (FastAPI dual-WS) | HIGH | Verified canonical FastAPI pattern + read existing /ws |
| Architecture (Electron multi-window) | HIGH | Verified existing createWindow shape + canonical Electron pattern |
| Architecture (Codegen integration) | HIGH | Read codegen.py end-to-end + verified Dispatch as structural template |
| HUD-exclusion namespace mapping | HIGH | Read both lock_filter.py and param_id_resolver.py; recommendation derives from observed code |
| 15Hz tap implementation | HIGH | Read Compositor._tick; option (a) is the minimal-diff path |
| Avatar re-import lock-clear | HIGH | Read ipc.ts:74 — confirms restartSidecar() = wholesale process restart |
| Settings button placement | HIGH | Read Settings.tsx PluginSection 305-370 |
| Pitfalls (Pitfall 4 — VTS↔Cubism payload mismatch) | MEDIUM | Logical deduction from observed code — not yet manifested as a bug |
| Pitfalls (Pitfall 8 — theme class) | MEDIUM | UI-SPEC documents the path but plan-phase verification needed |
| Renderer test environment (slider drag) | MEDIUM | jsdom limitations not directly verified for `<input type="range">` pointer events |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified in tree
- Architecture: HIGH — every contract anchor (compositor merge order, single writer, codegen pipeline, lifespan pattern, multi-window) read from source
- Pitfalls: HIGH for race/lifecycle pitfalls (#1, #3, #5, #6, #7); MEDIUM for namespace pitfall (#4) and theme pitfall (#8) which require plan-time verification

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days — stable infrastructure, no fast-moving deps)
