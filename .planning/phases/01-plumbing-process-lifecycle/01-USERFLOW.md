# AgenticLLMVTuber — V1 User Flow Reference

**Status:** Locked design reference for v1-target chrome and user flow.
**Date:** 2026-05-06
**Audience:** UI researcher producing UI-SPEC.md, UI checker validating it, planner sequencing tasks, executor implementing.

---

## Reading guide

This document captures **the v1-target product** (every flow the user can perform once all milestones ship). The walking-skeleton (Phase 1–5) builds:
- **Chrome shell** — top bar, bottom rail, status icon, slide-in panels, drawer
- **LLM setup screen** — fully functional
- **Chat surface** — fully functional through skeleton phases (echo in Phase 1 → real LLM in Phase 2 → TTS in Phase 3 → compositor-driven avatar motion in Phase 4)
- **Settings page** — chrome rendered with all 16 section headers, but only **Connection / Models**, **Diagnostics** (Show log toggle + Open log folder + Reset state), and **About** are functional in skeleton; everything else is placeholder copy
- **History slide-in panel** — chrome rendered, **placeholder copy** ("Conversation history arrives in milestone-2") since persistence is OOS for skeleton
- **Agent page** — chrome accessible from bottom rail, **placeholder copy** ("Agent mode arrives in milestone-3") since agent runtime is OOS
- **Logs drawer** — fully functional once enabled in Settings (sidecar logs only; no agent audit log in skeleton)

**Skeleton cut-list per flow** is at the bottom of this doc.

---

## 1. Layout commitment (locks the structural conflict)

**Single chat-only window for our app. VTube Studio runs in its OWN separate window which the user manages.** Cursor tracking uses OS-level cursor + VTS window bounds detection — no transparent overlay window.

The user sees **two visible windows** total: our app (chat-only) and VTube Studio (avatar). They arrange both windows as they prefer.

This is option **#3** from the user's framing of the layout question, ratified after rejecting:
- ❌ Two of *our* windows (avatar in window-1, chat in window-2) — that's pet mode, OOS for v1 milestone
- ❌ Single split-screen window with avatar canvas region + chat region — fragile because it requires manual alignment with VTS window

---

## 2. Window dimensions

- **Default size:** 400 × 700 px
- **Resizable:** yes
- **Aspect ratio:** any (no enforced ratio)
- **Minimum width:** must keep bottom rail visible (TBD by UI researcher; ~280px is a soft floor before icon labels become illegible)
- **Bottom rail always visible** at any size

---

## 3. Chrome (every screen)

```
┌─ AgenticLLMVTuber ────────────── ─ ◻ ✕ ┐
│ ☰   Agent ⏵   ⬢                        │  ← top bar (~32px tall)
├──────────────────────────────────────── ┤
│                                          │
│   {active view: Chat / Agent /          │
│    Settings — full content area}        │
│                                          │
│ {input field if Chat view}              │
├──────────────────────────────────────── ┤
│ {Logs drawer if enabled in Settings}    │  ← entirely hidden if off
├──────────────────────────────────────── ┤
│      ⌂         ⏷         ⚙             │  ← bottom rail (~48px tall)
│     Chat     Agent    Settings          │
└──────────────────────────────────────── ┘
```

### 3.1 Top bar (~32px)

Three controls, left-aligned:

| Control | Position | Behavior |
|---------|----------|----------|
| `☰` Hamburger | top-left | Tap → opens History slide-in. Disabled / hidden on Agent and Settings views (only meaningful in Chat). |
| `Agent ⏵` toggle | next to ☰ | Session-level enable for agent capability. OFF by default; resets to OFF on app close. ON state colored to indicate active capability. |
| `⬢` Status icon | next to toggle | Single composite icon (worst-of-three color). Click → popover with detail. |

### 3.2 Bottom rail (~48px)

Three top-level views, equal-width tap targets, icon + small label. Active tab highlighted.

| Tab | View |
|-----|------|
| `⌂ Chat` | Default. Conversation surface. |
| `⏷ Agent` | Agent page — sessions list, saved goals, defaults. |
| `⚙ Settings` | Long-scroll settings, sectioned. |

