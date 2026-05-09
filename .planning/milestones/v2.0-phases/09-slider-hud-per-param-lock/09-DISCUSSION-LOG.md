# Phase 9: Slider HUD + Per-Param Lock - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 09-slider-hud-per-param-lock
**Areas discussed:** A (HUD topology), B (Lock × variant/event), C (HudMessage shape), D (Lock boundary behaviors)

---

## A. HUD Window Topology

### A1. Window topology

| Option | Description | Selected |
|--------|-------------|----------|
| Independent floating window | Separate Electron BrowserWindow, always-on-top, owns its position/size. ROADMAP-recommended | ✓ |
| In-shell 4th tab | BottomRail grows from 3 to 4 tabs; HUD is a route inside main window | |
| In-shell + detachable | Default in-shell with "detach to floating window" affordance | |

**User's choice:** Independent floating window
**Notes:** User wanted clear separation from main shell; HUD intended to coexist with VTube Studio.

### A2. Entry point

| Option | Description | Selected |
|--------|-------------|----------|
| BottomRail 4th tab | New nav tab next to Chat / Agent / Settings | |
| Settings "Open HUD" button | Discoverable through Settings; aligns with existing Phase 6 "Body motion plugin" section | ✓ |
| Global hotkey (Ctrl+Shift+H) + Settings button | Keyboard-first with discoverability fallback | |

**User's choice:** Settings "Open HUD" button
**Notes:** Doesn't perturb the BottomRail spec; HUD lives near plugin selection, semantically related.

### A3. Always-on-top behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always on top | `setAlwaysOnTop(true)` permanent | |
| Configurable, default on top | pin/unpin toggle persisted to electron-store | |
| Top-most while focused | Default Electron BrowserWindow behavior | ✓ |

**User's choice:** Top-most while focused
**Notes:** Simpler implementation; user can still bring HUD forward by clicking it.

### A4. Window position/size persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Persist position + size | electron-store key for x/y/w/h | |
| Persist size only | Center-on-primary-monitor + remembered size | |
| No persistence | Default position + default size on every launch | ✓ |

**User's choice:** No persistence
**Notes:** Aligns with HUD-07's "discovery tool, not persistent preference" framing.

---

## B. Lock × variant / event Interaction

### B1. (initial framing) Lock vs variant — who wins?

This question was reformulated mid-discussion based on user feedback. The user objected to options that proposed "variant wins" — "如果用户override不生效，让系统赢了，那用户还override个啥啊".

Reformulated to: given lock-wins-via-60Hz-reinjection is the intent, do we need an override-badge for variant/event?

| Option | Description | Selected |
|--------|-------------|----------|
| No badge anywhere | Lock wins silently; override-badge UX only for the existing MouthOpen-during-lipsync case | ✓ (then superseded — see B3) |
| Add "variant suppressed" indicator | Row shows small icon when variant tried to drive a locked param | |
| Reverse-inject lock state into LLM system prompt | Out of scope for Phase 9 | |

**User's choice:** No badge anywhere

### B2. Should ARCH-12 SYSTEM_PRIMITIVE_OVERRIDES list be extended in Phase 9?

| Option | Description | Selected |
|--------|-------------|----------|
| No, keep MouthOpen only | List semantics stays "params overridden in our compositor merge path"; variant/event don't go through this path so don't qualify | ✓ |
| Add "hard / soft" subdivision | hard = MouthOpen (lipsync wins); soft = lock-attempt-to-block-variant tracking | |

**User's choice:** No, keep MouthOpen only

### B3. (added by user pushback) HUD-exclusion principle

After B1+B2 settled, user said: "如果有什么参数用户不能override，那就不要在hud中暴露出来"

This established a new principle that supersedes the override-badge UX entirely:

- HUD list = `RigCapabilities.writable_param_ids - keys(SYSTEM_PRIMITIVE_OVERRIDES)`
- Override-badge UX (HUD-06) is voided and rewritten as a HUD-exclusion rule
- ROADMAP Phase 9 SC #3 (which described locking MouthOpenY and seeing badge) is rewritten — the demo doesn't exist
- `SYSTEM_PRIMITIVE_OVERRIDES` semantics extended: dual-purpose as both compositor-merge-override list AND HUD-exclusion list

**User confirmed downstream impact:** Sync-edit ROADMAP + REQUIREMENTS before plan-phase, not just CONTEXT.md.

---

## C. HudMessage Contract Shape

### C1. Codegen vs hand-written

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Phase 7 codegen pipeline | Reuses Phase 7 07-02 infrastructure; auto-generates Python + TS | ✓ |
| Hand-write TS mirror | Less infrastructure; manual two-side sync going forward | |

