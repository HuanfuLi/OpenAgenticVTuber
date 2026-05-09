# Phase 9: Slider HUD + Per-Param Lock - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning (UI-phase recommended before plan-phase)

<domain>
## Phase Boundary

User opens a HUD (separate Electron BrowserWindow) via Settings → "Open HUD"; HUD shows a scrollable list of writable rig params (excluding params that the sidecar's system primitive layer owns, such as `MouthOpen` for lipsync); user drags any slider and the lock auto-engages, holding the param value against LLM-driven `{variant}` / `<event>` writes via compositor 60Hz re-injection; lock persists until the user explicitly clicks the lock toggle off. `/hud/ws` opens lazily on HUD window mount and closes on unmount. Lock state is session-only and cleared on avatar re-import.

**NOT in scope:**
- Lock persistence across sessions (HUD-07 forbids it)
- Lock import/export
- Multiple rigs in one HUD
- HUD UI visual style (covered in `/gsd:ui-phase 9`)

</domain>

<decisions>
## Implementation Decisions

### A. HUD Window Topology

- **D-A1:** HUD lives in a **separate Electron BrowserWindow**, not a tab inside the main AppShell. The same renderer bundle loads the `/hud` route; the new window is created from `electron-main` on user action.
- **D-A2:** Entry point is a **"Open HUD" button in the Settings screen** — same section as the existing Phase 6 "Body motion plugin" radio group is a natural neighbor. No BottomRail tab change. No global hotkey for v1.
- **D-A3:** Window default behavior is **focused-only top-most** (Electron BrowserWindow default; do NOT call `setAlwaysOnTop`). When the user clicks back to VTube Studio, the HUD recedes; when the user wants to read it, they click on it.
- **D-A4:** Window position and size are **NOT persisted** across launches — every fresh open uses default size, OS-default placement. Aligns with the "discovery tool, not persistent preference" framing of HUD-07.

### B. Lock × variant / event Interaction

- **D-B1:** **Lock wins** against LLM-driven `{variant}` / `<event>` writes. Mechanism: compositor runs at 60Hz, `lock_filter` is the last contributor before `clamp_and_validate` and `inject_params`; the locked value is re-injected every tick, so even when VTS-internal expression activation tries to drive the param, our continuous re-injection dominates.
- **D-B2:** **No "variant overriding" badge.** lock-vs-variant is not a conflict that the user needs visualized — lock is doing its job. The badge UX from the original ROADMAP draft (override-badge for "lipsync overriding") is removed entirely; see D-B3 for why.
- **D-B3:** **HUD does NOT expose params the user cannot meaningfully lock.** The HUD slider list is derived as `RigCapabilities.writable_param_ids - keys(compositor/lock_filter.py:SYSTEM_PRIMITIVE_OVERRIDES)`. Any param the system primitive layer owns is hidden from the HUD entirely. This makes lock-override conflicts impossible by construction rather than handling them with badge UX.
- **D-B4:** **`SYSTEM_PRIMITIVE_OVERRIDES` semantics extended.** The dict in `compositor/lock_filter.py` was originally just "params where lipsync wins over user lock during compositor merge". It now also serves as the HUD-exclusion source. Single source of truth, no second list.
- **D-B5:** **ARCH-12 list itself stays at one entry (`MouthOpen`).** variant / event do NOT enter this list because they don't go through compositor merge — they're VTS-internal writes that lock_filter naturally beats via 60Hz re-injection.

### C. HudMessage Contract Shape

- **D-C1:** **HudMessage joins the Phase 7 codegen pipeline.** The same JSON Schema → Python (Pydantic) + TS generation that produces `Dispatch` will produce HudMessage. Contract drift is caught by `npm run check:contracts`.
- **D-C2:** **Type is split by direction** — `HudMessageS2C` (server-to-client) and `HudMessageC2S` (client-to-server) are separate union types. TS / mypy refuses to compile a server-side `send(hudMessageC2S)` mistake. The split is recorded in the schema's `oneOf` discriminator pattern.
- **D-C3:** **Five message kinds:**
  - S2C: `param-frame`, `lock-confirmed`, `lock-rejected`
  - C2S: `set-lock`, `clear-lock`
- **D-C4:** **`param-frame` is a full snapshot every 15 Hz tick** — `{param_id: value}` for all currently-relevant params plus a `locked_ids: list[str]` field. No delta encoding. ~24-96 KB/s on localhost is irrelevant.
- **D-C5:** **`lock-rejected` is retained but never surfaces in UI.** It exists as an ERROR-log channel for code-bug detection (e.g., the renderer somehow tries to lock a param not in `RigCapabilities`). The UX path is "this rejection is impossible by construction"; if it fires, it's a bug, not a user message.

### D. Lock Boundary Behaviors

- **D-D1:** **Reject is designed out**, not handled with toast. HUD only renders param IDs from `RigCapabilities.writable_param_ids` (post-exclusion); slider value range is clamped to `RigCapabilities.ranges[param_id]`. Any value the renderer can possibly send is therefore valid for the sidecar to accept. `lock-rejected` is the assertion channel (D-C5), not an UX path.
- **D-D2:** **Lock lifetime: drag-engage, manual-disengage.** User drags a slider → lock auto-engages on first non-trivial drag movement. Releasing the mouse does NOT release the lock. The lock persists until the user explicitly clicks the row's lock toggle off (or until avatar re-import / app restart). Use case: drag to a value, observe how other drivers behave around it for several seconds, drag again or click unlock when done.
- **D-D3:** **Avatar re-import clears all locks.** When `RigCapabilities` changes mid-session (Phase 8 supports re-import), the sidecar wipes `lock_state` entirely and the renderer's HUD shows a toast informing the user. Cleaner than partial-pruning by writability — we don't pretend to know whether ParamX-on-rig-A has the same semantic meaning as ParamX-on-rig-B.

### Folded Todos

None — todo match-phase returned 0 matches.

### Claude's Discretion (UI-phase territory)

- HUD window size defaults (suggest ~400x600, plan-phase researcher to verify against Hiyori/Mark sample param counts)
- Slider visual style (match Settings section sliders or distinct "diagnostic" feel)
- Lock toggle visual (icon vs label vs colored row)
- Sort order of the param list (alphabetic by ID vs canonical Live2D order vs animating-first)
- Display name resolution (use `RigCapabilities.cdi3_display_names` when present, fall back to param ID)
- Empty-state copy when filtered list is empty
- Toast styling for "avatar changed, locks cleared"

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Invariants (REQUIREMENTS.md)
- `.planning/REQUIREMENTS.md` §AVT-01 — 60Hz compositor; sidecar→VTS direct; HUD must NOT break this
- `.planning/REQUIREMENTS.md` §AVT-04 — single pyvts writer (carried into ARCH-06)
- `.planning/REQUIREMENTS.md` §ARCH-01 — system owns LLM + VTS contracts; plugin owns motion contract
- `.planning/REQUIREMENTS.md` §ARCH-02 — `RigCapabilities` is the rig-introspection contract (defined in Phase 8)
- `.planning/REQUIREMENTS.md` §ARCH-05 — fixed compositor merge order: `Idle → Speech → Plugin → Cursor → system-primitive override → lock_filter → clamp → pyvts.inject_params`
- `.planning/REQUIREMENTS.md` §ARCH-06 — single pyvts writer rule (HUD lock writes go through `PyvtsSafeWriter`); CI guarded by `tests/test_arch06_single_writer.py`
- `.planning/REQUIREMENTS.md` §ARCH-12 — system-primitive override list (now ALSO the HUD-exclusion source per 2026-05-08 amendment)
- `.planning/REQUIREMENTS.md` §HUD-01..HUD-08 — Phase 9 requirements (HUD-03 / HUD-05 / HUD-06 amended 2026-05-08 by this discuss-phase)

### Roadmap
- `.planning/ROADMAP.md` §"Phase 9: Slider HUD + Per-Param Lock" — Goal + SCs (rewritten 2026-05-08 by this discuss-phase)
- `.planning/ROADMAP.md` Open questions to resolve at plan-time — HUD throttle rate, filter defaults, HUD-exclusion namespace resolution

### Prior Phase Context
- `.planning/phases/08-avatar-import-catalogs/08-CONTEXT.md` D-A1.1 — `RigCapabilities` shape (the single contract HUD consumes)
- `.planning/phases/06-plugin-runtime-default-plugin/06-CONTEXT.md` — ARCH-05/06 + plugin runtime that produces ParamFrame on the merge path
- `.planning/phases/07-three-category-code-parsing-dispatch/07-CONTEXT.md` — Dispatch codegen pipeline (HudMessage joins this); event-completion tracker is observable for future "event-in-flight" badge work but NOT consumed by this phase

### Code Anchors
- `sidecar/src/sidecar/compositor/lock_filter.py` — `SYSTEM_PRIMITIVE_OVERRIDES` dict; both compositor-merge override semantics AND HUD-exclusion source
- `sidecar/src/sidecar/compositor/compositor.py` — 60Hz tick loop; lock_filter is the last contributor before clamp + inject
- `sidecar/src/sidecar/compositor/param_id_resolver.py` — VTS-tracking-input ↔ Cubism-param mapping; needed to resolve HUD-exclusion namespace
- `sidecar/src/sidecar/compositor/clamp.py` — `writable_param_ids ∪ VTS_TRACKING_INPUT_PARAM_IDS` is the validated write surface
- `sidecar/src/sidecar/avatar/rig_capabilities.py` — RigCapabilities builder (`writable_param_ids`, `ranges`, `cdi3_display_names`)
- `sidecar/src/sidecar/ws/server.py` — existing `/ws` FastAPI endpoint pattern; new `/hud/ws` follows the same shape
- `apps/electron-main/src/sidecar.ts` — main process; the new HUD BrowserWindow is created here
- `apps/renderer/src/screens/Settings/Settings.tsx` — host of the new "Open HUD" button
- `apps/renderer/src/screens/AvatarImport/AvatarImport.tsx` — precedent for a dedicated React route (Phase 8)
- `packages/contracts/` and Phase 7 codegen pipeline — HudMessage contracts plug in here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`PyvtsSafeWriter`** (`sidecar/src/sidecar/vts/pyvts_writer.py`): The single VTS API client; HUD lock writes flow through `inject_params` already in the compositor path — Phase 9 doesn't add a second writer.
- **`Compositor` 60Hz loop** (`sidecar/src/sidecar/compositor/compositor.py`): already wires `idle → speech → plugin → cursor` and applies clamp before inject; `lock_filter` slot already exists in the merge order per ARCH-05; Phase 9 implements the actual `LockState` data structure and the dict-lookup that filter consults.
- **`SYSTEM_PRIMITIVE_OVERRIDES`** (`sidecar/src/sidecar/compositor/lock_filter.py`): one-line dict already exists with `MouthOpen → "lipsync owns..."`. Phase 9 adds a derived helper that yields the HUD-exclusion set (resolver-mapped to Cubism names where applicable).
- **`RigCapabilities`** (`contracts/rig_capabilities.py` + `sidecar/src/sidecar/avatar/rig_capabilities.py`): Phase 8 frozen contract; `writable_param_ids`, `ranges`, `cdi3_display_names` all already present.
- **Phase 7 codegen pipeline**: `Dispatch` types are generated end-to-end; `npm run check:contracts` is the drift gate. HudMessageS2C / HudMessageC2S add to the same pipeline.
- **`AvatarImport` screen** (`apps/renderer/src/screens/AvatarImport/`): precedent for a dedicated React route; the HUD route reuses the same pattern but lives in a separate BrowserWindow.
- **Existing `/ws` endpoint** (`sidecar/src/sidecar/ws/server.py:361`): pattern to follow for `/hud/ws`; lazy lifecycle (open on connect, close on disconnect) is already the FastAPI default.
- **Settings screen** (`apps/renderer/src/screens/Settings/Settings.tsx` + `sections/`): host for the "Open HUD" button; Phase 6 already added a "Body motion plugin" section here.
- **`electron-store`** (used by Phase 1 for window pos/size): NOT used in Phase 9 — D-A4 explicitly opts out of HUD position persistence.

### Established Patterns

- **Sidecar-side single-source-of-truth, renderer optimistic UI**: every prior phase that has user-mutable state (LLMSetup config, avatar selection, plugin selection) follows this. HUD locks follow the same shape — renderer fires `set-lock`, sidecar holds the truth, next `param-frame` either confirms or silently drops.
- **Lazy WebSocket open**: `/ws` opens on first message; `/hud/ws` follows.
- **Codegen-generated TS+Python contracts** (Phase 5 + Phase 7): the rule for new wire-protocol messages is "add it to codegen", not "hand-write the TS mirror".
- **Dedicated route for non-trivial workflows**: AvatarImport (Phase 8) set the precedent for dedicated React routes; HUD reuses the route pattern but in a separate BrowserWindow.

### Integration Points

- `electron-main` adds a new IPC channel `hud:open` invoked by the Settings button. Handler creates a new `BrowserWindow` loading the renderer bundle with route hash `#/hud`. Window destruction is fire-and-forget; sidecar's `/hud/ws` closes naturally on WS disconnect.
- `Compositor.__init__` accepts a new `lock_state: dict[str, float]` argument (or compositor owns the state and exposes a setter); `lock_filter` consults it during merge.
- `ws/server.py` adds the `@app.websocket("/hud/ws")` endpoint; it consumes `HudMessageC2S` and emits `HudMessageS2C` from a 15Hz throttle worker that taps the compositor's emit step.
- `RigCapabilities` consumers add a derived `hud_visible_param_ids` accessor (or the HUD endpoint computes it inline) — single rule, single place.
- Phase 8 avatar re-import flow grows a "clear all locks" hook called by the orchestrator on `RigCapabilities` reload.

</code_context>

<specifics>
## Specific Ideas

- **HUD as separate window, not modal**: the user explicitly chose "独立浮动窗口" over "主窗口内 4th tab" or "detachable" — emphasizes that HUD is a side-by-side diagnostic surface, intended to be visible alongside VTube Studio, not a workflow that takes over the chat surface.
- **"Lock means lock" principle (from user pushback during Area B)**: when the user said "如果用户override不生效，让系统赢了，那用户还override个啥啊", the implicit principle is that lock UX should be honest. We honored this by (a) extending lock to win against variant/event via 60Hz re-injection, and (b) hiding from the HUD any param the user genuinely cannot lock. There is no half-functional lock anywhere in the design.
- **Reject path is a code-bug channel, not UX**: per D-D1 + D-C5, the design should make `lock-rejected` impossible to fire through the normal user path. If it ever fires in production, it's a bug worth investigating, not a UX edge case to handle.

</specifics>

<deferred>
## Deferred Ideas

- **Event-in-flight badge** (Phase 7 CONTEXT.md L605 forward-compat): HUD MAY consume `EventCompletionTracker` to show "event playing" badges per row. NOT in Phase 9 — would require additional WS messages and a UX design pass. Revisit in a polish phase.
- **Lock import / export**: explicitly out of scope (HUD-07 says session-only). If users later request "save my favorite poses", that's a separate feature.
- **HUD inside the main window (detachable)**: rejected for v1 in favor of the cleaner "always-separate-window" choice. Not lost — if user feedback later shows they want a sidebar, this is a viable change.
- **HUD-side LLM prompt suggestion** ("don't drive these locked params"): explicitly rejected — HUD does not write LLM context. Belongs in a future prompt-engineering phase if at all.
- **Filter chips / sort dropdown**: ROADMAP open question (filter set for writable / animating / locked). Plan-phase decides; UI-phase designs visual layout. Default is "all three filters on, alphabetic sort"; UI-phase can adjust.
- **HUD throttle rate tuning**: 15 Hz default; 30 Hz fallback if perceptual benchmark shows stutter. Plan-phase researcher may run a quick benchmark.

</deferred>

---

*Phase: 09-slider-hud-per-param-lock*
*Context gathered: 2026-05-08*