Switching tabs:
- Preserves Chat scroll position
- Preserves Agent active session if any
- Settings always opens scrolled to top

History `☰` is only meaningful on Chat — hidden or disabled on Agent / Settings views.

### 3.3 Logs drawer (between chat and bottom rail)

- **Off (default):** Drawer is **invisible**. No heading, no chevron, no chrome.
- **On (toggled in Settings → Diagnostics):** A `▾` chevron strip appears above the bottom rail. Click to expand drawer upward (height-resizable by drag handle); click `▴` to collapse to single-line strip. State (open/closed/height) persists across launches.

### 3.4 Status icon `⬢` detail

Color logic — worst-of-three:

| State | Color |
|-------|-------|
| All three (LLM, VTS, Sidecar) connected | green |
| Any one degraded | amber |
| Any one error / disconnected | red |

Click → popover:

```
                              ⬢
                              │
                  ┌───────────┴──────────────┐
                  │  Status                  │
                  │  ──────                  │
                  │  ● LLM   qwen2.5-7b      │
                  │          LM Studio       │
                  │          last reply 423ms│
                  │  ● VTS   teto · 60 Hz    │
                  │  ● Sidecar               │
                  │                          │
                  │  [ Re-test connection ]  │
                  └──────────────────────────┘
```

`[Re-test connection]` runs the same 1-token completion test as the setup screen. **In skeleton this is the only re-entry to LLM testing.** v1 adds a `[Change provider →]` button that re-opens the full setup form.

---

## 4. State machine

```
NotConfigured ──[setup test passes]──▶ Configured ──▶ Running
                                                       │
                                                       └──▶ {Chat | Agent | Settings views}
```

- `NotConfigured` ↔ `Configured` is gated by `safeStorage.hasCompletedSetup`.
- **No reverse path** — re-config happens via `[Re-test]` in status popover (skeleton) or `[Change provider →]` (v1).

---

## 5. Pre-launch state (what the user has running)

Before they ever open our app:
- They've installed our app via electron-builder installer (.exe on Windows)
- They've installed VTube Studio (Steam or itch.io) — separately, not bundled
- They've installed LM Studio or have a custom OpenAI-compatible endpoint
- Optionally: they've started VTS + loaded a model; started LM Studio + loaded a model + started its local server

**We don't validate any of this proactively** — useful errors surface when something's missing.

---

## Flow A — Cold launch (first time, no saved config)

### A.1. Window opens to LLM Setup Screen (full-window blocking modal)

**No top bar, no bottom rail during setup** — just the form.

```
┌─ AgenticLLMVTuber ────────────── ─ ◻ ✕ ┐
│                                          │
│   Connect a language model               │
│   ─────────────────────────              │
│                                          │
│   AgenticLLMVTuber sends every message   │
│   to a language model you control.       │
│                                          │
│   Provider                               │
│   ┌──────────────────────────────────┐  │
│   │ LM Studio                      ▾ │  │
│   └──────────────────────────────────┘  │
│                                          │
│     · LM Studio              ✓ working   │
│     · Custom OpenAI-compat   ✓ working   │
│     · OpenAI                ⏳ Coming v2 │
│     · Anthropic             ⏳ Coming v2 │
│     · Gemini                ⏳ Coming v2 │
│                                          │
│   Endpoint URL                           │
│   ┌──────────────────────────────────┐  │
│   │ http://localhost:1234/v1         │  │
│   └──────────────────────────────────┘  │
│                                          │
│   Model        (auto-detect if blank)    │
│   ┌──────────────────────────────────┐  │
│   │ auto-detect                      │  │
│   └──────────────────────────────────┘  │
│                                          │
│   API key       (LM Studio: skip)        │
│   ┌──────────────────────────────────┐  │
│   │  ─ disabled ─                    │  │
│   └──────────────────────────────────┘  │
│                                          │
│   [ Test connection ]                    │
│                                          │
│                       [ Continue → ]     │
│                       ↑ disabled until   │
│                         test passes      │
└──────────────────────────────────────── ┘
```

### A.2. Test connection — verbose log

On click, the button morphs into an inline log panel. Continue stays disabled until success.