**User's choice:** Add to Phase 7 codegen pipeline

### C2. Type organization (initial framing)

| Option | Description | Selected |
|--------|-------------|----------|
| Single union HudMessage | One type covering all 5 messages; matches Phase 7 Dispatch style | |
| Directional split (S2C / C2S) | Two unions enforcing direction at compile time | |

**User's choice:** "看不懂，解释" — clarification requested

After explanation including a concrete code example showing how single-union allows server-to-client direction errors to compile silently, user pushed back with a different question:

### C2-followup. Why not store locks in a yaml file?

User proposed: write locks to `_avatar_overrides.yaml`, sidecar watches the file, compositor reads from yaml. This would simplify the protocol entirely (no `set-lock` / `clear-lock` messages, just file writes).

Counter-explanation given:
- Conflicts with HUD-07 (session-only persistence)
- Conflicts with `_avatar_overrides.yaml` semantic (engineer-authored capability deviations, not user-runtime state)
- File watch latency (50-200ms) is too slow for drag UX
- yaml IO + watchdog + reparse on every drag tick is wasteful
- BUT: the user's instinct toward simpler protocol is valid

Three protocol designs were then presented:

| Option | Description | Selected |
|--------|-------------|----------|
| Original 5-message protocol (in-memory) | set-lock / clear-lock / lock-confirmed / lock-rejected / param-frame; expressive | ✓ |
| Simplified 2-message protocol (in-memory) | param-frame (S2C) + set-lock-state full replacement (C2S); no ack, no reject | |
| yaml file (persistent) | Requires HUD-07 amendment + yaml schema split | |

**User's choice:** Original 5-message protocol (in-memory)
**Notes:** User wanted the expressiveness of distinct rejection / confirmation messages.

### C2-final. Type organization (re-asked after protocol settled)

| Option | Description | Selected |
|--------|-------------|----------|
| Directional split (HudMessageS2C / HudMessageC2S) | Compile-time direction safety; codegen schema gains one more `oneOf` block | ✓ |
| Single union HudMessage | Style-aligned with Phase 7 Dispatch | |

**User's choice:** Directional split

### C3. param-frame encoding

| Option | Description | Selected |
|--------|-------------|----------|
| Full snapshot every frame | `{param_id: value}` complete dict every 15Hz tick | ✓ |
| Delta (only changed params) | Lower bandwidth, requires initial state seed | |

**User's choice:** Full snapshot every frame

---

## D. Lock Boundary Behaviors

### D1. Reject handling

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with reason | Renderer rolls back lock UI + shows toast "Param X not writable on this rig" | |
| Silent rollback | Renderer rolls back, no toast | |
| Design out the rejection | HUD only renders writable params; slider clamps to ranges; reject becomes impossible from normal user path | ✓ |

**User's choice:** Design out the rejection
**Notes:** lock-rejected message is retained but treated as ERROR-log channel for code bugs, not UI.

### D2. Lock lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-engage, manual disengage | Lock holds until explicit unlock click | ✓ |
| Drag-engage, auto-disengage on mouse release | Lock active only during drag | |
| Manual engage required (no auto on drag) | User must click lock toggle before drag works | |

**User's choice:** Drag-engage, manual disengage
**Notes:** Aligns with the use-case "drag to a value, observe behavior, decide whether to keep".

### D3. Avatar re-import lock handling

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 9 doesn't handle | Defer to a later phase | |
| Auto-prune locks not in new RigCapabilities | Silent prune + ERROR log | |
| Clear all locks on any avatar change | Simplest, safest, with toast | ✓ |

**User's choice:** Clear all locks on any avatar change
**Notes:** "We don't pretend ParamX-on-rig-A means the same thing as ParamX-on-rig-B."

---

## Claude's Discretion

Items where the user delegated to Claude or which fall to UI-phase:

- HUD window default size (researcher-investigated)
- Slider visual style + lock toggle visual + sort order + display name resolution
- Empty-state copy + toast styling
- Filter chip layout (default "all three on")
- HUD throttle 15 Hz vs 30 Hz fallback (perceptual benchmark at plan-time)

## Deferred Ideas

- Event-in-flight badge (Phase 7 forward-compat hook; not Phase 9)
- Lock import/export
- HUD inside main window with detach
- HUD-side LLM prompt suggestion
- HUD-exclusion namespace resolution mechanism (decided in 09-01-PLAN, not here)

## Process Note

User explicitly asked me to write Q&A in natural Chinese during this discussion ("能不能说点人话啊"). Memory `feedback_chinese_discussion.md` updated with concrete examples to prevent regression.
