# PROJECT_DESIGN.md

**Status:** Milestone-1 in execution; milestone-2 outline drafted
**Last updated:** 2026-05-08
**Working title:** TBD (placeholder: *Companion-Agent*)
**Origin:** Successor concept inspired by Open-LLM-VTuber's Vivid Actions phase.

This document captures the envisioned product, user flow, and architecture for
a new project. It is meant to be read cold — no prior-conversation context
required. Update in place as decisions land.

---

## 1. Product Vision

A local-first desktop application where a **VTube Studio Live2D avatar is the
user-facing companion**, and an **opt-in agent mode** turns that companion
into a goal-loop supervisor that drives a screen-control sub-agent (and
optionally delegates code/web tasks to a CLI agent like Claude Code).

A future mobile companion is planned as a **separate project** with its
own technology stack and is explicitly out of scope for this design (see
§10 and §16).

### Differentiators (vs Open-LLM-VTuber and similar)
1. **Agent router + computer-use loop**, not just chat. Avatar can actually
   *do things* on the user's desktop — daily check-ins, repetitive GUI work,
   scheduled goals running unattended.
2. **Continuous, non-hotkey-driven avatar liveliness**. Action compositor
   runs at 60 Hz combining idle baseline + speech-driven motion + intent
   overlays + reactions — Neuro-sama-style fluidity, not VTS-hotkey pops.
3. **Avatar-first agentic UX**. The agent's progress is communicated through
   the avatar (in-character speech, expressions, posture changes) plus a
   screenshot strip — not a CLI log dump.
4. **Multi-avatar personalities with shared user-facts**. Each avatar has
   isolated episodic memory (different relationships); a small shared
   bucket of durable user facts means avatars know who you are without
   losing their distinct voices.
5. **Saved + scheduled goals** with click-through avatar overlay during
   execution — daily routines run while you watch.
6. **VTube Studio as the rendering pipe** (via pyvts) so we don't
   re-implement Cubism rendering up front.

### Core principle: minimize self-built work
We are not rebuilding the Cubism SDK. We are not rebuilding Claude Code.
We are not rebuilding LiteLLM. The unique value-add is the **action
compositor + agent router + goal-loop + scheduled-goal runtime + skills
plumbing**. Everything else is glue around best-in-class libraries.

---

## 2. Use Cases

### UC-1: Casual companion
User opens the app for ambient presence — avatar idles on a corner of the
screen, reacts to clicks/cursor/drags, holds short conversations, expresses
emotions. No agentic capability invoked.

### UC-2: Quick assistant questions (no automation)
User asks the avatar a question; LLM responds with TTS + expression/action
tags. Avatar emotes while answering. Same surface as UC-1 but information-
seeking. No screen control, no file access.

### UC-3: GUI automation goals (the headline use case)
User says: *"Run my Genshin daily check-in."* Avatar acknowledges
in-character, then enters working mode. The agent loop screenshots the
screen, identifies UI elements, clicks/types/drags toward the goal,
verifies progress with re-screenshots, and reports done/blocked.

### UC-4: Code/file/web tasks via delegation
User says: *"Refactor the auth module to use JWT."* Avatar delegates to a
local code agent (Claude Code subprocess) and narrates progress. File ops
are gated by a per-session permission strip.

### UC-5: Multi-avatar identity switching
User imports several VTS models — each gets a personality profile (markdown),
voice config, and isolated episodic memory bucket. Switching avatars
switches *all three* — the same question gets a different answer from a
different avatar. A separate **shared user-facts bucket** lets every avatar
know who you are without diluting their distinct voices.

### UC-6: Scheduled / saved goal automation
User saves a working goal as a named template ("Genshin daily"). They
either re-run it one-click from the agent panel, or set a cron-style
schedule (daily 7am). Scheduled goals fire only while the app is running
or in the system tray; missed runs are reported on next launch.

### UC-7: Multi-thread per-avatar conversations
User keeps several labeled threads with the same avatar (sidebar pattern,
ChatGPT-style) — e.g., "work-stuff", "RP", "language-practice". Each
thread is its own conversation with its own scrollback; they share the
avatar's identity. Episodic memory is shared at the avatar level: each
chunk is tagged with `thread_id` so retrieval can bias toward the
active thread without losing cross-thread continuity (per §13.120).

### UC-8 (deferred)
Mobile companion is deferred to a separate future project. See §10.

---

## 3. User Flows

### First launch (one-time)
1. App opens to a **mandatory LLM setup screen** — pick provider (LM
   Studio default, custom OpenAI-compatible, OpenAI/Anthropic/Gemini),
   enter URL/key, test connection. Block until configured.
2. **Skip-able 3-step onboarding tour** covers:
   - Step 1: avatar interactions (click and drag the avatar; cursor in
     canvas tracks)
   - Step 2: chat + voice (type or hold the PTT key; click stop or
     start talking to interrupt; toggle VAD in settings)
   - Step 3: agent toggle + permissions (per-session reset; what each
     toggle enables; kill switch)
3. Optional **"About me" prompt** asks for name + a free-form bio
   paragraph — feeds the `<user_profile>` system-prompt tag and
   bootstraps the shared user-facts bucket.
4. Lands on the main Live2D page with the default avatar.

### Companion mode (default on subsequent launches)
1. App opens **directly to the Live2D page** with the default avatar
   loaded; entrance motion plays (per-avatar declared, fall back to
   fade-in). No drawer, no picker — user lands in the conversational
   surface immediately. Last conversation thread is restored.
2. A **minimal avatar dropdown** lives in the page chrome for switching
   avatars. Switching swaps avatar + personality profile + voice +
   episodic memory bucket atomically. Shared user-facts bucket carries
   across avatars.
3. Conversation: text input (with image paste/drag), push-to-talk, or
   VAD always-listening (settings-toggleable; sensitivity slider).
   User can interrupt avatar mid-speech via VAD or stop button. Avatar
   responds with sentence-by-sentence streaming text synced with TTS
   playback, plus expression/action tags and continuous compositor-
   driven motion. LLM "thinking" / reasoning blocks are hidden by
   default with a per-message expand chevron.
4. Casual interactions:
   - Click avatar regions → per-avatar `hitZones.json` maps region →
     `ActionIntent` (head→[happy], tummy→[shy], etc.) + occasional TTS
     one-liner + happiness++ state effect biasing next response
   - Cursor in canvas → eye/head tracking
   - Drag avatar → light inertia + edge resistance; moved within
     canvas (windowed) or across desktop (pet)
5. Memory writes happen at session end (background summarizer), at
   every-50-turns checkpoint, or on explicit "remember this" command.
6. **Multiple chat threads per avatar** — sidebar lets user switch /
   create / rename / delete threads. New threads auto-named by LLM
   from the first 3-5 turns; user can rename anytime.
7. Users can **edit and resend** any past user message and **regenerate**
   any assistant response (rolls back conversation state to that point).
8. Avatar **launch greeting** is per-avatar configurable in
   `personality.md` (chatty vs silent on each launch).
9. If the user types a request that sounds like an agent goal in
   companion mode, avatar suggests "I can do that if you turn on Agent
   mode" rather than acting silently.

### Form factor toggle
- **Windowed mode (default)**: single window with avatar canvas + chat
  panel side-by-side. User can drag-resize the avatar canvas. Canvas
  background is fully transparent (chrome shows through).
- **Pet mode (toggle)**: avatar moves into a transparent borderless
  always-on-top window. Chat moves into a separate dockable window.
  Both windows' positions/sizes persist across launches.

### Close button behavior
The X button is **configurable** in settings: quit / minimize-to-tray /
ask-each-time. Default to ask-each-time until user picks. Critical
because the goal scheduler only runs while app is open or in tray.

**Default avatar:** ships with the app (CC-permissive Live2D model,
properly licensed for redistribution). Kasane Teto is a development-only
asset and is **not** redistributable. User can change the default in
settings; first-launch experience never blocks on avatar choice once
LLM setup is complete.

### Agent mode (toggle)
1. User toggles the **Agent** switch in the chrome.
2. UI reveals:
   - Goal input box ("describe what you want done")
   - Saved-goal templates dropdown (one-click re-run; cron schedule per
     template)
   - Permission strip: `[ ] file ops  [ ] web  [ ] screen control`
     (all default OFF; user must explicitly enable per-session; reset on
     app close)
   - File-ops directory allowlist (only relevant when file-ops is on)
   - Live screenshot strip (right rail)
   - Per-action audit log (separate panel)
3. **Vision check**: agent mode is disabled if the configured LLM is
   not multimodal. UI explains why and suggests providers that work.
4. User states a goal (or clicks a saved template). Avatar acknowledges
   in-character; reduces narration to milestones.
5. **Avatar window goes click-through** for the duration of the loop
   so screen-control clicks pass to whatever's underneath. Reverts on
   goal end.
6. **Goal-loop runs** (see §9). Each iteration:
   - Plan step → in-character milestone one-liner (TTS-spoken)
   - Act step → click/type/drag (ScreenControl) OR delegate to CLI
     sub-agent
   - Verify step → re-screenshot + multimodal "are we there yet?"
   - **Mid-loop permission prompt** if agent attempts an action the
     strip blocks ("agent wants screen-control; grant for this goal?")
   - **Tool calls displayed in chat** as compact inline cards,
     expandable for full detail
   - On failure recoverable, retry; on stuck, ask user
   - 30-step budget; prompt to extend at hit
7. **Chat runs in parallel**: user can ask "how's it going?" mid-loop;
   avatar answers from goal-loop status without interrupting work.
   Halt-by-typing in chat is **not** supported — use stop button or
   global hotkey.
8. **Kill switch**: triple-Esc global hotkey OR big stop button on the
   agent panel. Halts immediately; user is then prompted whether to
   attempt a best-effort rollback of recent reversible actions.
9. Before declaring DONE, the verifier shows its **terminal verdict +
   final screenshot** to the user; user confirms or says "keep going".
10. Termination → DONE / BLOCKED / CANCELLED. Avatar reports verbally,
    chat shows screenshot summary, audit log preserved.

### Mobile flows
Out of scope — separate future project. See §10.

---

## 4. Architecture

### High-level
```
┌──────────── Desktop (Electron — see §13.1) ────┐
│  Electron main (TypeScript)                    │
│   ├─ Window mgmt: windowed mode + pet mode     │
│   ├─ Click-through controller (during agent)   │
│   ├─ Global hotkeys (kill, PTT, hide)          │
│   ├─ System tray (background scheduler host)   │
│   ├─ Auto-update notify-only                   │
│   └─ Sidecar lifecycle (eager start + watchdog)│
│                  │ IPC                         │
│  Renderer (React + Vite + i18n scaffold)       │
│   ├─ Avatar canvas (VTS proxy v1; pixi v1.5)   │
│   │     drag-resizable, drag-movable           │
│   ├─ Chat panel (multi-thread sidebar; FTS5    │
│   │     full-text search; virtualized scroll;  │
│   │     image paste/drag input)                │
│   ├─ Agent panel (goal input, saved templates, │
│   │     scheduler config, perm strip + dir     │
│   │     allowlist, screenshot strip,           │
│   │     audit log, kill button)                │
│   ├─ Settings (single long scroll, sectioned)  │
│   ├─ Avatar dropdown + profile reveal          │
│   ├─ In-app log panel + 'open log folder'      │
│   └─ Token/cost panel (Settings only)          │
│                  │ WebSocket (localhost)       │
│  Local Python sidecar (FastAPI + uvicorn,      │
│       PyInstaller-bundled)                     │
│   ├─ Conversation orchestrator (OLVT-style)    │
│   │     parallel-with-agent state machine      │
│   ├─ Action compositor (60 Hz param stream)    │
│   │     idle / speech / reaction / intent      │
│   ├─ TTS queue (ordered, parallel synth)       │
│   ├─ Memory                                    │
│   │     ├ Profile loader (md/yaml/json,        │
│   │     │     filesystem watch + hot-reload)   │
│   │     ├ Episodic RAG: Chroma per             │
│   │     │     per avatar (thread-tagged chunks) │
│   │     ├ Shared user-facts bucket             │
│   │     ├ FTS5 chat search index               │
│   │     └ Memory deletion ops                  │
│   ├─ Context manager (sliding window + auto-   │
│   │     summarize + RAG retrieval + light app  │
│   │     context: time, mode)                   │
│   ├─ LLM gateway (LiteLLM)                     │
│   ├─ TTS gateway (piper / edge / sovits /      │
│   │              comfyui)                      │
│   ├─ Live2D bridge                             │
│   │     ├ VTS bridge (pyvts; param inject,     │
│   │     │     hotkey/expr trigger; auth-state  │
│   │     │     detection)                       │
│   │     ├ Lipsync: hybrid (our RMS / VTS opt)  │
│   │     └ Pixi bridge (v1.5)                   │
│   ├─ Avatar import pipeline (VTS .zip + raw    │
│   │     Cubism folders; auto-parse fallback)   │
│   ├─ Agent runtime                             │
│   │     ├ Router (same LLM as conversation)    │
│   │     ├ ScreenControlSubAgent (Claude SDK    │
│   │     │     + OmniParser + pyautogui + mss)  │
│   │     ├ CLISubAgent (subprocess: claude-code)│
│   │     ├ Verification (multimodal LLM,        │
│   │     │     screenshot-hash cache)           │
│   │     ├ Audit logger (per action)            │
│   │     └ Goal templates + scheduler           │
│   ├─ Skills loader                             │
│   │     ├ Manifest detect (yaml/json/toml)     │
│   │     ├ Auto-parser (preview → confirm)      │
│   │     └ Per-skill perm prompts (sticky)      │
│   ├─ Permissions controller                    │
│   │     ├ Agent strip (file / web / screen)    │
│   │     ├ Dir allowlist                        │
│   │     ├ Network egress: first-call prompts   │
│   │     └ Per-skill grants                     │
│   ├─ Crash recovery: snapshot + auto-resume    │
│   ├─ Telemetry (opt-in: crash + usage events)  │
│   └─ Backend health → reported to UI panel     │
└────────────────────────────────────────────────┘
```