Success:
```
   Connection test
   ───────────────
   ▸ Resolving endpoint http://localhost:1234/v1 ...
   ▸ GET /v1/models — 200 OK (1 model: qwen2.5-7b-instruct)
   ▸ POST /v1/chat/completions
      prompt="hi"  max_tokens=1
   ▸ Streaming response ...
   ✓ Received 1 token in 423 ms

   Connection looks good. You can continue.

   [ Test again ]                      [ Continue → ] enabled
```

Failure (LM Studio not running):
```
   ✕ Connection refused at 127.0.0.1:1234

   LM Studio doesn't seem to be running.

   Make sure:
      1. LM Studio is open
      2. A model is loaded in the chat panel
      3. The "Local Server" tab is started (default port 1234)
```

Failure (LM Studio running but no model):
```
   ▸ GET /v1/models — 200 OK (0 models loaded)
   ✕ No model is loaded in LM Studio.

   Open LM Studio's chat tab, load a model from the My Models
   panel, then return here and Test again.
```

### A.3. Custom OpenAI-compatible

Selecting Custom: URL clears, API key field enables, model field becomes required (no auto-detect for arbitrary endpoints). All three validated as non-empty before the **Test connection** button enables.

### A.4. Grayed-out hosted providers

Hovering a grayed entry: tooltip *"Hosted-provider support lands in v2. Use the Custom OpenAI-compatible option for now if you need a hosted endpoint."* Selecting it disables the form below and shows the same message inline.

### A.5. Continue clicked

- Provider/URL/key/model write to Electron `safeStorage` (DPAPI on Windows)
- `hasCompletedSetup: true` writes alongside
- Setup screen fades out → main app appears

### A.6. First main window — chrome appears, VTS not connected

```
┌─ AgenticLLMVTuber ────────────── ─ ◻ ✕ ┐
│ ☰   Agent ⏵   ⬢                        │
├──────────────────────────────────────── ┤
│                                          │
│       To see your avatar, start          │
│       VTube Studio and load a            │
│       Live2D model.                      │
│                                          │
│       We'll connect automatically.       │
│                                          │
│       [ Open VTube Studio docs ↗ ]       │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Type a message...                [⏎] │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────── ┤
│      ⌂         ⏷         ⚙             │
│     Chat     Agent    Settings          │
└──────────────────────────────────────── ┘
```

⬢ shows amber (VTS disconnected). Hover/click pops the detail.

Chat input is **enabled** — LLM is up. User can chat with no avatar; replies appear as text + TTS, no avatar motion until VTS connects.

### A.7. User starts VTS, loads avatar

VTS pops its own plugin authorization dialog. Our app shows ⬢ amber with tooltip *"awaiting plugin authorization in VTube Studio"*. User clicks "Allow always" in VTS. Status flips green; placeholder is replaced with empty-chat:

```
       Your avatar is ready.
       Type below to start.
```

---

## Flow B — Warm launch

### B.1. Double-click shortcut

`hasCompletedSetup === true` → setup screen skipped.

### B.2. Main window opens directly

Status icon transitions colors as connections settle:
- Sidecar: green almost immediately (local IPC)
- LLM: silent 1-token test → green or amber if unreachable
- VTS: connection attempt to localhost:8001 → green if running with prior auth; amber if VTS not running

### B.3. TTS warmup fires silently

Muted 1-token piper synth runs in background. User never hears it.

### B.4. Empty chat (skeleton: in-memory cleared per LLM-04)

```
       Your avatar is ready.
       Type below to start a conversation.

       Closing the app clears this conversation
       — persistence comes in a later milestone.
```

🚀 v1: warm launch restores last thread (per PROJECT_DESIGN.md §3 #1).

---

## Flow C — Conversation (steady state)

The §14-success-criteria-driving flow.

### C.1. User types and presses Enter

```
   You                                       10:42
   Tell me a 3-sentence story about a cat
   who finds a key.
```

User message renders immediately. Input clears and accepts the next message (queues; doesn't interrupt).

### C.2. First sentence appears synced with TTS audio start

Subtle assistant "thinking" indicator (dot pulse) while sentence 1 synthesizes. As soon as TTS for sentence 1 begins playing:

```
   Teto                                      10:42
   On a quiet afternoon, the cat noticed
   a glint beneath the bookshelf.
```

`ParamMouthOpenY` lipsyncs from RMS. Speech driver sways head (and body if Phase 4 investigation succeeds; head-only with breathing fallback otherwise).

### C.3. Sentences 2 and 3 stream as synthesized

Sentence 2 was synthesized in parallel during sentence 1's playback. Seamless transition.

### C.4. `[joy]` tag in stream → smooth expression blend

Even if BPE splits the tag as `[`, `jo`, `y]`, buffer-then-extract catches it on the completed sentence. Tag stripped from display; `ActionIntent(kind="expression", name="joy")` enters the compositor; intent overlay fades joy in over ~300ms via `weight`, decays after the sentence ends. **Not a hotkey pop** (§14 #2).

### C.5. After last sentence — idle baseline resumes

Perlin head drift + blink scheduler (every 3–7s, occasional double-blinks). Avatar never goes still.

---

## Flow D — History slide-in (☰)

### D.1. User taps `☰` (top-left)

History panel slides in from left, covers ~80% of width. Chat dimmed underneath; tap dimmed strip / Esc / `✕` to close.

```
┌─ AgenticLLMVTuber ────────────── ─ ◻ ✕ ┐
│ ☰   Agent ⏵   ⬢                        │
├──────────────────────────────────────── ┤
│ ┌─History──────────────────────┬───┐    │
│ │                            ✕ │   │    │
│ │ ⌕ search threads             │░░░│    │
│ │                              │░░░│    │
│ │ Today                        │░░░│    │
│ │ · Cat story              ⋯  │░░░│    │
│ │ · How to build a website     │░░░│    │
│ │                              │░░░│    │
│ │ Yesterday                    │░░░│    │
│ │ · Genshin daily routine      │░░░│    │
│ │ · Recipe brainstorm          │░░░│    │
│ │                              │░░░│    │
│ │ Earlier                      │░░░│    │
│ │ · Onboarding                 │░░░│    │
│ │                              │░░░│    │
│ │ [ + New thread ]             │░░░│    │
│ └──────────────────────────────┴───┘    │
├──────────────────────────────────────── ┤
│      ⌂         ⏷         ⚙             │
└──────────────────────────────────────── ┘
```

### D.2. Interactions

- Tap thread row → load it; panel auto-closes
- `⋯` on row → rename / delete / pin / export
- `⌕ search` → FTS5 across thread titles + bodies (🚀 MEM-05)
- `[+ New thread]` → empty thread, panel closes
- Tap dimmed strip / Esc / `✕` → close without selecting

### D.3. Skeleton state ⏳

```
       Conversation history arrives in
       milestone-2.

       This conversation clears when
       you close the app.
```

`[+ New thread]` clears the in-memory thread (one fresh restart). `⌕ search` is disabled.

---

## Flow E — Idle interactions

### E.1. Cursor over VTS window

Sidecar polls OS cursor at 15 Hz; when cursor enters VTS window's bounding rect (queried via OS APIs), emits reaction `ActionIntent`s with cursor position. Compositor's reaction driver translates to eye/head-tracking offsets. Cursor exits → ease back to center over ~500ms.

This works without overlaying anything on VTS.

### E.2. F9 (test hotkey)

Global Electron hotkey (active when our app is focused). Sends `DiscreteEvent` over WS → sidecar fires pyvts `HotkeyTriggerRequest` → VTS prop appears for ~2s. Pure smoke test of the discrete-trigger path alongside the dominant 60 Hz param stream.

---

## Flow F — Bottom rail navigation

Tap `⌂ Chat` / `⏷ Agent` / `⚙ Settings`. Active tab highlighted (color or filled-icon).

- Switching preserves Chat scroll position
- Preserves Agent active session if any
- Settings always opens scrolled to top
- `☰` hamburger only meaningful on Chat — hidden on Agent / Settings

---

## Flow G — Status icon `⬢` interaction

Click `⬢` → popover (see §3.4). `[Re-test connection]` runs the 1-token completion test. On failure, opens an inline error in the popover with retry. **Skeleton:** only re-entry to LLM setup. **v1:** `[Change provider →]` re-opens setup form.

---

## Flow H — Agent page (manual goal management) — v1-target

When user taps `⏷ Agent`:

```
┌─ AgenticLLMVTuber ────────────── ─ ◻ ✕ ┐
│ ☰   Agent ⏵   ⬢                        │
├──────────────────────────────────────── ┤
│  Agent                                   │
│  ─────                                   │
│                                          │
│  Sessions                  [ + New goal ]│
│  ─────────                              │
│  ▶ Genshin daily check-in   running    │
│  ✓ Recipe brainstorm        4h ago     │
│  ✓ Refactor auth module     yesterday  │
│  ✕ Calendar export          2d (canc)  │
│                                          │
│  Saved goals                             │
│  ─────────────                          │
│  · Genshin daily   ⏰ daily 7am  [run]  │
│  · Email triage    one-shot      [run]  │
│  [ + New saved goal ]                   │
│                                          │
│  Defaults                                │
│  ─────────                               │
│  Default permissions:                    │
│    file ☐  web ☐  screen ☐              │
│  File-ops allowlist:                     │
│    /Users/me/Documents                  │
│  Audit log:                              │
│    ~/Library/Logs/AgenticLLMVTuber      │
└──────────────────────────────────────── ┘
```

`[+ New goal]` (top of Sessions) → modal/inline form for goal text + permissions → starts immediately if Agent toggle is ON, else prompts to enable.

Tap a session row → full goal-loop view (per-action timeline, screenshot strip, audit log, kill switch).

**Concurrency:** one active session at a time. New goal queues or replaces (TBD by agent-runtime milestone).

### Skeleton state ⏳

```
       ⏷ Agent
       
       Agent mode arrives in milestone-3.
       
       You'll be able to delegate goals to a
       computer-use sub-agent (daily routines,
       GUI workflows) and a CLI sub-agent
       (code/file/web tasks via Claude Code).
```

---

## Flow I — Agent in chat (portal cards) — v1-target

Lifecycle entirely in the Chat view. Detection runs always; gating depends on Agent toggle.

### I.1. Detection in OFF state — upsell card

```
   You                                       10:42
   Please open my Genshin daily check-in.

   Teto                                      10:42
   I'd love to — turn on Agent mode and
   I'll get started.

   ┌─ ⏷ Agent mode is off ────────────────┐
   │  Toggle Agent on to file this        │
   │  as a goal.                          │
   │       [ Turn on Agent ▶ ]            │
   └──────────────────────────────────────┘
```

`[Turn on Agent ▶]` flips the top-bar toggle and re-runs detection — card updates to State 2 in place.

### I.2. Goal proposed (toggle ON)

Router auto-files goal:

```
   ┌─ ⏷ Agent goal proposed ──────────────┐
   │  Run Genshin daily check-in          │
   │                                      │
   │  Needs:                              │
   │   ☑ screen control                   │
   │   ☐ file ops                         │
   │   ☐ web                              │
   │                                      │
   │  [ Approve ▶ ] [ Modify ] [ Cancel ] │
   └──────────────────────────────────────┘
```

`[Modify]` → **inline expand** within the card (editable goal text + permission checkboxes). Not a modal. Card auto-resizes to fit editor.

### I.3. Running

```
   ┌─ ⏷ Agent running · step 4 / 30 ──────┐
   │  ▸ Clicking "Daily Login" tab...     │
   │                                      │
   │   ┌─────────┐                        │
   │   │ [thumb] │  03:21 elapsed         │
   │   └─────────┘                        │
   │                                      │
   │  [ Pause ]  [ Stop ]  [ Open ↗ ]    │
   └──────────────────────────────────────┘
```

Live updates per step. Avatar narrates milestones (in-character TTS). Thumbnail = most recent screenshot. `[Open ↗]` jumps to Agent page session detail.

### I.4. Sticky pill while session active

When chat scrolls past the portal card, a thin sticky pill anchors at the bottom of the chat surface (above the input field):

```
                                ┌──────────────────────────┐
                                │ ⏷ step 7/30 · [Open ↗]  │
                                └──────────────────────────┘
   ┌──────────────────────────────────────────┐
   │ Type a message...                    [⏎] │
   └──────────────────────────────────────────┘
```

Stays visible while scrolling. Tap → jumps to the live portal card. Disappears on terminal state.

### I.5. Verification gate

Before declaring DONE, verifier asks user to confirm:

```
   ┌─ ⏷ Agent waiting for confirmation ───┐
   │  Final state: looks done?            │
   │                                      │
   │   ┌─────────────┐                    │
   │   │ [final shot]│                    │
   │   └─────────────┘                    │
   │  Verifier: "Daily reward claimed."   │
   │                                      │
   │  [ Done ✓ ]  [ Keep going ]          │
   └──────────────────────────────────────┘
```

### I.6. Terminal state

```
   ┌─ ⏷ Agent complete ───────────────────┐
   │  ✓ Genshin daily check-in            │
   │  18 actions · 04:12 elapsed          │
   │                                      │
   │           [ View report ↗ ]          │
   └──────────────────────────────────────┘
```

Persists in chat scrollback. Sticky pill removed. `[View report ↗]` → Agent page session detail.

### Skeleton state ⏳

Detection not wired; no portal cards rendered. Top-bar Agent toggle visible but disabled with tooltip *"Agent mode arrives in milestone-3."*

---

## Flow J — Settings (long scroll, sectioned)

Tap `⚙ Settings` in bottom rail. Anchor pills at top for quick jump.

```
┌─ AgenticLLMVTuber ────────────── ─ ◻ ✕ ┐
│ ☰   Agent ⏵   ⬢                        │
├──────────────────────────────────────── ┤
│  Settings                                │
│  ────────                                │
│                                          │
│  Connection · Avatars · VTube Studio · …│
│                                          │
│  Connection / Models                     │
│  ────────────────────                    │
│  Provider:    LM Studio                  │
│  Endpoint:    http://localhost:1234/v1   │
│  Model:       auto-detect                │
│  [ Re-test ]   [ Change provider → ]    │
│                                          │
│  Avatars                                 │
│  ────────                                │
│  ▸ Teto (dev)                  default  │
│    Personality, voice, hit zones,        │
│    action mapping, memory →              │
│  [ + Add avatar ]                        │
│                                          │
│  VTube Studio                            │
│  ──────────                              │
│  Host:port    127.0.0.1:8001            │
│  Default rig  teto                      │
│  Lipsync      our-RMS / VTS native      │
│  [ Re-authorize plugin ]                 │
│  [ Run smoke-pass ]                      │
│                                          │
│  TTS / Voice out                         │
│  ─────────────                          │
│  Backend, voice, sample rate, output     │
│                                          │
│  Voice in                                │
│  ─────────                              │
│  PTT key, VAD sensitivity, ASR model     │
│                                          │
│  Conversation                            │
│  ─────────                              │
│  System prompt prefix, temperature,      │
│  max tokens, reasoning UI                │
│                                          │
│  Memory                                  │
│  ──────                                  │
│  Shared user-facts, retrieval depth,     │
│  hotkey, wipe                            │
│                                          │
│  Skills                                  │
│  ──────                                  │
│  Installed list, install, perms          │
│                                          │
│  Agent                                   │
│  ─────                                   │
│  Default permissions, allowlist,         │
│  audit log, kill-switch hotkey           │
│                                          │
│  Scheduler                               │
│  ─────────                              │
│  Saved templates, cron, missed runs      │
│                                          │
│  Form factor                             │
│  ───────────                            │
│  Window / pet, opacity, click-through    │
│                                          │
│  Hotkeys                                 │
│  ──────                                  │
│  Kill, PTT, hide, test prop              │
│                                          │
│  Appearance                              │
│  ──────────                             │
│  Theme, font size, density, language     │
│                                          │
│  Diagnostics                             │
│  ───────────                            │
│  ☐ Show log panel                        │
│  Log level: info                        │
│  [ Open log folder ]                     │
│  [ Reset all state ]                     │
│  ☐ Telemetry (off)                       │
│                                          │
│  About                                   │
│  ─────                                   │
│  Version, update channel, docs, license  │
└──────────────────────────────────────── ┘
```

### Settings IA (16 sections, all rendered as headers)

| # | Section | v1 contents |
|---|---------|-------------|
| 1 | Connection / Models | LLM provider/URL/key/model, multimodal-vision toggle, LiteLLM timeout, fallback provider |
| 2 | Avatars (library) | List, add (drag .zip / pick folder), set default, delete; row → per-avatar sub-page |
| 3 | Per-avatar (sub-page) | personality.md editor, voice (TTS voice + speed), welcome message, hit zones, action parameter manual mapping (orphan params, physics-chain proxies, sign inversions), per-avatar memory on/off, "forget all memories" |
| 4 | VTube Studio | Host:port, plugin re-auth, default rig, lipsync mode, smoke-pass tool launcher, test-hotkey binding |
| 5 | TTS / Voice out | Backend (piper / edge / sovits / comfyui), voice, sample rate, output device, warmup-on-launch |
| 6 | Voice in | PTT key, VAD sensitivity, ASR model size, interrupt behavior |
| 7 | Conversation | System prompt prefix, temperature, max tokens, streaming on/off, reasoning UI (strip / chevron) |
| 8 | Memory | Shared user-facts, retrieval depth, "remember this" hotkey, FTS index location, wipe |
| 9 | Skills | Installed list, install from folder, per-skill permissions |
| 10 | Agent | Default permissions, file-ops allowlist, screenshot retention, audit log location, kill-switch hotkey |
| 11 | Scheduler | Saved templates, cron schedules, missed-runs behavior, per-template permissions |
| 12 | Form factor | Windowed / pet, opacity, click-through default, always-on-top, drag inertia |
| 13 | Hotkeys | Kill, PTT, hide, test prop, custom bindings |
| 14 | Appearance | Theme (light/dark/system), font size, chat density, language |
| 15 | Diagnostics | **Show log panel toggle** (gates the bottom drawer), log level, "open log folder", reset all state, telemetry opt-in |
| 16 | About | Version, update channel, docs links, license, third-party notices |

### Skeleton state ⏳

All 16 section headers render. Functional in skeleton:

- **§1 Connection / Models** — fully working: shows current values, `[Re-test]` works, `[Change provider →]` re-opens setup
- **§15 Diagnostics** — only `☐ Show log panel`, `[Open log folder]`, `[Reset all state]` work; log level + telemetry are placeholders
- **§16 About** — version + license

All other sections show their header + a 1-line *"Coming in milestone-N. {what'll land}"* placeholder.

---

## Flow K — Logs drawer

### K.1. Off (default)

Drawer is **invisible**. No heading, no chevron, no chrome. Chat surface butts directly against the bottom rail.

### K.2. Settings → Diagnostics → toggle on

`▾` chevron strip appears above bottom rail:

```
│ ┌──────────────────────────────────────┐ │
│ │ Type a message...                [⏎] │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────── ┤
│ Logs ▾                                   │  ← collapsed
├──────────────────────────────────────── ┤
│      ⌂         ⏷         ⚙             │
```

Click `▾` → expands upward, height-resizable by drag handle:

```
│   ...chat surface (shorter)              │
├──────────────────────────────────────── ┤
│ Logs ▴                                   │
│ ──────                                   │
│ [READY] sidecar ws://127.0.0.1:53811/ws  │
│ [INTENT] expression="joy" weight=1.0     │
│         → fade 300ms                     │
│ [VTS] connected; rig=teto; @60Hz         │
│ [TTS] sentence 2/3 synth 312ms          │
│ [LLM] stream chunk: "Curiosity sparkl... │
│                                          │
│ [ Clear ]   [ Open log folder ]          │
├──────────────────────────────────────── ┤
│      ⌂         ⏷         ⚙             │
```

Click `▴` → collapses to single-line `Logs ▾` strip. Drawer state (open/closed/height) persists across launches.

### Skeleton ✅

Drawer fully works once enabled. Surfaces sidecar logs only (no agent audit log — that's v1-target).

---

## Flow L — Errors and recovery

All non-modal except where blocking is necessary. Status icon reflects worst current state.

### L.1. LLM unreachable mid-session

- ⬢ → amber/red
- Inline error in the failing assistant slot:
  ```
  Teto                                       10:51
  ⚠  LLM unreachable — connection refused
                                       at 127.0.0.1:1234
      [ Retry ]    [ Skip ]
  ```
- Input field disabled with banner: *"LLM is unreachable. Start LM Studio and click Retry."*
- `[Retry]` re-runs silent test; on success, banner clears.
- **Setup screen does not re-appear.**

### L.2. VTS disconnects mid-session

- ⬢ → amber
- Subtle banner above input: *"VTube Studio disconnected — avatar motion paused. Will reconnect when VTS is back."*
- Chat keeps working. Avatar text+TTS continue silently w.r.t. motion.
- VTS auto-reconnects on its return; banner clears.

### L.3. VTS plugin auth denied

- ⬢ → amber
- Banner: *"Plugin authorization denied in VTube Studio. [Re-request] or grant in VTS → Settings → Plugins."*

### L.4. Sidecar crash

- Toast slides from top-right: *"Sidecar restarting..."*
- Auto-respawn once. Toast fades after 3s.
- Two crashes within 30s → persistent banner with `[Restart sidecar]` button; chat input disabled.

### L.5. TTS unavailable (rare)

- TTS section of status popover shows red.
- Replies arrive as text only — silent.
- Banner: *"TTS unavailable — replies will be text-only. [More info]"*

---

## Flow M — Closing the app

### M.1. X button → quit

In skeleton: **always quits.** v2 adds the close-behavior picker (quit / minimize-tray / ask).

Sequence:
- `before-quit` IPC fires
- Main sends WS `{type:"shutdown"}` to sidecar
- Sidecar closes pyvts cleanly, flushes log, exits
- 5s soft timeout, then `child.kill()`
- Process tree empty

### M.2. Force-quit via Task Manager

Sidecar's parent-PID watchdog (psutil polling `os.getppid()` every 2s) detects dead parent → self-exits within 2s. No orphan port; relaunching immediately works.

### M.3. In-memory chat clears

Next launch shows the empty-state. v1 restores last thread (MEM-*).

---

## Skeleton cut-list (what each phase delivers)

| Flow | Ph1 | Ph2 | Ph3 | Ph4 | Ph5 | Notes |
|------|-----|-----|-----|-----|-----|-------|
| A. Cold launch (LLM Setup) | ✅ | | | | | Full in Ph1 |
| B. Warm launch | ✅ | | | | | Empty chat on relaunch |
| C. Conversation — echo | ✅ | | | | | "hello" → "echo: hello" |
| C. Conversation — real LLM streaming | | ✅ | | | | Sentence-by-sentence + `[joy]` extracted |
| C. Conversation — TTS | | | ✅ | | | Audible sentence-buffered playback |
| C. Conversation — full §14 #1+#2 | | | | ✅ | | Lipsync + [joy] smooth blend |
| D. History slide-in chrome | ✅ | | | | | Placeholder copy |
| E.1 Cursor tracking | | | | ✅ | | Eye/head tracking |
| E.2 F9 hotkey | | | | ✅ | | DiscreteEvent prop toggle |
| F. Bottom rail nav | ✅ | | | | | Tabs work, content varies |
| G. Status icon + popover | ✅ | | | | | Re-test functional |
| H. Agent page | ✅ | | | | | Placeholder copy |
| I. Agent portal cards | ⏳ | | | | | OOS for skeleton entirely |
| J. Settings page chrome | ✅ | | | | | All 16 headers; §1+§15+§16 functional |
| K. Logs drawer | ✅ | | | | | Sidecar logs only |
| L. Errors | ✅ | | | | | Banners + retry, no setup re-appear |
| M. Closing | ✅ | | | | | Graceful + force-quit handled |

✅ = real functionality lands in this phase. ⏳ = OOS for skeleton entirely.

---

*Reference doc — locked 2026-05-06. Update only via /gsd:discuss-phase to keep alignment with downstream agents.*