### Layers
1. **UI shell** (Electron or Tauri — see §13.1): native windowing,
   sidecar process management, IPC to Python.
2. **SPA** (React + Vite): all UI logic.
3. **Backend service** (Python + FastAPI): WebSocket protocol same shape as
   OLVT (so we can copy plumbing). Single-user, local-first.
4. **External processes managed by backend**:
   - VTube Studio app (user runs separately; we connect via API)
   - LM Studio (optional; same)
   - ComfyUI (optional; same)
   - Claude Code CLI (subprocess, on-demand)

### Shell choice (Electron vs Tauri — see §13.1)
With mobile out of scope, the choice collapses to bundle-size-and-RAM
(Tauri wins) vs language-end-to-end-TS (Electron wins). The lean is
**Electron** because the team is TS-fluent and Rust-unfamiliar, and the
~150 MB bundle/RAM gap is invisible to the target user (companion users
already have VTube Studio open). Tauri remains a viable alternative if
bundle size becomes a release-blocker concern.

---

## 5. Component Breakdown

### 5.1 Conversation orchestrator
Mirrors OLVT's pattern: a chained-decorator pipeline.

```
raw token stream from LLM
   → sentence_divider     (pysbd-segmented chunks with tags)
   → actions_extractor    (extract [emotion] + [action] tags)
   → display_processor    (DisplayText with metadata)
   → tts_filter           (SentenceOutput: display_text, tts_text, actions)
   → TTSTaskManager.speak (parallel synth, ordered delivery)
   → WebSocket out
```

**Differences from OLVT:**
- `actions_extractor` emits `ActionIntent` JSON instead of expression-
  name strings (see §6).
- In agent mode, an additional `tool_use_extractor` decorator parses
  `<tool_use>` blocks for the agent runtime to consume — natural-language
  text still flows to TTS.
- **Reasoning blocks** (Claude extended thinking, o1/o3-style traces)
  are captured into a separate stream tagged for the chat UI's per-
  message expand chevron — never sent to TTS.

**Streaming UI:** assistant text appears in the chat panel
**sentence-by-sentence, synced with TTS playback** — each sentence
appears in chat as TTS plays it, matching the OLVT sentence-pipeline
model. Avoids users reading ahead of the avatar's voice.

### 5.2 Action compositor (the heart of avatar liveliness)
**Primary control surface is a continuous parameter stream, not discrete
hotkey triggers.** Hotkeys exist but are demoted to rare cases (prop
spawn, model-variant swap). Rationale spelled out in §11.

The compositor is a 60 Hz mixer that combines several driver layers into
a single `ParamFrame` stream sent to the renderer:

| Layer | Source | Examples |
|---|---|---|
| Idle baseline | rule-based: Perlin drift, micro-blink scheduler, eye saccades | head sway ±0.5°, blink every 3–7s, micro-blinks ~10% of full closes |
| Speech driver | TTS audio features (RMS, prosody, phoneme timing) | head nods on emphasis, body sway, mouth shape, brow micro-movements |
| Reaction driver | UI events (cursor pos, click region, drag) | head/eye tracking, click reaction, surprise blink |
| Intent overlay | sparse `ActionIntent`s from LLM (`[joy]`, `[shy]`) | continuous expression blend with smooth fade-in/fade-out |
| Discrete trigger | rare `DiscreteEvent`s | prop visibility, model variant swap |

**Driver implementations:**
- **v1**: rule-based DSP only (extends OLVT Phase 4's head-IN sway pattern
  to all drivers). Cheap, deterministic, debuggable.
- **v1.5**: light learned components — e.g., a small audio-to-params
  model for the speech driver only. Reference target: NeuroSync (already
  scoped as a sidecar in OLVT Phase 4 plan 04), Audio2Face-style models.
- **v2+**: a unified action control model that takes `(audio, intent,
  context)` and produces the full param stream. Trained on captured
  session data + hand-authored loops.

**Compositor outputs a `ParamFrame` every ~16ms** to whichever renderer
binding is active. The compositor is the *only* component aware of
multiple drivers; the renderer just consumes the stream.

> **Milestone-2 evolution:** the `Intent overlay` and body-sway portion
> of the Speech driver migrate out of the compositor into a swappable
> `BodyMotionPlugin` (see §14B). Idle, lipsync, cursor reaction, and
> Discrete trigger stay in the compositor. The compositor gains a
> per-param lock filter (see §14B.5).

### 5.3 Renderer binding
Translates `ParamFrame` and `DiscreteEvent` to live model calls. Stateless
w.r.t. the compositor — just executes whatever frame arrives.

- **Primary (v1)**: VTS bridge over pyvts. `ParamFrame` →
  `InjectParameterDataRequest` (VTS supports 60 Hz injection natively;
  this is the same path face-trackers use). `DiscreteEvent` → hotkey
  trigger / expression switch.
- **Fallback (v1.5)**: pixi-live2d-display in canvas. `ParamFrame` →
  `setParameterValueById` per param. `DiscreteEvent` → start expression
  motion.
- **Future**: native Cubism Web SDK (deferred). Same contract.

**Lipsync — hybrid path:** by default we drive `ParamMouthOpenY` from
the TTS audio RMS we already compute (a few lines added to the speech
driver). Per-avatar opt-in to VTS native lipsync (loopback) is available
for users who prefer it.

**Click-through during agent goal-loop:** the avatar window is rendered
click-through whenever the goal-loop is active so the agent's clicks
pass to the application underneath. Restored on goal end. Lives in the
Electron main process; the renderer binding only needs to know the
current mode so it can pause hover/drag handlers.

The contract guarantee: any of these three rendering backends can be
swapped in without touching the compositor, the LLM prompts, or the
conversation pipeline.

> **Milestone-2 evolution:** cursor sensor moves out of the renderer
> into the sidecar (OS-level global capture) so cursor-follow works
> regardless of VTS window state. The renderer gains a slider HUD
> (see §14B.5) on a separate HUD-mode IPC channel; the main
> ParamFrame path stays sidecar→VTS-direct.

### 5.3.1 VTS rig architecture realities (lessons from OLVT Phase 4)

VTube-Studio-built rigs use a **two-layer parameter architecture** that
is not visible from a model's parameter list alone. Cubism-standard
naming compliance is necessary but not sufficient for a renderer to
drive the rig correctly.

**Two layers:**
- **Input layer** (`ParamAngleX`, `ParamMouthOpenY`, …) — face-tracker
  write targets. Generally NOT bound to deformers in VTS rigs.
- **IN twins** (`ParamAngleXIN`, `ParamMouthOpenYIN`, …) — actual
  deformer inputs. VTS populates these by running the rig's
  `<model>.vtube.json` routing config (smoothing curves, ranges, dead
  zones, dampening).

When VTS is the renderer this is invisible — VTS does the routing
internally. When the renderer is *anything else* (pixi-live2d-display,
live2d-py, raw Cubism Native), writing to the input layer goes nowhere
because the deformer chain is waiting for the IN twins, populated by
routing the renderer never ran.

**Three failure modes (encountered while bringing up the OLVT Phase 4
Teto rig):**

1. **Routing-naive writes.** Writing a Cubism-standard input param like
   `ParamAngleX` is a silent no-op on a VTS rig in any non-VTS
   renderer. Two recovery options:
   - **Routing emulation**: read `<model>.vtube.json` and forward
     inputs through the configured curves to their `*IN` twins (OLVT's
     "Option A" patch on `lappmodel.ts`,
     `frontend-src/patches/lappmodel-vtube-routing.patch`).
   - **Direct IN-twin writes**: skip routing and write to
     `ParamAngleXIN` etc. directly, accepting loss of VTS-configured
     smoothing/curves.
2. **Orphan parameters.** A ParamID that resolves cleanly (and is even
   Cubism-standard) can still be deformer-orphaned: defined in the rig
   but bound to nothing. Direct writes silently no-op. SDK
   introspection (`GetParameterIds` etc.) cannot detect this — only
   inspecting the deformer/physics graph or empirically writing and
   visually verifying motion will. OLVT's initial TTS body-bob via
   `ParamBodyAngleX` was an orphan-param miss.
3. **Physics-chain shortcuts.** Sometimes the cleanest way to drive a
   region is via a related upstream param that the rig's physics chain
   forwards downstream. OLVT's TTS body sway is implemented as
   additive injection on `ParamAngleXIN` / `ParamAngleZIN` — the rig's
   physics evaluate then forwards those values to body deformers for
   free. Direct writes to body params were no-ops because they were
   orphaned.

**Renderer-binding implications (per backend):**
- **VTS via pyvts (v1)**: all of this is handled by VTS internally.
  `InjectParameterDataRequest` to `ParamAngleX` "just works." This is
  a primary reason VTS is the v1 renderer.
- **pixi-live2d-display (v1.5)**: requires routing emulation carried
  over from OLVT. Without it, all VTS-built rigs render dead.
- **live2d-py / Cubism Native (v2+)**: routing emulation has to be
  ported to Python. No standard library does this; we'd carry the
  logic ourselves. Alternative is direct IN-twin writes with no
  smoothing.

**Onboarding heuristic for a new rig (any non-VTS renderer):**
1. Check for `<model>.vtube.json` in the bundle. If present, it's a
   VTS rig — assume the two-layer architecture and run routing
   emulation.
2. On first activation, run a smoke pass: write each common-set
   logical param to a non-zero value and visually verify motion.
   Orphan params identified here go in the per-avatar override file
   either as `null` (compositor skips them) or routed via a
   physics-chain proxy param.
3. Persist findings (orphan list, physics-chain proxies, sign
   inversions) into the per-avatar override file so subsequent loads
   skip the smoke pass.

### 5.4 Memory subsystem
Hybrid (see §8):
- **Per-avatar profile** (filesystem-edited markdown/yaml/json with
  hot-reload on save): `personality.md`, `background.md`, `voice.yaml`,
  `quirks.md`, `actionMap.json`, `intentMap.json`, `entrance.yaml`,
  `hitZones.json`, `model.yaml` (per-avatar LLM params).
- **Per-avatar episodic store**: Chroma collection per `avatar_id`;
  each chunk tagged with `thread_id` so retrieval can bias toward the
  active thread while still surfacing cross-thread context (§13.120).
  **Per-turn-pair chunks** (each user+assistant pair is one chunk).
- **Shared user-facts bucket**: small Chroma collection readable by every
  avatar, write-on-explicit-promotion only. Stores durable facts like
  "user lives in Tokyo, prefers Pacific time." Bootstrapped from the
  optional first-launch "About me" prompt.
- **Chat full-text search**: SQLite FTS5 index over the active avatar's
  chat history, exposed as Ctrl+F.
- **Memory deletion**: per-message "forget this" button (removes from
  display + RAG + FTS) and per-avatar wipe ("forget everything from this
  avatar").
- **Memory write trigger**: session-end summarizer (on graceful close
  or N-min idle), every-50-turns checkpoint (avoids data loss on
  crash), plus an explicit "remember this" command.

**Retrieval strategy: hybrid vector + BM25 with reciprocal-rank-fusion.**
Per turn, run both vector top-k (Chroma) and BM25 top-k (rank_bm25 over
the same chunks); merge by RRF; pass top-5 to the prompt. Catches
semantic matches and exact-keyword recall (model numbers, names, dates).

**Encryption at rest:** plaintext on disk; rely on OS user-account
isolation. Standard for local-first apps.

**Profile validation on save:** hot-reload watcher detects parse errors;
logs to in-app log panel + shows toast; running session keeps the
previously-loaded config. Avatar continues working. User fixes and
saves again.

### 5.5 LLM gateway
LiteLLM as the single client. Provider selection in settings. Lists
supported: LM Studio (default), OpenAI-compatible custom, OpenAI,
Gemini, Anthropic.

**System prompt template** uses **XML-tagged sections** (Anthropic-
recommended; works fine on all providers):

```xml
<personality>...from personality.md...</personality>
<background>...from background.md...</background>
<quirks>...from quirks.md...</quirks>
<user_profile>name + about-me text + retrieved user-facts</user_profile>
<recent_memories>top-5 RRF-merged episodic chunks</recent_memories>
<app_context>current date/time, mode (companion/agent), thread label</app_context>
<instructions>persistent instructions for the avatar</instructions>
```

**Anthropic prompt caching: ON by default.** LiteLLM's pass-through
caches the system prompt block automatically; ~90% cost reduction on
cached tokens.

**Per-avatar `max_tokens`** declared in `model.yaml` or `voice.yaml`;
provider-aware default if absent (e.g., 4096 for Claude/GPT-4, 2048
for tiny local models).

**Sliding-window context manager** evicts oldest turns + summarizes
them in place. UI shows a subtle "older messages summarized" divider
in chat at eviction points.

**Provider switch mid-conversation** triggers a warn modal: "switching
to <provider> — context handling may differ; consider new thread."
User confirms; new turn hits new provider.

**Outbound transport** honors system proxy (HTTPS_PROXY, OS settings)
via httpx defaults — zero new code for corporate users.

### 5.6 TTS gateway
Dispatcher pattern with backend implementations:
- `piper` (ONNX, local, fast)
- `edge-tts` (online, free)
- `gpt-sovits-api` (voice clone, requires running GPT-SoVITS service)
- `comfyui` (graph-based; user supplies workflow JSON)

Selection is per-avatar via `voice.yaml`. The gateway also exposes a
**features tap** (RMS envelope, prosody, phoneme timing if available) to
the action compositor's speech driver — this is what produces continuous
talking-head liveliness.

**TTS playback model: sentence-buffered.** Per-sentence parallel synth
+ ordered queue (the OLVT pattern). First sentence plays while others
synthesize. Perceived latency = first-sentence-synth-time.

**GPT-SoVITS as external service**: app is a SoVITS-API client only.
User runs SoVITS themselves; `voice.yaml` declares the SoVITS URL and
model name. We do not bundle or manage SoVITS lifecycle.

**Audio output device**: in-app picker for input mic and output
speaker. **Hot-swap honored at next TTS turn boundary** — current
sentence finishes on old device; next sentence routes to new device.
No interruption of in-flight audio.

### 5.7 Agent runtime
Two sub-agents behind a router:
- `ScreenControlSubAgent`: Claude Agent SDK with computer-use tool,
  OmniParser for element detection, pyautogui+mss for action+capture.
- `CLISubAgent`: subprocess wrapper around `claude-code` (or
  OpenInterpreter for offline). Streams stdout, parses tool-use blocks.

Router uses the **same LLM the user has configured for conversation**;
classification is one extra LLM call per goal:
- "click/type/drag/screenshot" → screen control
- "read/edit files, run code, web search" → CLI delegation
- Both possible (e.g., "scrape this site and save as CSV") → sequential.

**Vision dependency:** agent mode requires a multimodal LLM. The UI
disables agent mode and explains why if the configured provider lacks
vision capability (most LM Studio defaults are text-only).

**Goal templates and scheduler:** users save successful goals as named
templates and either re-run one-click or schedule them (cron-style).
The scheduler runs in the Electron main process backed by the system
tray — scheduled goals fire only while the app is running or in tray.
Missed runs are reported on next launch and the user is prompted
whether to run the missed goal immediately (§13.121).

**Audit logger:** every act-step (click, type, file write, web call,
CLI delegation) is logged with `(timestamp, kind, target, outcome,
screenshot_ref)`. Reviewable in the agent panel. Exports as JSON.
Tool calls also surface in the chat panel as **compact inline cards
with expand-for-detail** (target, args, screenshot).

**Goal cancellation:** kill switch halts the loop immediately. The user
is then prompted whether to attempt a best-effort rollback of recent
reversible actions (file writes, opened files); irreversible actions
(sent emails, posted comments) are listed but not undone. Halt-by-
typing in chat is not supported.

**Step budget:** 30 steps default; user prompted to extend on hit.

**Mid-loop permission prompt:** when the agent attempts an action the
permission strip blocks, the loop pauses; modal asks "agent wants
<perm>; grant for this goal?" User decides — goal resumes or aborts.

**Terminal verdict confirmation:** before declaring DONE, the verifier
shows the user its verdict + final screenshot. Avatar speaks "I think
it's done — looks right?" User confirms or says "keep going". Catches
verifier false-positives at the cost of one extra click per goal.

**Companion-mode agent suggestion:** if the user asks something that
sounds like a goal in companion mode (e.g., "can you check my email?"),
the avatar replies in-character: "I can do that if you turn on Agent
mode" — discoverable without surprise mode switching. Detection is via
a system-prompt instruction; the LLM emits a `<suggest_agent>` tag
that the orchestrator turns into a UI-suggestion bubble.

**Saved goal templates** are **plain-text only** — no parameterized
variables. `{account}` / `{date}` are not expanded. Re-running a
template re-uses the goal text verbatim.

### 5.8 Verification loop
Same regardless of which sub-agent ran the act-step. Re-screenshot, ask
multimodal LLM "given this screenshot and goal `<G>`, is goal met /
progressing / blocked?" Cache by screenshot perceptual hash to avoid
re-asking on identical frames.

### 5.9 Skills loader
**Two skill systems** (separate, non-overlapping in v1 — §13.122):
- **CLI skills** are inherited from `claude-code` transparently —
  whatever skills the user has installed for claude-code work when the
  CLISubAgent delegates to it.
- **In-app screen-control skills** are loaded by the backend at startup
  and on hot-reload. Authoring format described in §9.x.

**Manifest discovery:** scan skill folder for `skill.yaml`, `skill.yml`,
`skill.json`, `pyproject.toml [tool.skill]` in priority order. Accept
any of YAML/JSON/TOML; normalize on load.

**Auto-parser fallback:** if no manifest is found or it fails schema
validation, the auto-parser inspects the directory: walks Python files,
identifies public functions, reads docstrings for descriptions, infers
declared permissions from imports. Builds a candidate manifest, shows
the user a preview, and **only installs after explicit confirm/edit**.
On confirm, writes the inferred manifest into the skill folder so
future loads skip auto-parse.

**Permissions:** skill manifests declare needed permissions. First time
a skill needs a permission, app prompts user; grant persists per skill
across sessions. Skill calls are routed only when (skill-grants ∩
agent-perm-strip) covers the call.

**Sandbox:** none — skills run in the same Python process as the app.
Trust burden is explicit: "only install skills you trust." Documented
loudly. Same model as Claude Code skills, VS Code extensions.

### 5.10 Permissions controller
Central gate for everything sensitive:
- **Agent permission strip**: file-ops / web / screen-control booleans.
  All default OFF; reset to OFF on app close (per-session re-grant).
- **File-ops directory allowlist**: when file-ops is on, agent (and CLI
  sub-agent) can only read/write inside user-managed allowlisted dirs.
  Default empty; user adds dirs in settings.
- **Network egress**: first-call prompt for unknown hosts. LLM/TTS
  configured-provider hosts are pre-approved. Skill-declared external
  hosts prompt with allow-once / always / deny.
- **Per-skill grants**: tracked separately; persist across sessions.

### 5.11 Hot-reload watcher
Filesystem watcher (chokidar in Electron, watchdog in Python) on
`avatars/<id>/`. On file save: profile reloaded into running session,
intent map / action map / voice config updated atomically. Already-
spoken sentences keep their voice; next turn picks up new config.
Compositor and conversation pipeline aren't restarted.

### 5.12 Crash recovery
Backend snapshots conversation state (current thread, pending TTS
queue, scheduler state) every N seconds. On relaunch after crash,
chat thread restores; in-flight TTS and goal-loops do not replay.
Avatar quietly resumes idle. Snapshot dropped on graceful shutdown.

---

## 6. Data Contracts

**Three-layer control surface.** Sparse semantic intents from the LLM and
ambient drivers all funnel into a continuous parameter stream the renderer
consumes at 60 Hz. Discrete events exist for the few operations that don't
fit a continuous-param model.

```python
# packages/contracts/control.py
from dataclasses import dataclass
from typing import Literal

# ─── Layer 1: ParamFrame — the wire to the renderer (60 Hz) ──────────
@dataclass
class ParamFrame:
    avatar_id: str
    params: dict[str, float]   # ParamID → value, e.g. {"ParamAngleX": 12.4}
    t_ms: int                  # monotonic frame timestamp

# ─── Layer 2: ActionIntent — sparse semantic from LLM / app events ───
@dataclass
class ActionIntent:
    kind: Literal["expression", "action", "reaction"]
    name: str                  # joy / hold-mic / wave / surprise-blink
    strength: float = 1.0      # 0..1 blend weight for continuous overlays
    duration_ms: int | None    # auto-decay; None = sticky until cleared
    avatar_id: str

# ─── Layer 3: DiscreteEvent — rare, non-continuous operations ────────
@dataclass
class DiscreteEvent:
    kind: Literal["hotkey", "model-variant-swap", "prop-spawn", "prop-clear"]
    name: str
    avatar_id: str
```

**Flow:**
1. LLM emits `[joy] [hold-mic]` in its text → action-extractor →
   `ActionIntent(kind="expression", name="joy", strength=1.0, duration_ms=None)`
   and `ActionIntent(kind="action", name="hold-mic", duration_ms=8000)`.
2. UI events (cursor move, click region, drag) emit
   `ActionIntent(kind="reaction", ...)` directly.
3. The action compositor (§5.2) merges all live intents with idle baseline
   and speech-driven motion into a `ParamFrame` every ~16ms.
4. Renderer binding (§5.3) ships the `ParamFrame` to the active backend
   (VTS / pixi / Cubism) via that backend's native param-set API.
5. `DiscreteEvent`s bypass the compositor — model variant swap, prop spawn,
   one-shot motion files. These are the only thing that maps to VTS hotkeys.

**Why this matters:** the LLM still emits semantic tags (`[joy]`,
`[hold-mic]`) — that part is unchanged from OLVT Phase 4. What changes is
the resolution: a tag becomes an `ActionIntent` with a duration and blend
weight, not a fire-and-forget event. The compositor is what makes the
avatar *continuously* expressive. Renderers stay swappable because the
`ParamFrame` contract is the only wire format they care about.

### Other contracts

```python
@dataclass
class ConversationMessage:
    thread_id: str
    role: Literal["user", "assistant", "system"]
    text: str
    audio_b64: str | None       # only on assistant turns with audio
    actions: list[ActionIntent] # extracted intents that fired
    images: list[bytes] | None  # multimodal user input
    t_ms: int

@dataclass
class ChatThread:
    thread_id: str
    avatar_id: str
    label: str                  # user-editable
    created_at: int
    last_active_at: int

@dataclass
class GoalUpdate:
    goal_id: str
    step: int
    phase: Literal["plan", "act", "verify"]
    summary: str                # in-character one-liner for narration
    action: dict | None         # what was done
    screenshot_ref: str | None  # path under cache/screenshots/<goal_id>/
    verdict: Literal["progressing", "blocked", "done"] | None

@dataclass
class AuditEvent:
    goal_id: str
    step: int
    t_ms: int
    kind: Literal["click", "type", "drag", "file_read", "file_write",
                  "web_call", "cli_delegate", "skill_call"]
    target: str                 # element selector / file path / URL / tool name
    outcome: Literal["ok", "error", "skipped"]
    error: str | None
    screenshot_ref: str | None

@dataclass
class SavedGoalTemplate:
    template_id: str
    name: str                   # "Genshin daily" — user-editable
    goal_text: str              # PLAIN TEXT only (no template params in v1)
    permissions: dict           # snapshot of perm strip required at run time
    schedule: str | None        # cron expression, None = manual
    last_run_at: int | None
    last_run_status: str | None

@dataclass
class UserProfile:
    name: str                   # display name in chat (set in Settings)
    about_me: str               # free-form bio paragraph; injected as <user_profile>
    locale: str                 # for i18n; defaults to system locale

@dataclass
class SkillManifest:
    manifest_version: int       # = 1 in v1
    name: str                   # slug
    version: str                # semver
    author: str
    description: str
    permissions: list[str]      # subset of {file_ops, web, screen_control}
    network_hosts: list[str]    # hosts the skill expects to contact
    tools: list[dict]           # [{name, entrypoint, description, schema}]

@dataclass
class MemoryWrite:
    bucket: Literal["per_avatar_thread", "shared_user_facts"]
    avatar_id: str | None       # None for shared bucket
    thread_id: str | None
    text: str                   # chunk text
    summary: str
    embedding: list[float]
    t_ms: int

@dataclass
class Permission:
    file_ops: bool
    web: bool
    screen_control: bool
    file_dirs_allowlist: list[str]   # only meaningful if file_ops is True
```

These contracts define the WebSocket message shapes, the disk-persisted
state, and the boundaries between major components. They are checked into
`packages/contracts/` and consumed by both Python and TypeScript via
codegen (datamodel-code-generator → TS types).

---

## 7. Library Inventory

Curated to minimize self-built code. All libraries listed below are MIT/
Apache/BSD or have clearly-stated terms compatible with a closed/open
release.

| Concern | Library | Rationale |
|---|---|---|
| Desktop shell | **Electron** (lean) or **Tauri 2.x** | TS-end-to-end shell config wins for TS-fluent team; see §13.1 |
| SPA | **React + Vite + TypeScript** | mainstream, recruitable |
| WebSocket protocol | follow OLVT's shape | proven, code reuse |
| LLM gateway | **LiteLLM** | one API → all providers; OpenAI-compatible |
| Live2D — VTS control | **pyvts** | already targeted |
| Live2D — canvas fallback | **pixi-live2d-display** | runs in browser, no VTS needed |
| Screenshots | **mss** | cross-platform, fast |
| Mouse/keyboard | **pyautogui** | well-supported; consider **pynput** for low-level events |
| GUI element detection | **OmniParser v2** (Microsoft) | screen → labeled bbox list; far better than raw OCR for click targeting |
| Vision LLM | Claude / Gemini multimodal via LiteLLM | both handle screenshots cheaply |
| TTS — fast/local | **piper** (ONNX) | well-suited for low-latency local |
| TTS — natural | **edge-tts** | free online fallback |
| TTS — character voice | **GPT-SoVITS** | already targeted; voice cloning |
| TTS — bespoke | **ComfyUI** | already targeted; graph-based |
| ASR | **faster-whisper** | already in OLVT |
| Memory — vector | **chromadb** (embedded mode) | local, no service to run; or **lancedb** if perf issues |
| Memory — embeddings | **sentence-transformers** (`bge-small-en` or `multilingual-e5-small`) | small, local-friendly |
| Code/file/web sub-agent | **Claude Code CLI** subprocess | best-in-class; we don't rebuild it |
| Code sub-agent (offline) | **OpenInterpreter** | fallback when offline |
| Computer-use sub-agent | **Anthropic Claude Agent SDK** with computer-use tool, OR DIY ReAct | see §13.3 |
| Web search | **Tavily API** | already targeted |
| Chat full-text search | **SQLite FTS5** | embedded, no service; Ctrl+F over chat history |
| Filesystem watch (Python) | **watchdog** | hot-reload of profile files |
| Filesystem watch (TS) | **chokidar** | renderer-side reload notifications |
| Cron scheduler | **APScheduler** | Python-native cron parsing + persistence |
| i18n | **react-i18next** | English-only translations day 1; scaffold for future |
| State persistence | **electron-store** | window pos/size, last avatar, theme |
| Auto-update | **electron-updater** (notify-only) | mature; we ship without auto-install |
| Crash reporting | **Sentry SDK** (opt-in) | crash + opt-in usage events |
| Image input handling | browser Clipboard + drag-drop APIs | native, no library |
| Backend packaging | **PyInstaller** or **pyoxidizer** | self-contained Python sidecar binary |
| Audit log persistence | SQLite | per-goal events; queryable |
| Saved goals + scheduler state | SQLite | persisted to user-data dir |
| Token/cost tracking | LiteLLM's built-in usage metadata | reuse the gateway's own counters |
| Avatar import — Cubism file structures | **live2d-cubism-tools** Python wrappers if available, else direct JSON parsing | minimal — just identify model3.json roots |
| Avatar import — VTS .zip | direct zip + json | no library needed |
| OmniParser fallback OCR | **PaddleOCR** | when OmniParser-v2 isn't viable |
| Wake word | (none — raw VAD per §round-10) | OLVT's silero-vad already handles VAD |
| VAD | **silero-vad** | already in OLVT; medium default sensitivity, slider in settings |
| Hybrid retrieval — BM25 | **rank_bm25** | pure-python; pairs with Chroma vector for RRF |
| Reciprocal-rank-fusion | hand-rolled (~30 lines) | combines BM25 + vector top-k |
| Prompt caching | **LiteLLM** native (Anthropic pass-through) | ~90% cost reduction on cached system prompts |
| ASR sizing | faster-whisper model size selectable | default `small`; `tiny`/`base`/`medium` user-pickable |
| HTTP transport / proxy | **httpx** defaults (honors HTTPS_PROXY, OS proxy) | corporate users covered with zero new code |
| Drag physics | hand-rolled momentum + edge-resistance | ~30 lines |
| App data location | electron's `app.getPath('userData')`; settings override | OS-standard with 'move data' option |
| Schema migrations | hand-rolled per-version migrators | `manifest_version: N` field on each schema; auto-migrate on load |

---

## 8. Memory Strategy

**Three layers, edited via filesystem, hot-reloaded on save.**

### Layer 1 — Per-avatar profile (markdown / yaml / json)
Files in `avatars/<avatar_id>/`:
- `personality.md` — voice, mannerisms, speech patterns
- `background.md` — backstory, lore, immutable identity
- `quirks.md` — likes/dislikes, catchphrases, idle-proactivity setting
- `voice.yaml` — TTS backend + params + lipsync mode (our-RMS / VTS-native)
- `actionMap.json` — `[tag] → discrete event` (props, variant swap)
- `intentMap.json` — `[tag] → ActionIntent` (continuous overlays, durations,
  blend curves)
- `entrance.yaml` — optional entrance motion declaration

These are **always** loaded into the system prompt. Filesystem-edited
only — no in-app editor in v1; reveal-folder button in the avatar panel.

**Why markdown beats RAG for this layer:** identity should be
deterministic and debuggable. RAG retrieval can drop critical facts
because embedding similarity chose differently. Profile content is small
(tens of KB) — fits in the prompt trivially.

### Layer 2 — Per-avatar episodic memory (RAG)
- Chroma collection per `avatar_id`; chunks tagged with `thread_id`
  for retrieval bias (§13.120).
- Each chunk: turn pair (user + assistant) + auto-generated summary.
- Retrieved by similarity each turn (top-k=5 or so).
- Written by the **session-end summarizer** or on explicit "remember
  this" command.
- Per-message "forget this" deletes from RAG + FTS + chat display.

### Layer 3 — Shared user-facts bucket
- Single Chroma collection readable by every avatar.
- Holds durable facts about the user that should persist across
  avatars: "lives in Tokyo," "uses he/him," "is allergic to peanuts."
- Write path: per-avatar episodic chunks can be **promoted** to the
  shared bucket either by user command ("remember this about me, not
  about us") or by an auto-promoter that recognizes user-fact patterns
  during summarization.
- Wipe-all UI separately controllable from per-avatar memory.

### What goes into the system prompt (per turn)
Per round 12: profile (Layer 1) + retrieved memories (Layer 2 + Layer 3
top-k) + light app context (current date/time, current mode
companion/agent, active thread label). Active screen context is **not**
included by default — that's a future feature gated on screen permission.

### Privacy toggle
User can disable persistent memory entirely. Disabled = in-process
only, wiped on app close. UI is a single toggle in avatar settings.

### Why not just one approach
- All-RAG: identity drift, prompt-injection-ish behavior when bad chunks
  retrieve.
- All-markdown: doesn't scale; can't do similarity-based recall.
- Frameworks (Letta/MemGPT, Zep): heavier than needed for v1 and lock
  you into their schemas. Hybrid is ~150 lines of code.

---

## 9. Agent Strategy

**Recommendation: router with two specialist sub-agents.**

### Router
Lightweight LLM call that classifies the goal:
- *click/type/drag/desktop GUI* → ScreenControlSubAgent
- *read/edit files, run code, web search* → CLISubAgent
- *both* → sequential plan (router decomposes)

### ScreenControlSubAgent
**Recommendation: Claude Agent SDK with computer-use tool for v1**, with a
DIY fallback path planned for offline / non-Anthropic providers.

Reasoning:
- Anthropic computer-use is the closest-to-working solution today.
- SDK gives us tool-use scaffolding for free.
- Cost: ties this sub-agent to Claude. For v1, that's acceptable; making
  the *companion* provider-agnostic (it is via LiteLLM) is more important
  than making the *agent* provider-agnostic.

DIY alternative path (later):
1. mss screenshot
2. OmniParser → labeled element list
3. LLM ReAct turn ("which element to click? what to type?") via LiteLLM
4. pyautogui executes
5. Re-screenshot, verify

### CLISubAgent
Subprocess wrapper around `claude-code` (or OpenInterpreter when offline).
Captures stdout, parses for structured updates, streams progress to chat.
Permission strip is enforced by *not invoking* the CLI when its scope is
disallowed (we don't pass user permissions through to claude-code; the
gate is at our process boundary).

### Verification loop
Re-screenshot + multimodal LLM "is goal met / progressing / blocked?"
Cache by screenshot perceptual hash. Step budget per goal (default 30
acts) with user prompt to extend on hit.

### Why not "just route everything to claude-code"
Claude Code does not do GUI automation. It is excellent at file/code/
web tasks but cannot click on a Genshin daily check-in button. The
ScreenControlSubAgent is the unique value-add of this app.

### Why not "build everything ourselves"
Re-implementing claude-code's permission model, skills system, tool
registry, web search integration, and bash/file tools would burn months
of engineering for no differentiation. Subprocess delegation gets us
those features today.

### Saved goals + scheduler
Successful or user-saved goals become `SavedGoalTemplate` entries. Two
ways to invoke:
1. **One-click**: dropdown in agent panel, click → goal-loop runs with
   the template's saved permissions and goal text.
2. **Cron schedule**: template declares a cron expression. APScheduler
   inside the Python sidecar fires the goal at scheduled times.

Scheduler runs in the Python sidecar; the Electron main keeps the
sidecar alive while in system tray. Scheduled goals fire **only while
the app is running or in tray**. If the scheduled time falls while the app is closed, the
missed run is queued and the user is prompted on next launch whether
to run it now (§13.121).

Scheduled goals must have permissions pre-granted in the template
itself. Since per-session permissions reset on app close, templates
support a **per-template permission grant** ("for THIS template,
screen-control is always on"), surfaced prominently in settings with a
badge so the elevated grant is visible (§13.121).

### Audit log
Every act-step writes an `AuditEvent` to a per-goal SQLite table.
Reviewable in the agent panel; exportable to JSON. Retained until
goal-history viewer's user-configured expiration (per round 7 Q2).

### Goal cancellation
Kill switch (triple-Esc global hotkey or stop button) halts the loop
immediately. User is then prompted whether to attempt best-effort
rollback of recent reversible actions:
- file writes → revert from snapshot if available
- opened files / tabs → close
- partial form fills → leave (irreversible)
- network calls → cannot reverse
- CLI delegations → terminate subprocess; whatever it wrote stays

### In-app screen-control skills
A skills system specifically for screen-control extensions (different
from claude-code's skills, which cover code/file/web). Authoring shape:

```
my-skill/
  skill.yaml              # manifest (or .yml / .json / pyproject.toml)
  main.py                 # public functions are auto-detected as tools
  README.md               # optional
```

Manifest example:
```yaml
manifest_version: 1
name: genshin-helpers
version: 0.1.0
author: someone
description: Helpers for Genshin Impact daily routines
permissions: [screen_control]
network_hosts: []
tools:
  - name: claim_daily_checkin
    entrypoint: main.py:claim_daily_checkin
    description: Click through the daily check-in screen
    schema: {}              # JSON-schema for tool args (optional)
```

If a skill ships without a manifest, the auto-parser inspects `main.py`
and proposes one. User confirms/edits; on confirm the inferred manifest
is written to disk. Schema-tolerant import that never silently runs
unknown code.

**Coexistence with claude-code's skills**: separate, non-overlapping
in v1 — CLI skills only fire under CLISubAgent; in-app skills only fire
under ScreenControlSubAgent. Bridge layer deferred to v1.5 if real
cross-domain skills emerge (§13.122).

---

## 10. Mobile Strategy

**Out of scope for this project.** A future mobile companion is planned
as a **separate project** with potentially a different technology stack
(likely native or web-based) and is not constrained by the choices in
this design.

What this means for the desktop architecture:
- No need to share an SPA codebase with mobile.
- No need for a relay server, QR pairing, or remote-control protocol.
- WebSocket protocol is **localhost-only** for v1; cross-device pairing
  is not designed in.
- Tech-stack decisions (Electron vs Tauri, Python vs Node backend) can
  be made on desktop merits alone.

When the mobile project starts, it will define its own design doc. If
sharing happens, the natural seam is the **WebSocket protocol** — the
mobile app could connect to the desktop service as another client over
LAN, but only if the future mobile project decides that's worth the
work. Nothing here blocks that path; nothing here requires it either.

---

## 11. Live2D Approach

**v1 path: VTube Studio + pyvts.**

### Rationale
- VTube Studio handles all rendering, deformer math, physics, lipsync.
- pyvts handles the WS API.
- We send `ActionEvent` JSON; pyvts translates to API calls.
- Zero Cubism SDK code in our repo.

### Caveats
- User must install + run VTube Studio (free tier supported).
- VTS pro features (some hotkeys, live tracking) are paid; we don't depend
  on those.
- Permission: VTS API requires user-grant on first connect (one-time popup
  in VTS).

### v1.5 path: pixi-live2d-display fallback
Fallback when VTS is not running (or user opts out). Browser-side rendering
via pixi.js. Lower fidelity (no physics), but no external dependency.

### Future: native Cubism Web SDK
Deferred. Mobile path. Cubism license needs review for distribution
(`cubism4-sdk-for-web` — the runtime is freely usable for personal/
non-commercial; commercial requires Live2D Inc. license).

### Action control philosophy — continuous, not hotkey-driven

Inspiration: Neuro-sama's avatar visibly does not run on a hotkey graph.
Half-blinks, micro-nods, idle micro-saccades, body sway during speech,
smooth blends between emotions with no popping shifts — all of these
require **continuous parameter modulation at frame rate**, not discrete
trigger events.

Hotkeys / pre-authored expressions are still in the toolbox, but only
for things genuinely discrete: spawning a prop, swapping a model
variant, firing a one-shot motion file. The bulk of avatar liveliness
comes from the **action compositor (§5.2)** producing a continuous
`ParamFrame` stream.

**Three-layer separation of concerns** (locked):
1. **LLM** outputs semantic tags only. It never sees deformer math.
2. **Action compositor** is the place where intent + audio + UI events
   are mixed into a continuous param stream. Rule-based DSP for v1; a
   learned model can replace individual drivers later without changing
   the contract above or below it.
3. **Renderer binding** is dumb. It receives `ParamFrame` and writes the
   params, period. VTS / pixi / Cubism are interchangeable here.

This means:
- The LLM never has to learn deformer values, so any model — local 7B,
  GPT-4, Claude — works equivalently for the avatar layer.
- Migrating from rule-based DSP to a trained action model is a
  compositor-internal change. No prompt changes, no renderer changes,
  no contract changes.
- Migrating from VTS to native Cubism (mobile path) is a renderer-
  binding swap. The compositor and the entire pipeline above it don't
  notice.

**Hotkeys are demoted, not deleted.** They're for `DiscreteEvent`s only
(prop visibility, variant swap). Anything that should ramp/blend is a
continuous overlay handled by the compositor, even if it originates as
a one-word `[wave]` tag from the LLM.

### Avatar parameter sets — hybrid common + per-avatar overrides
Compositor drivers target a **standardized common parameter set**
(head X/Y/Z, eye blink, brow up/down, mouth open Y, body sway X/Y/Z).
This means the speech driver, idle driver, etc. work on any imported
avatar without per-avatar configuration.

Each avatar's `intentMap.json` and `actionMap.json` provide
**rig-specific overrides** for prop mounts, accessories, and any rig
parameters outside the common set (e.g., Teto's `ParamBHandIN`,
`ParamSVMCON`). Default drivers handle the common motion vocabulary;
advanced users tune rig-specific behavior.

**Important:** the logical-name → ParamID resolution is more involved
than a flat name table because of the VTS two-layer architecture
described in §5.3.1. For VTS-built rigs the resolver targets the IN
twin (`ParamAngleXIN`) rather than the input layer (`ParamAngleX`), and
the per-avatar override file additionally records orphan params and
physics-chain proxy substitutions discovered during the import smoke
pass.

### Avatar import pipeline
Two formats accepted (per round 2 Q2):
- **VTS .zip bundles** (exported from VTube Studio)
- **Raw Cubism folders** (model3.json + textures + Motions/ + Expressions/)

On import:
1. Detect format (zip vs directory).
2. Locate `model3.json`. Validate references.
3. Generate scaffolding `personality.md`, `voice.yaml`, `model.yaml`,
   `hitZones.json`, etc., with commented placeholders.
4. Auto-build initial `intentMap.json` from any `.exp3.json` files
   discovered (one expression-blend entry per file, user can edit).
5. Avatar appears in dropdown, ready to switch to.

### Hit zones for click reactions
`hitZones.json` declares named regions (head, tummy, arm) with
`ActionIntent` overlays + optional TTS one-liner pools. Compositor
applies the intent overlay; TTS gateway picks a one-liner if voice is
unmuted. Authored per-avatar for personality.

```json
{
  "regions": [
    {"name": "head", "shape": "circle", "x": 0.5, "y": 0.2, "r": 0.08,
     "intent": {"name": "happy", "duration_ms": 1500},
     "lines": ["hey~", "stop poking!", "...mm?"]}
  ]
}
```

### Avatar drag physics
Drag-and-move uses **light inertia + edge resistance, no bounce**.
Release with small momentum that decays smoothly; gentle resistance at
canvas/window edges. Lifelike without being silly.

### Canvas background
**Fully transparent** in both windowed and pet modes — chrome shows
through in windowed; desktop shows through in pet. Same renderer
behavior across modes.

### Voice / personality language is decoupled from UI language
The avatar's `voice.yaml` declares its language (e.g. `ja-JP`). The
UI's i18n locale is global and defaults to system locale. Users can
run the app in English while their Japanese avatar speaks Japanese.

---

## 12. LLM / TTS / ASR Stack

### LLM (priority order)
1. **LM Studio** (default; OpenAI-compatible at `http://localhost:1234/v1`)
2. **Custom OpenAI-compatible endpoint** (Ollama, vLLM, llama.cpp server,
   etc.)
3. **OpenAI**
4. **Google Gemini**
5. **Anthropic Claude**

All routed through LiteLLM. Single env var or settings dropdown
switches provider. **Anthropic prompt caching is on by default**; HTTP
transport honors system proxy.

**Per-avatar params** (`model.yaml`): temperature, top_p, max_tokens.
Provider-aware default if absent (e.g., 4096 max_tokens for Claude/
GPT-4, 2048 for tiny local models).

**Token / cost tracking**: usage metadata captured per call (LiteLLM's
built-in counters). Surfaced in **Settings panel** only — no
status-bar live counter.

### TTS (priority order)
1. **piper** (ONNX, local, low-latency) — default
2. **edge-tts** (online, free, natural)
3. **GPT-SoVITS** (voice clone, requires running service; we are a
   client, user runs SoVITS themselves)
4. **ComfyUI** (graph-based, advanced users)

Per-avatar selection in `voice.yaml`. Backend dispatcher picks the
right one. Sentence-buffered playback (parallel synth + ordered queue).
Audio output device picker honors hot-swap at TTS sentence boundaries.

### ASR
**faster-whisper**, mirroring OLVT. **Default model size: `small`**
(~244 MB). User-configurable in settings: `tiny` / `base` / `small` /
`medium`.

### VAD
**silero-vad**, raw VAD (no wake word). Medium default sensitivity;
slider in settings with live preview meter.

---

## 13. Decisions Log

All v1 design decisions are resolved as of round 29 (123 numbered
decisions across 28 brainstorming rounds; Q&A log preserved in
conversation history; results folded into the sections above). This
section is the single-source-of-truth index for traceability.

### 13.1 — 13.40: Resolved decisions

Summary table; section text above is the source of truth.

**Foundation (rounds 1–4):**

| # | Decision | Resolution |
|---|---|---|
| 13.1 | Tauri vs Electron | **Electron** (TS-end-to-end for TS-fluent team) |
| 13.2 | VTS-only or +pixi fallback | **VTS required v1; pixi fallback v1.5** |
| 13.3 | Claude Agent SDK vs DIY screen-control | **SDK for v1**; DIY-swap interface kept |
| 13.4 | Verification frequency | **Every step + screenshot-hash cache** |
| 13.5 | Memory write trigger | **Session-end + every 50 turns + 'remember this'** |
| 13.6 | Default agent permissions | **All-off; per-session re-grant** |
| 13.7 | Single vs multi-user | **Single-user; multi-user OOS** |
| 13.8 | Python vs Node backend | **Python** (OLVT-pipeline head-start) |
| 13.9 | v1 action compositor | **Rule-based DSP**; speech driver swappable v1.5 |
| 13.10 | Form factor | **Windowed default, pet mode toggle** |
| 13.11 | Compositor parameter set | **Hybrid common + per-avatar overrides** |
| 13.12 | Voice input mode | **Both PTT and VAD; user-toggleable** |

**Avatar lifecycle (round 2):**

| # | Decision | Resolution |
|---|---|---|
| 13.13 | Default avatar | **CC-permissive licensed model**; Teto dev-only |
| 13.14 | Import formats | **Both VTS .zip and Cubism folders** |
| 13.15 | Idle behavior | **Per-avatar configurable** |
| 13.16 | Interruption | **Both VAD interrupt + stop button** |

**Runtime UX (rounds 3, 6):**

| # | Decision | Resolution |
|---|---|---|
| 13.17 | First launch | **Block until LLM configured** |
| 13.18 | Session resume | **Resume last conversation** |
| 13.19 | Agent narration | **Milestone-only; configurable** |
| 13.20 | Click reactions | **Expression + TTS one-liner + state effect** |
| 13.21 | Click-through during agent | **Enabled only during goal-loop** |
| 13.22 | Step budget | **30 with extend prompt** |
| 13.23 | Hot-reload | **Auto on file save** |
| 13.24 | Permission granularity | **Coarse strip** |

**Security + ops (rounds 4, 7):**

| # | Decision | Resolution |
|---|---|---|
| 13.25 | File scope | **User-managed dir allowlist** |
| 13.26 | Permission persistence | **Per-session re-grant** |
| 13.27 | Kill switch | **Hotkey + stop button** |
| 13.28 | Default voice | **piper ONNX** |
| 13.29 | Vision verifier | **Always require multimodal; block agent if not** |
| 13.30 | Screenshot retention | **Disk + goal-history viewer + user-set expiration** |
| 13.31 | Backend packaging | **PyInstaller-bundled** |
| 13.32 | LLM unreachable | **Retry+backoff + chat error** |

**Compositor + memory + skills (rounds 5, 8, 9, 12, 13):**

| # | Decision | Resolution |
|---|---|---|
| 13.33 | Multi-avatar simultaneous | **One at a time** |
| 13.34 | Agent visibility | **Stay put with click-through during loop** |
| 13.35 | Router model | **Same LLM as conversation** |
| 13.36 | Chat in pet mode | **Separate dockable window** |
| 13.37 | Lipsync source | **Hybrid: our-RMS default, VTS opt-in** |
| 13.38 | Profile editing | **Filesystem only** |
| 13.39 | Translation | **Auto-detect input lang; reply in same** |
| 13.40 | State persistence | **Window pos/size/mode + last avatar** |
| 13.41 | Entrance motion | **Avatar-declared; fade-in fallback** |
| 13.42 | Telemetry | **Opt-in crash + anonymized usage** |
| 13.43 | Export | **Markdown per conversation** |
| 13.44 | Update mechanism | **Notify-only, manual install** |
| 13.45 | Wake word | **None — raw VAD** |
| 13.46 | Audio devices | **In-app picker** |
| 13.47 | Onboarding | **Skip-able 3-step tour** |

**Threading + extensibility (rounds 11, 13, 14, 15, 16, 17, 18):**

| # | Decision | Resolution |
|---|---|---|
| 13.48 | Backend autostart | **Eager + watchdog** |
| 13.49 | i18n | **Scaffold + English-only translations** |
| 13.50 | Hotkeys | **User-rebindable from day 1** |
| 13.51 | Logs | **Reveal folder + in-app panel** |
| 13.52 | Memory isolation across avatars | **Per-avatar episodic + shared user-facts** |
| 13.53 | Prompt context | **Profile + memories + light app context** |
| 13.54 | Image input | **Yes — paste/drag/picker** |
| 13.55 | UI theme | **Follow system; user override** |
| 13.56 | Skills system | **Both: claude-code's CLI + in-app screen-control** |
| 13.57 | Goal templates | **Yes, saved + scheduled** |
| 13.58 | Chat scrollback | **Virtualized infinite scroll** |
| 13.59 | VTS auth flow | **Detect remembered state, guide once** |
| 13.60 | Skill manifest format | **YAML/JSON/TOML accepted** |
| 13.61 | Auto-parser flow | **Show preview → require confirm** |
| 13.62 | Skill perms | **Manifest declares; per-skill prompt persists** |
| 13.63 | Skill sandbox | **None; trust burden on user** |
| 13.64 | Skill distribution | **Drop folder; auto-parse on malformed** |
| 13.65 | Memory deletion | **Per-message forget + per-avatar wipe** |
| 13.66 | Cost tracking | **Settings panel only (no status bar)** |
| 13.67 | Settings UI | **Single long scrollable, sectioned** |
| 13.68 | Goal cancellation | **Halt + user-decide rollback prompt** |
| 13.69 | Chat-during-agent | **Yes, parallel** |
| 13.70 | Audit log | **Per-action with screenshot ref** |
| 13.71 | Chat search | **FTS5, active-avatar scope** |
| 13.72 | Goal scheduling | **Yes, cron via APScheduler** |
| 13.73 | Network egress | **First-call prompt for unknown hosts** |
| 13.74 | Context management | **Sliding window + auto-summary** |
| 13.75 | Crash recovery | **Auto-resume chat; no goal-loop replay** |
| 13.76 | Chat threading | **Multi-thread per avatar (ChatGPT sidebar)** |
| 13.77 | Schedule scope | **App open or in tray** |
| 13.78 | Sound effects | **Subtle, configurable** |
| 13.79 | Canvas size | **User drag-resizable** |

**Prompting + retrieval + UX details (rounds 19–28):**

| # | Decision | Resolution |
|---|---|---|
| 13.80 | Prompt format | **XML-tagged sections** |
| 13.81 | Memory retrieval | **Hybrid vector + BM25 + RRF** |
| 13.82 | Permission denial | **Mid-loop prompt to grant for goal** |
| 13.83 | Template parameters | **Plain text only (no {placeholders})** |
| 13.84 | Verdict trust | **Show verdict + screenshot, require confirm before DONE** |
| 13.85 | Export content | **Text + action tags + agent goal summaries** |
| 13.86 | Stream UI | **Sentence-by-sentence synced with TTS** |
| 13.87 | Canvas background | **Fully transparent** |
| 13.88 | Tour content | **Avatar interactions → chat+voice → agent toggle** |
| 13.89 | Audio device hot-swap | **At next TTS turn boundary** |
| 13.90 | Proxy support | **Honor system proxy** |
| 13.91 | Backup/restore | **Folder-copy of user-data, documented** |
| 13.92 | Thread naming | **LLM auto-generated from first turns** |
| 13.93 | Launch greeting | **Per-avatar configurable in personality.md** |
| 13.94 | Drag physics | **Light inertia + edge resistance** |
| 13.95 | Reasoning UI | **Hidden by default; per-message expand chevron** |
| 13.96 | LLM model params | **Per-avatar in voice.yaml/model.yaml** |
| 13.97 | Tool calls in chat | **Compact inline cards, expandable** |
| 13.98 | Schema versioning | **Version field + auto-migrate-on-load** |
| 13.99 | Companion-mode agent suggest | **Avatar suggests switching to agent mode** |
| 13.100 | TTS streaming | **Sentence-buffered (parallel synth + ordered queue)** |
| 13.101 | ASR size | **Default `small`; user-configurable** |
| 13.102 | User identity | **Settings 'About me' + name + shared user-facts RAG** |
| 13.103 | Per-thread system prompt | **No user-facing override (filesystem only)** |
| 13.104 | Memory chunking | **Per-turn-pair + 50-turn checkpoint** |
| 13.105 | Hit zones | **Per-avatar hitZones.json** |
| 13.106 | Lang decoupling | **Voice/personality per-avatar; UI global** |
| 13.107 | Provider switch | **Warn + apply on next turn** |
| 13.108 | Close button | **Configurable: quit/tray/ask** |
| 13.109 | VAD sensitivity | **Medium default + slider** |
| 13.110 | Context evict UI | **Subtle 'older summarized' divider** |
| 13.111 | Edit/regen | **Both: regenerate response + edit user message** |
| 13.112 | Memory crypto | **Plaintext + OS isolation** |
| 13.113 | Profile validation | **Surface error; keep last good config** |
| 13.114 | Other media input | **Images only v1; PDF/audio/video deferred** |
| 13.115 | Chat-driven stop | **No (button + hotkey only)** |
| 13.116 | Data location | **OS-standard, configurable in Settings** |
| 13.117 | Prompt caching | **On by default for Anthropic** |
| 13.118 | Token cap | **Per-avatar configurable, provider-aware default** |
| 13.119 | Voice model import | **External SoVITS service; we are a client** |
| 13.120 | Thread × memory boundary | **Per-avatar bucket; thread-tagged chunks; retrieval bias 70/30 same/cross-thread** |
| 13.121 | Scheduled-goal perms + missed runs | **Per-template permission grant (visible badge); prompt-on-next-launch for missed runs** |
| 13.122 | Skill-system coexistence | **Separate, non-overlapping in v1; bridge layer deferred to v1.5** |
| 13.123 | Default avatar source | **Live2D Inc. sample model (Hiyori/Mark/Wanderer); Teto stays dev-only** |

### 13.120 Multi-thread × episodic memory boundary
With multiple labeled chat threads per avatar (round 18 Q1), the
episodic-memory bucket is **per-avatar with thread-tagged chunks**:
one Chroma collection per `avatar_id`, every chunk carries a
`thread_id` field, and the retriever can up-weight chunks from the
current thread without losing cross-thread continuity. This preserves
"you mentioned in another chat that…" while still keeping the active
thread on top of the result list.

Implementation notes:
- Default retrieval mix: 70% same-thread similarity, 30% cross-thread
  similarity (tunable in advanced settings).
- "Forget this thread" UI deletes chunks where `thread_id == X` from
  the avatar's collection, leaving other threads intact.
- Shared user-facts bucket is unaffected (always cross-thread).

### 13.121 Scheduled goal permissions + missed-run handling
Two coupled answers:

**Permission stickiness for scheduled goals**: per-template grant. A
saved goal template can carry its own permission strip (file/web/
screen) that persists across sessions independently of the per-session
default. UI surfaces this prominently — settings page lists every
template with elevated permissions, and each scheduled-goal entry in
the agent panel shows a badge whenever it has standing permissions.
This is a deliberate, visible exception to the per-session security
model rather than a hidden backdoor.

**Missed-run handling**: prompt on next launch. If a scheduled time
arrives while the app is closed, the run is logged as missed and the
user is shown a notification at next launch ("missed Genshin daily at
7am — run now?") with run-now / skip / disable-template options. No
silent skips; no surprise auto-fire.

### 13.122 Skill-system coexistence
The two skill systems (claude-code CLI skills, in-app screen-control
skills) are **separate and non-overlapping for v1**:
- CLI skills only fire under CLISubAgent (delegated to `claude-code`
  via subprocess).
- In-app screen-control skills only fire under ScreenControlSubAgent
  (loaded by our backend).

Each system keeps its own permission model. A capability that needs
both file-read and screen-control (e.g., "fill out my expense report")
is currently authored as two skills, one per system.

A **bridge layer** — in-app skills calling `claude-code` as a sub-tool
via a wrapper — is deferred to v1.5 if and when real cross-domain
skills emerge in practice.

### 13.123 Default avatar source
Ship the **Live2D Inc. sample model** (Hiyori / Mark / Wanderer) as
the default avatar in release builds. Kasane Teto remains
development-only and is never bundled into shipped artifacts.

Trade-off: not ours, slightly weakens product identity, but the legal
status is clean, the asset is high-quality, and zero commission cost
or schedule risk. If/when commissioning a distinctive original avatar
becomes worthwhile, it can be added as an additional bundled default
without removing the Live2D sample.

---

## 14. Walking Skeleton (Suggested First Deliverable)

Goal: validate the stack end-to-end without building unique features.

### Scope
- Electron shell (windowed mode only — no pet mode in skeleton)
  wrapping a React SPA, TS-end-to-end shell
- Python sidecar with FastAPI WebSocket, PyInstaller-bundled is a
  v1 concern; skeleton can run sidecar from venv
- LiteLLM connected to LM Studio (default)
- Mandatory LLM setup screen on first launch
- One VTS avatar via pyvts (development uses Teto, dev-only)
- OLVT-style conversation pipeline ported (sentence_divider →
  actions_extractor → tts_filter → TTS queue)
- **Minimal action compositor** running at 60 Hz with three drivers:
  - Idle baseline (slow head sway + blink scheduler)
  - Speech driver (TTS RMS → head/body sway, lifted from OLVT Phase 4)
  - Intent overlay (blend in expression on `[joy]`/`[shy]` etc. with
    smooth fade)
  - `ParamFrame` stream → pyvts `InjectParameterDataRequest`
- piper TTS only
- Lipsync via our-RMS path
- Companion mode only — no agent mode, no scheduler, no skills, no
  memory persistence, no multi-thread chat
- Single chat thread, in-memory only; clears on relaunch
- One avatar, hardcoded intent map with 3 expressions, 1 prop discrete event

### Out of scope of skeleton (explicitly deferred to subsequent phases)
- Agent mode and goal-loop (whole §9)
- Saved goals + scheduler
- Skills system + auto-parser
- Memory subsystem (profile loading, RAG, FTS, deletion)
- Multi-thread chat
- Pet mode (form-factor toggle and click-through)
- Avatar import pipeline
- Multiple TTS backends
- Multi-avatar switching
- pixi fallback (v1.5)
- Audio-to-params sidecar / learned drivers
- Voice input (PTT, VAD)
- Image input
- Telemetry, auto-update, audit log
- i18n strings (English hardcoded for skeleton)

### Success criteria
1. User types "hello" → avatar speaks reply with sync'd lipsync
2. LLM emits `[joy]` → expression smoothly blends in over ~300ms and
   decays after the sentence ends — **not a hotkey pop**
3. While avatar is silent, idle baseline produces visible micro-motion
   (drift, blinks, occasional head turn)
4. While avatar speaks, speech driver produces visible body/head sway
   continuously through the utterance, no flat moments
5. Cursor over canvas → avatar tracks (eye/head)
6. WebSocket pipeline shape matches OLVT's so we can copy fixes back

### Estimated effort
~2 weeks with one engineer familiar with OLVT internals. The compositor
is the new work; everything else is OLVT plumbing port. Subsequent
phases (memory, agent, scheduler, skills, multi-thread, pet mode) layer
on top — each phase a 1–3 week chunk.

---

## 14B. Milestone 2: Animation Architecture Refactor

**Goal:** Separate animation control from the system core so body-motion
strategies are swappable, expose the rig's full parameter surface via an
in-app slider HUD with per-param locks for parameter discovery, and
formalize a three-category LLM code system (action / variant / event)
that lets plugin authors extend the LLM system prompt cleanly.

This milestone executes after §14 walking skeleton ships. It does not
re-architect the conversation pipeline, TTS layer, or VTS integration —
those stay as walking-skeleton built. It refactors the animation layer
that Phase 4 surfaced as rig-coupled.

### 14B.1 Motivation

Three Phase-4 deliverables surfaced architectural gaps the walking
skeleton cannot fix in place:

1. **Body sway not real on Teto** (R-OPEN-1). Teto's rig exposes
   face/head inputs, not direct `ParamBodyAngle*` mappings. The
   compositor's body-sway driver writes to params with no deformer
   binding, producing no visible motion. The Phase 4 investigation
   confirmed there is no rig-agnostic system-level fix — body-sway
   shape is rig-specific and must be a strategy decision, not a
   hardcoded driver.
2. **Cursor tracking only fires inside the VTS window.** The
   renderer-side cursor tracker reads canvas-relative coordinates
   that go silent when the cursor leaves the canvas. Global
   cursor-follow needs OS-level capture, not renderer-canvas events.
3. **`[joy]` not in Teto's capability list.** Phase 4's
   hotkey-expression-resolver only fires for tags that exist as
   hotkeys/expressions on the rig. Teto exposes Cry / Star Eye /
   chibi but not joy. The headline §14 SC #2 demo can't be staged on
   Teto without a rig-aware fallback.

Common root cause: **the system tries to make rig-specific motion
decisions on behalf of the user**. The fix is to invert — system
exposes the rig's full surface, a swappable plugin (or the user, via
sliders) decides what motion looks like.

### 14B.2 Architectural Deltas vs Milestone-1

| Surface | Milestone-1 | Milestone-2 |
|---|---|---|
| LLM tag system | Single `[xxx]` namespace | Three: `[action]`, `{variant}`, `<event>` |
| Body-motion strategy | Hardcoded compositor drivers (`Intent overlay`, body-sway) | Swappable plugin (single-active, startup-pinned) |
| Compositor responsibilities | Idle + Speech (full) + Reaction + Intent + Discrete | Idle + Speech (lipsync only) + Reaction (cursor) + plugin-output ingest + lock filter |
| Cursor sensor | Renderer-side, canvas-relative | Sidecar-side, OS-level global capture |
| Rig parameter access | Curated list via tag → ParamID resolver | Full rig surface exposed via slider HUD with per-param locks |
| Avatar import | Engineer commits override yaml | User-facing import flow with auto-extracted catalogs + mandatory review screen |
| OLVT compatibility | Protocol-shape parity | OLVT `model_dict.json` directly importable |

### 14B.3 Three-Category Code System

| Category | Syntax | Domain | Persistence | Catalog source |
|---|---|---|---|---|
| **Action** | `[joy]`, `[wave]`, `[nod]` | Plugin | Continuous param flow | Plugin's `plugin.yaml` declares the vocabulary |
| **Variant** | `{hold-mic}`, `{bread-out}`, `{dark-face}` | System | Toggle (on until next change) | Auto-extracted from rig file or per-avatar override |
| **Event** | `<wave>`, `<flick>`, `<tap>` | System | One-shot motion (auto-completes) | Auto-extracted from `.motion3.json` files |

**Disambiguation rules:**
- Different syntax per category — zero collision possibility (Plan A,
  locked in design discussion 2026-05-08).
- Reserved names (`<think>`, `<tool_call>`, `<function_call>`) blocked
  at registration time — they collide with LLM-protocol semantics.
- Catalog uniqueness within a category enforced at avatar+plugin load.

### 14B.4 Plugin Runtime

- **Discovery:** `plugins/` (in-tree, ships defaults) + `app.getPath('userData')/plugins/` (user-installed).
- **Manifest:** `plugin.yaml` per plugin: `name`, `version`, `entrypoint` (`module:class`), `api_version`, `action_codes` (with descriptions for system-prompt assembly).
- **Entrypoint:** Python class implementing `BodyMotionPlugin` ABC with `on_load(capabilities)`, `on_token_stream(tokens)` (async generator yielding `ParamFrame`), `on_unload()`.
- **Lifecycle:** Single-active, switched at startup (developer config); no runtime hot-swap in milestone-2 (deferred to milestone-3 if demand surfaces).
- **System prompt assembly:** plugin's action codes + descriptions appended to base prompt under a fixed delimiter so the LLM knows the vocabulary it can emit.
- **Default plugin** ships with the system, absorbs current Phase-4 `[joy]` and body-sway logic, uses OLVT's `emotionMap` as its action-code vocabulary (8 entries: neutral / anger / disgust / fear / joy / smirk / sadness / surprise). Default plugin reads `RigCapabilities` and adapts: if `ParamBodyAngleX` is orphaned (Teto), emulates body sway via head/face params instead.

### 14B.5 Slider HUD with Per-Param Locks

- **Sidecar tap:** compositor output stream tapped before `pyvts` send, throttled to 15 Hz, forwarded to renderer as a HUD-mode IPC channel (separate from main protocol; only active when HUD open — preserves AVT-01's "renderer never sees 60 Hz traffic" rule for non-HUD operation).
- **Renderer HUD:** scrollable list of all writable params (per `RigCapabilities`), each row: param name, slider, lock toggle.
- **Lock semantics:** per-param boolean. When locked, compositor skips writes from plugin and built-in drivers for that param. Lock auto-engages on slider drag; user clicks lock toggle to release.
- **System-primitive override:** lipsync still wins on `MouthOpenY` even when locked (system primitives override locks for safety — speech without mouth movement looks broken). Documented exception, not silent.
- **Filters:** "show writable" / "show currently animating" / "show locked".
- **Persistence:** session-only; cleared on app restart (locks are a discovery tool, persisting them across sessions surprises users).

### 14B.6 Avatar Import Flow

- **Type detection:** from file shape — VTS standard (has `.vtube.json`), Cubism with named expressions (`model3.json` `FileReferences.Expressions` populated), Cubism bare (no expressions, motions only).
- **Auto-extraction draft per shape:**
  - VTS → variants from hotkeys with `Action: "ToggleExpression"`, names derived (strip `[N]` keybind suffix, strip `【】` decorative brackets, lowercase, hyphenate).
  - Cubism w/ expressions → variants list named after `Expressions[].Name` (often generic like `exp_01`).
  - Cubism bare → empty variant catalog (avatar is plugin-only).
  - All shapes → events from `.motion3.json` files, named after `Motions` group keys + filenames.
- **Review screen (mandatory):** user always sees the auto-extracted catalogs and edits names, deletes irrelevant entries, or skips. No silent automation — the system can't guarantee correct semantic naming, and `exp_01`-style placeholders are useless to LLMs without human relabeling.
- **OLVT `model_dict.json` import:** drop-in support — system reads OLVT's existing `model_dict.json` and pre-populates the review screen. OLVT users migrate without retyping vocabulary.
- **Persistence:** decisions write to `_avatar_overrides.yaml` (per-avatar, sibling to `avatar.yaml`).
- **Re-open:** review screen accessible from settings at any time for catalog edits.

### 14B.7 Phase Breakdown

Five phases, sequential. Phase 4's body-sway gap and Phase 5's verification land in milestone-1 first; milestone-2 does not block on a perfectly clean §14 verification record but inherits the body-sway investigation report as its starting context.

| Phase | Goal | Headline Deliverable |
|---|---|---|
| **6. Plugin Runtime + Default Plugin** | Plugin API + manifest loader + system-prompt assembly + default-plugin port | Developer can swap plugin via config and see different motion behavior |
| **7. Three-Category Code Parsing** | `{xxx}` and `<xxx>` parsers + reserved-name guard + uniqueness check + system dispatch (variants → VTS items/expressions, events → motions) | LLM emits `[joy] {hold-mic} <wave>` in one response and three distinct paths fire |
| **8. Avatar Import + Catalog Auto-Extraction** | Type detection + per-shape extractors + OLVT `model_dict.json` reader + review UI | New avatar imported via UI yields working variant + event catalogs after user review |
| **9. Slider HUD + Per-Param Lock** | Sidecar compositor tap + HUD-mode IPC + renderer slider grid + lock filter | User opens HUD, drags any param, lock auto-engages; releasing returns control to plugin/system |
| **10. Cursor Rewrite + Milestone Verification** | Sidecar OS-level cursor capture → head/eye angles, delete renderer tracker; re-run §14 SCs against refactored architecture | Cursor outside VTS window still tracked; six §14 SCs pass under new architecture |

**Gating:** each phase has an exit criterion the next relies on. Phase 6 must produce a working default plugin before Phase 7's parsers have something to dispatch action codes to. Phase 8 must produce variant/event catalogs before Phase 7's variant/event parsers have anything to validate against.

### 14B.8 Estimated Effort

~5–8 weeks single engineer. More than walking skeleton's ~2 weeks because:

- Plugin runtime + manifest + system-prompt assembly is fresh code (no OLVT analog).
- Avatar import flow is greenfield UI work (review screen, catalog editor).
- Slider HUD is a new IPC channel + new renderer surface.
- Cursor rewrite is small but the §14 verification re-run is the integration point that can surface latent regressions in the refactor.

### 14B.9 Open Questions Deferred to Plan-Phase

- Plugin dependency story when plugin authors want extra Python packages (milestone-2 default: no isolation, plugins use host venv; revisit if friction).
- HUD-mode IPC throttle exact rate (15 Hz proposed; benchmark against dropped-frame perception during fast-changing params).
- Lock arbitration when user grabs slider on `MouthOpenY` while lipsync is writing (proposed: lipsync still wins — system primitives override locks for safety).
- `motion3.json`-based event auto-completion timeout (motion files have a duration; system uses that vs hardcoded ceiling).
- Multi-language LLM system prompts: when user's chat language is non-English, are the action-code descriptions translated or kept English-LLM-canonical?

---

## 15. Risks & Unknowns

### R-1: VTS API rate limits / instability
pyvts has hit issues with high-frequency param injection. Mitigation:
batch param updates per frame; throttle to 60 Hz.

### R-2: Computer-use accuracy
OmniParser + Claude computer-use is impressive but not reliable for
arbitrary games (anti-cheat may detect input injection; visual layouts
shift). Mitigation: explicitly scope v1 to "non-anti-cheat workflows
like daily check-ins, web forms, calendar"; carve anti-cheat games out
of supported scope.

### R-3: Latency budget for goal-loop
Each iteration = screenshot + parse + LLM call + execute + screenshot +
verify-LLM. 5–15s per step is realistic. 30-step goal = 5 minutes.
Mitigation: aggressive caching, parallel where possible, reasonable
expectations in UX copy.

### R-4: Live2D licensing
Cubism for commercial use needs Live2D Inc. licensing. Mitigation:
defer Cubism direct integration; rely on VTube Studio (which has its
own license terms users accept) for v1.

### R-5: TTS quality vs latency tradeoff
piper is fast but robotic; GPT-SoVITS is natural but slow + needs
a running service. Mitigation: per-avatar choice; ship piper as
zero-config default.

### R-6: Cross-platform testing
Mac/Windows/Linux differ for screen capture, mouse control, and audio
playback. Mitigation: CI matrix from day 1; mss + pyautogui handle most
of it but edge cases will surface.

### R-7: Privacy / safety
Agent that controls the user's screen is a serious capability. Mitigation:
permission strip mandatory, off by default; on-screen kill switch
(Esc-Esc-Esc); audit log of every act; no automatic enabling across
sessions.

### R-8: Skill system trust model
Skills run unsandboxed in the app process — a malicious skill has full
process access. Mitigation: clear "only install trusted skills" warning
on import, manifest-declared permissions visible to user, per-skill
permission grants via popup, future v2 could add subprocess isolation
or signature verification.

### R-9: Scheduler reliability
Scheduled goals only fire while app is running. Users may expect
unattended automation that doesn't happen because they closed the app.
Mitigation: make tray-vs-quit behavior explicit in the close-button
flow ("close to tray vs quit"); settings option for "always start in
tray on system boot" (login item).

### R-10: VTS API auth re-prompts
VTube Studio re-prompts plugin auth each launch unless user checks
"remember." Confusing for new users. Mitigation: detect remembered
state via API and show one-time guide ("check the Remember box in
the VTS popup"). Fail gracefully when auth denied.

### R-11: Vision model lock-out for local-only users
Agent mode requires multimodal LLM (round 7 Q1). Most LM Studio defaults
are text-only — users will hit "agent mode disabled" immediately.
Mitigation: clear UI explanation listing supported configs (LM Studio
+ a vision model, Anthropic, OpenAI vision, Gemini), link to setup
docs, allow companion mode unaffected.

### R-12: Multi-thread retrieval-mix tuning (§13.120 resolved)
Per-avatar bucket with thread-tagged chunks (§13.120) introduces a
retrieval-mix knob (default 70/30 same-thread/cross-thread). Bad
weights surface RP context in serious threads or vice versa.
Mitigation: ship the default; expose the slider in advanced settings;
log retrieval traces in debug mode; gate noisy cross-thread chunks
with a similarity floor.

### R-13: Scheduled-goal permission backdoor (§13.121 resolved)
Per-template permission grants (§13.121) weaken the per-session
security model by design. Mitigation: surface scheduled-goal
permissions prominently in settings (dedicated "Templates with
standing permissions" list); visible badge in the agent panel whenever
a template has elevated permissions saved; require re-confirmation if
a template's permission strip is widened post-creation.

### R-14: Hybrid retrieval tuning
Vector + BM25 RRF gives good recall in theory but the merge weights
need calibration; bad weights can elevate noise over relevant chunks.
Mitigation: ship sane defaults, expose tuning in advanced settings,
log retrieval traces in debug mode.

### R-15: SoVITS service availability
Avatars configured for GPT-SoVITS fail silently if the user's SoVITS
service isn't running. Mitigation: health-check on TTS dispatch; on
failure, fall back to piper for that turn with toast notification.

### R-16: Schema migration breakage
Auto-migrations can corrupt user data if a forward migrator has bugs.
Mitigation: snapshot avatars/ + memory dirs before migration runs;
offer rollback if errors surface.

### R-17: Verifier confirmation fatigue
Requiring user confirm before every DONE adds friction. For trivial
goals ("open my email"), the extra click feels like the agent is
asking permission to succeed. Mitigation: per-template auto-confirm
toggle in goal-template settings; default keeps confirm-required.

### R-18: Sentence-buffered TTS first-utterance latency
First sentence's synth time gates everything else. With piper that's
~200-500ms; with GPT-SoVITS it can be 1-3s. Mitigation: warmup synth
at app launch (cache one-token render); show TTS-buffering indicator
in chat after sentence appears so user knows audio is coming.

### R-19: Plugin runtime trust + API stability (milestone-2)
Plugins are Python code loaded into the sidecar process — no sandbox.
Malicious or buggy plugins can crash the sidecar, leak memory, or
write unbounded ParamFrames. Two mitigations: (a) plugin manifest
declares `api_version`, system refuses to load incompatible plugins;
(b) ParamFrame values clamped to `[0, 1]` before pyvts send (compositor
safety pass). No plugin signing or sandboxing in milestone-2 — same
trust model as skills system (§13.122). Revisit if plugin marketplace
becomes a goal.

---

## 16. Out of Scope (v1)

- **Mobile companion** — separate future project with its own stack and
  design doc; this design imposes no constraints on it
- Cross-device pairing / remote control / relay servers
- Group avatars / multi-character scenes
- Voice cloning UI (users supply their own GPT-SoVITS model)
- Plugin/extension marketplace (skill registry / catalog)
- Cloud-hosted memory sync
- Multi-user / family accounts
- Anti-cheat-game automation
- Native Cubism Web SDK rendering
- Auto-update auto-install (notify-only in v1)
- Skill code signing / sandboxed execution
- Per-avatar custom sound packs (default UI sounds only)
- Per-avatar canvas size declarations (user drag-resize only)
- Active screen-context injection into the system prompt (gated future
  feature, requires screen permission)
- Scheduled goals running while app is fully closed (tray required)
- Agent best-effort rollback for irreversible actions (sent emails,
  posted comments — listed only)
- Screen-context skill marketplace
- Provider-side fallback chains (single provider with retry, not
  multi-provider failover)
- PDF / audio file / video uploads as inputs (images only in v1)
- Chat-driven stop commands (button + global hotkey only)
- Memory encryption at rest (plaintext + OS isolation)
- SoVITS lifecycle management (we're an API client; user runs it)
- Goal template parameterization ({account}, {date} placeholders)
- Per-thread system prompt overrides (filesystem profile editing only)
- Wake word activation (raw VAD only)
- In-app marketplaces (skill catalog, voice catalog, avatar catalog)

---

## 17. Glossary

- **VTS** — VTube Studio
- **OLVT** — Open-LLM-VTuber (this repo, predecessor)
- **ParamFrame** — per-frame param vector wire format from compositor to
  renderer (60 Hz). The primary control contract.
- **ActionIntent** — sparse semantic intent (`[joy]`, `[hold-mic]`,
  `[wave]`) emitted by LLM or UI events; consumed by the compositor as
  an overlay weight, not a fire-and-forget event.
- **DiscreteEvent** — rare non-continuous operation (prop spawn, model
  variant swap). The only path that maps to VTS hotkeys.
- **Action compositor** — 60 Hz mixer that combines idle baseline +
  speech driver + reaction driver + intent overlays into a ParamFrame
  stream. The unique-value avatar component.
- **Driver** — one input layer to the compositor (idle, speech, reaction,
  intent overlay). Swappable; rule-based v1, learned v2.
- **Renderer binding** — backend-specific consumer of `ParamFrame` /
  `DiscreteEvent`. VTS via pyvts, pixi-live2d-display, or Cubism Web SDK.
- **IN twin** — in a VTS-built rig, the deformer-bound counterpart of a
  Cubism input parameter (`ParamAngleXIN` for `ParamAngleX`). The IN
  twin is what VTS populates by running `<model>.vtube.json` routing.
  Non-VTS renderers must either emulate the routing or write IN twins
  directly. See §5.3.1.
- **Orphan parameter** — a ParamID that exists on a model but is bound
  to no deformer in the rig. Writes silently no-op. Detected only by
  smoke-test or rig-graph inspection. See §5.3.1.
- **Routing emulation** — code that reads `<model>.vtube.json` and
  forwards face-tracker-style inputs through the rig's configured
  curves to the IN twins. Required for any non-VTS renderer to drive
  VTS-built rigs. OLVT ships an "Option A" patch implementing this for
  pixi-live2d-display.
- **vtube.json** — VTube Studio's per-model routing config: input
  params, target IN twins, smoothing curves, ranges, dead zones. The
  contract between face-tracker-style writes and deformer-bound IN
  twins.
- **intentMap** — per-avatar mapping from semantic tag (`[wave]`) to
  `ActionIntent` shape (with duration, blend curve, etc.). Successor to
  OLVT Phase 4's `actionMap`.
- **Goal-loop** — agent mode's plan/act/verify iteration
- **Companion mode / Agent mode** — the two product surfaces
- **Sub-agent** — specialist agent (ScreenControl, CLI) invoked by router
- **Walking skeleton** — minimum end-to-end build that exercises every
  layer without unique features
- **actionMap** — per-avatar mapping from semantic tag to `DiscreteEvent`
  (prop spawn, variant swap, hotkey trigger). Strictly for the
  rare-discrete-operation case.
- **SavedGoalTemplate** — a successful or user-saved goal stored for
  one-click re-run or cron-scheduled execution.
- **Goal scheduler** — APScheduler-driven service inside the Python
  sidecar that fires saved goals at configured cron times. Active only
  while app is running or in tray.
- **Audit log** — per-action record of what the agent did (timestamp,
  kind, target, outcome, screenshot ref). SQLite-persisted per goal.
- **Skill** — Python module installed under `skills/` declaring tools
  the agent runtime can call. Each skill has a manifest declaring name,
  permissions, network hosts, and tool entrypoints.
- **Skill manifest** — YAML/JSON/TOML descriptor of a skill (auto-parser
  generates one if missing, requires user confirm before install).
- **Auto-parser** — fallback that infers a candidate manifest by
  inspecting the skill's Python files. Never installs without user
  confirm.
- **Permission strip** — three booleans (file_ops, web, screen_control)
  that gate agent capabilities. All-off default; per-session re-grant.
- **Shared user-facts bucket** — single Chroma collection readable by
  every avatar, holding durable user identity facts.
- **Per-avatar episodic memory** — Chroma collection scoped to an
  avatar, with chunks tagged by `thread_id` for retrieval bias toward
  the active thread (§13.120).
- **Click-through (avatar window)** — Electron-controlled mode that
  routes mouse events through the avatar's transparent window so the
  agent's clicks reach the application underneath. Active only during
  goal-loop.
- **Pet mode** — form-factor toggle where the avatar lives in a
  transparent borderless always-on-top window with chat in a separate
  dockable window.
- **Hot-reload** — filesystem watcher that picks up profile/intentMap/
  voice changes and applies them mid-session without restart.
- **UserProfile** — per-app-user identity (name + about-me text +
  locale) injected into the system prompt as `<user_profile>`.
- **Hit zones** — per-avatar `hitZones.json` mapping click regions on
  the canvas to `ActionIntent` overlays + optional TTS one-liner pools.
- **RRF (Reciprocal Rank Fusion)** — merge strategy for combining
  vector-similarity top-k and BM25 top-k retrieval results into a
  unified hybrid ranking.
- **XML-tagged system prompt** — system prompt assembly format using
  `<personality>`, `<recent_memories>`, etc. Anthropic-recommended;
  works on all providers.
- **Sliding-window context manager** — keeps the most-recent N turns
  verbatim and a rolling auto-generated summary of older turns. UI
  shows a divider in chat at eviction points.
- **Sentence-buffered TTS** — per-sentence parallel synth + ordered
  playback queue (the OLVT pattern). Plays first sentence as soon as
  it's ready; later sentences queue.
- **Mid-loop permission prompt** — modal that pauses the goal-loop
  when the agent attempts an action denied by the strip; user can
  grant for this goal only.
- **Verdict confirmation** — UX checkpoint where the verifier shows
  its terminal verdict + final screenshot to the user, and waits for
  confirm before declaring DONE.
- **Companion-mode agent suggestion** — when the user asks for a
  goal-shaped task in companion mode, the avatar suggests enabling
  agent mode rather than acting silently.
- **Schema migration** — auto-applied forward migrators for profile/
  manifest/contract files declaring `manifest_version: N`. Snapshot
  before run; rollback offered on errors.
- **Action code (milestone-2)** — `[xxx]` LLM-emitted token, plugin-domain.
  Drives continuous param flow. Plugin's `plugin.yaml` declares the vocabulary.
- **Variant code (milestone-2)** — `{xxx}` LLM-emitted token, system-domain.
  Toggles persistent avatar state (props, costume, dark face). Catalog
  auto-extracted from rig file, user-reviewed at avatar import.
- **Event code (milestone-2)** — `<xxx>` LLM-emitted token, system-domain.
  Triggers a one-shot motion (auto-completes by motion file duration).
  Catalog auto-extracted from `.motion3.json` files.
- **BodyMotionPlugin (milestone-2)** — Python class implementing the
  plugin ABC. Consumes LLM token stream, emits `ParamFrame` stream.
  Single-active per app launch; switched via developer config.
- **plugin.yaml (milestone-2)** — plugin manifest declaring `name`,
  `version`, `entrypoint`, `api_version`, and `action_codes` map.
  System reads this to assemble LLM system prompt.
- **Slider HUD (milestone-2)** — in-app debug panel exposing all
  writable rig params with sliders + per-param lock toggles. Sidecar
  taps compositor output at 15 Hz to update slider positions; user
  drags sliders to override params; lock auto-engages on drag.
- **`_avatar_overrides.yaml` (milestone-2)** — per-avatar override file
  sibling to `avatar.yaml`. Holds user-reviewed variant + event catalog
  names. OLVT `model_dict.json` can be imported into this format.

---

*Document owner: TBD. Source-of-truth for design decisions until a
formal RFC/ADR process is in place. Update via PR; reference section
numbers in commit messages.*
