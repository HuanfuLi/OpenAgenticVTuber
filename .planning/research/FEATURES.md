# Feature Research

**Domain:** Local-first desktop Live2D VTuber companion app (walking-skeleton scope) with v1-horizon agentic capability
**Researched:** 2026-05-06
**Confidence:** HIGH for table-stakes / anti-features (multiple competitors converge); MEDIUM for differentiator durability (compositor, multi-avatar identity — verified novel today, but the space moves fast)

> **Reading guide for downstream consumers (roadmap, requirements):** This document categorizes features against the **walking-skeleton milestone** (PROJECT_DESIGN.md §14), NOT the full v1 horizon. Sections are split:
>
> - **§ Walking-skeleton table stakes** — must ship to pass §14 success criteria
> - **§ Walking-skeleton differentiators** — features in skeleton scope that already differentiate the product (the compositor, sentence-buffered TTS, OLVT-shape protocol)
> - **§ Deferred to later v1 milestones** — features users will eventually expect but are out of skeleton scope by design (memory, agent, scheduler, multi-avatar, multi-thread)
> - **§ Anti-features** — things explicitly NOT in v1 (mobile, multi-user, anti-cheat games, etc.)
>
> Recommend ONLY the skeleton-scoped features for v1 requirements.

---

## Ecosystem Survey (How We Got Here)

The 2026 local-first Live2D companion space has crystallized around a recognizable feature shape. Surveyed peers:

| Project | What it is | Stack | Notable |
|---------|-----------|-------|---------|
| **Open-LLM-VTuber (OLVT)** | Voice-first Live2D companion, multi-LLM, multi-TTS | Python backend + web frontend | Direct predecessor; this project is the successor with a different stack philosophy |
| **Project AIRI (moeru-ai/airi)** | Self-hosted "soul container" for AI VTubers, Live2D + VRM, Minecraft/Factorio play | Web/macOS/Windows, WebGPU/WebAudio | Closest peer in agentic ambition; explicitly chasing Neuro-sama altitude |
| **Soul of Waifu** | Roleplay-focused desktop companion, Live2D + VRM, 28-emotion mapping | Desktop, local LLM | Strong on emotion variety + desktop-pet form factor |
| **AI Desktop Pet (Steam)** | Live2D pet with built-in local LLM, zero-config | Desktop, bundled LLM | Sets the "no setup" UX bar |
| **Desktop Companion / Mekio / CielChan** | Live2D companion with screen awareness or memory | Various | Confirms screen-vision and persistent memory are widespread |
| **Questie AI** | Sub-500ms voice latency AI co-host for VTubers | Streaming-focused | Latency benchmark reference |
| **Claude Desktop / ChatGPT Desktop / LM Studio / AnythingLLM** | Non-VTuber desktop AI assistants | Various | Set the chat-UX baseline (markdown, code highlighting, MCP, RAG) |

**What every shipping local-LLM Live2D companion in 2026 has:**
1. A Live2D avatar with lipsync (almost universally microphone-RMS-based)
2. Local LLM compatibility (Ollama/LM Studio/llama.cpp at minimum)
3. Voice input (Whisper) AND text input
4. Some form of expression mapping from LLM output (tags or emotion classification)
5. A desktop-pet / always-on-top mode
6. Persistent memory or summarization
7. Screen awareness (vision or screenshot input) as either default or opt-in

**What no peer has cracked well:**
- Continuous compositor-driven liveliness — peers still ship hotkey-pop expression triggers; the OLVT lineage's RMS→head-sway is rare and `[joy]`-tag-blended-over-300ms is rarer still
- Multi-avatar **identity** (per-avatar episodic + shared user-facts) — most ship "switch the skin, keep the chatbot"
- Saved + scheduled agent goals running in-tray — agent demos exist, scheduled-goal templates with persistent permission grants are not standard

This is what the skeleton is laying foundations for.

---

## Walking-Skeleton Table Stakes

Features that MUST ship in the walking skeleton to feel like a product (not a tech demo). Mapped to PROJECT_DESIGN.md §14 success criteria where applicable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Live2D avatar visible on screen** | Universal — every peer does this. Without an avatar there is no product. | LOW | VTS+pyvts handles rendering; we just inject params. PROJECT.md Active list. |
| **Lipsync during TTS playback** | Universal. RMS→`ParamMouthOpenY` is the OLVT lineage's path. | LOW | Skeleton uses our-RMS path (PROJECT.md Active). VTS-internal lipsync deferred. |
| **Text chat → LLM reply with TTS playback** | Universal. Without a working chat the avatar is decorative. | MEDIUM | OLVT pipeline port: sentence_divider → actions_extractor → tts_filter → TTS queue. §14 success #1. |
| **Mandatory LLM setup on first launch** | All peers (LM Studio, AnythingLLM, OLVT) gate initial use on configured provider. Without it users hit cryptic errors. | LOW | PROJECT.md Active list: block until provider URL/key tested. Default LM Studio @ localhost:1234 via LiteLLM. |
| **Working window + chrome (windowed mode only)** | Without a real window the app feels like a script. | LOW | Electron + React+Vite shell already in PROJECT.md Active. Pet mode deferred. |
| **Cursor-in-canvas eye/head tracking** | Every Live2D companion has it. Its absence reads as "the avatar is dead." | LOW | OLVT has this; port directly. Drives `ParamAngleX/Y` + `ParamEyeBallX/Y` from cursor delta. PROJECT.md Active. |
| **Idle baseline motion (blinks + drift)** | Without it the avatar looks frozen between turns. Universal expectation set by Neuro-sama lineage. | MEDIUM | Compositor idle driver: Perlin drift + blink scheduler. §14 success #3. |
| **Continuous speech-driven motion during TTS** | Hotkey-pop expressions read as "old-school VTuber tool, not AI companion." Continuous motion is what makes Neuro-sama feel alive. | MEDIUM-HIGH | Compositor speech driver: TTS RMS → head sway. §14 success #4. **Body-sway-on-VTS is R-OPEN-1 — may ship head-only with documented rationale.** |
| **LLM intent tag → smooth expression blend** | Hotkey pops are the #1 thing users complain about with Live2D AI VTubers ("looks robotic"). The blend over ~300ms is the headline UX promise of the skeleton. | MEDIUM | Compositor intent overlay: smooth fade-in, decay after sentence. §14 success #2 — *the* defining test. |
| **One discrete event mapped to a hotkey** | Validates the hotkey path coexists with the param stream (separation-of-concerns proof). | LOW | One prop trigger. PROJECT.md Active. |

### Why these and only these

A peer like Open-LLM-VTuber has voice input, multi-thread chat, memory, and tool calling on day one — but those are **layered** features. The walking skeleton is the **foundation** that makes layering possible. The §14 success criteria are deliberately narrower than peer feature parity. Shipping voice/memory/agent in the skeleton would invert the gain (feature parity) against the loss (longer time to validate the architecture).

---

## Walking-Skeleton Differentiators

Features in skeleton scope that **already differentiate** the product — i.e., shipping the skeleton with these correct beats most peers' v1 surface even before memory/agent layers arrive.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **60 Hz action compositor (idle + speech + intent overlay)** | The defining technical bet. No surveyed peer ships compositor-driven blended motion — they ship hotkey pops or single-driver sway. This is the Neuro-sama-altitude signal in skeleton form. | HIGH (the new work in skeleton, §14 estimate calls it the "compositor is the new work; everything else is OLVT plumbing") | PROJECT_DESIGN.md §5.2; PROJECT.md Active. The §14 success criteria #2/3/4 are **all** compositor checks — if this works the skeleton's headline bet is validated. |
| **Smooth `[joy]`-tag fade-in/decay (not hotkey pop)** | This is the *single most visible* difference between this app and every other Live2D-LLM peer. Peers write `LLM emits joy → fire VTS hotkey for joy expression`; we write `LLM emits joy → ramp expression weight from 0→1 over 300ms, decay over sentence end`. | MEDIUM (already covered in compositor, but its UX impact deserves separate billing) | §14 success criterion #2 explicitly calls this out as the criterion. |
| **Sentence-buffered TTS streaming (parallel synth, ordered delivery)** | Solves the latency-vs-quality TTS tradeoff that 2026 streaming-TTS articles identify as unsolved on local-only stacks. First sentence plays as fast as piper allows; later sentences synth in parallel. | MEDIUM | OLVT pipeline port; PROJECT.md Active. Differentiates against peers that either wait-for-full-response (slow) or chunk-mid-sentence (choppy per [Deepgram's streaming TTS analysis](https://deepgram.com/learn/streaming-tts-latency-accuracy-tradeoff)). |
| **OLVT-shape WebSocket protocol** | Lets us copy bug-fixes from OLVT for free and lets OLVT users migrate. No peer has this kind of upstream-compatibility discipline. | LOW (just a constraint on protocol design, no extra code) | PROJECT.md Active list; §14 success #6. Pure architectural discipline. |
| **Renderer-aware ParamID resolver (~30 LOC)** | Pays a small cost now to keep the compositor portable to a future Pixi/mobile renderer without rewriting. Every peer that bolted on a second renderer later did a rewrite. | LOW | PROJECT.md Active. R-OPEN-2 hedge. |
| **`teto_overrides.yaml` schema stub** | Establishes per-avatar override schema (orphan params, physics-chain proxies, sign inversions) before the multi-avatar import milestone needs to invent it. | LOW | PROJECT.md Active. Avoids rework cost in the import-pipeline milestone. |
| **LM Studio default + LiteLLM single-client gateway** | Most peers either (a) bundle their own LLM with no escape hatch (AI Desktop Pet on Steam), (b) require manual provider-string config (OLVT), or (c) hardcode one provider (Soul of Waifu's local LLM defaults). LiteLLM means dropdown-switch any provider. | LOW | PROJECT.md Active, PROJECT_DESIGN.md §12. |

### Differentiator durability check

Researched: Are these still differentiating in 2026, or has someone shipped them?

- **Compositor with blended motion**: HIGH confidence still differentiating. Peer survey (AIRI, Soul of Waifu, OLVT, Mekio, AI Desktop Pet, Desktop Companion) shows none shipping a 60 Hz multi-driver compositor with blended overlays. AIRI uses VRM/Live2D animation but driven by pre-authored animations + emotion classification, not a continuous parameter stream. ([AIRI README](https://github.com/moeru-ai/airi/blob/main/README.md), [Soul of Waifu](https://github.com/jofizcd/Soul-of-Waifu))
- **Sentence-buffered TTS with parallel synth**: MEDIUM confidence still differentiating. Cloud TTS APIs have shipped bidirectional streaming (Polly, Deepgram) but on **local-only** stacks (piper, GPT-SoVITS) the synth-parallel + ordered-deliver pattern remains the OLVT lineage's contribution.
- **OLVT-shape protocol**: HIGH confidence durable. This is a permanent architectural choice no peer can replicate without forking from OLVT.

---

## Deferred to Later v1 Milestones

These features ARE expected by users in the long run (and most peers ship them), but are explicitly OUT of skeleton scope per PROJECT_DESIGN.md §14 + PROJECT.md "Out of Scope (this milestone)". Listing here so the requirements doc doesn't accidentally pull them forward.

| Feature | Peer Status | Skeleton Decision | Where it Lands |
|---------|-------------|-------------------|----------------|
| Voice input (PTT, VAD, Whisper) | Universal — OLVT, AIRI, Soul of Waifu, AI Desktop Pet all ship this | **Deferred** — text-only in skeleton | Voice-input milestone |
| Multi-thread chat per avatar | ChatGPT-shape sidebar is universal in desktop AI | **Deferred** — single in-memory thread | Memory milestone (depends on persistence) |
| Persistent memory (episodic + facts) | Soul of Waifu Auto-Summarization, Desktop Companion "never forgets", AnythingLLM RAG | **Deferred** — clears on relaunch | Memory milestone |
| Multi-avatar switching + import | Most peers ship 1+ default + custom imports | **Deferred** — single hardcoded Teto | Avatar import milestone |
| Pet mode (transparent borderless + click-through) | OLVT, Soul of Waifu, AI Desktop Pet all ship this | **Deferred** — windowed only | Pet-mode milestone |
| Image input (paste/drag) | ChatGPT/Claude desktop standard | **Deferred** | Multimodal milestone |
| Multiple TTS backends (edge-tts, GPT-SoVITS) | OLVT ships ~5 | **Deferred** — piper only | TTS-expansion milestone |
| Agent mode (goal-loop, screen control) | The headline use case (UC-3) | **Deferred** — no agent in skeleton | Agent runtime milestone |
| Saved + scheduled goals | Differentiator vs peers (most don't have this) | **Deferred** — depends on agent runtime | Scheduler milestone |
| Skills system (CLI + screen-control) | Differentiator vs peers (auto-parser pattern is novel) | **Deferred** — depends on agent runtime | Skills milestone |
| Telemetry, auto-update, audit log, i18n | Standard polish | **Deferred** | Polish milestone |
| Settings UI surfaces beyond LLM setup | Standard polish | **Deferred** | Polish milestone |

**Critical:** A reviewer reading FEATURES.md may say "but every peer has voice input!" Yes — and the skeleton ships without it on purpose, because §14's job is to validate the compositor + pipeline + protocol shape end-to-end. Voice input adds a Whisper subsystem and PTT/VAD wiring that doesn't test the skeleton's architectural bets. It lands in milestone 2.

---

## Anti-Features (Never in v1)

Features that seem reasonable but the design has decided against. Source: PROJECT_DESIGN.md §16 + §10 + PROJECT.md "Out of Scope (v1 entirely)".

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Mobile companion in v1** | "I want my companion on the go" | VTube Studio is the v1 renderer and likely can't run on mobile; building a separate mobile renderer triples the v1 surface area. PROJECT_DESIGN.md §10. | Separate future project with its own design doc. R-OPEN-2 mitigation is a post-MVP Pixi exploration — not a mobile port. |
| **Multi-user / family accounts** | "Share the avatar with my partner" | Per-avatar identity + shared user-facts model assumes one user; multi-user breaks the memory schema. PROJECT_DESIGN.md §13.7. | Single-user only. |
| **Group avatars / multi-character scenes** | OLVT has "group chat with multiple AIs"; users will ask | Identity model is per-avatar; multi-character routing is a separate runtime problem with its own consent/turn-taking issues | Single avatar at a time; switch via dropdown. |
| **Anti-cheat-game automation** | "Run my Genshin daily check-in" — wait, that one is in scope | Anti-cheat detects input injection; pyautogui will get the user banned | R-2 carve-out: scope agent to non-anti-cheat workflows (web forms, calendars, daily check-ins on browser-side). |
| **Cross-device pairing / remote control** | "Control my desktop avatar from my phone" | Local-first WebSocket-localhost is a security/architecture invariant; cross-device requires relay servers + auth | Out of scope by design; mobile is a separate project. |
| **Native Cubism Web SDK rendering in v1** | "Why use VTS as a renderer when there's a Live2D Web SDK?" | Cubism commercial license is non-trivial; VTS already handles deformer math, physics, lipsync; we don't gain anything by reimplementing | VTS+pyvts is the v1 renderer. Pixi-live2d-display is post-MVP exploratory only. |
| **pixi-live2d-display as a v1 renderer** | "Decouple from VTS for portability" | Body-sway-during-TTS is unsolved on **VTS** — adding renderer-portability before solving the harder VTS problem doubles the unknowns | VTS-only for v1. Pixi remains a post-MVP mobile-portability hedge that may be abandoned. |
| **Auto-update auto-install** | "Keep me up to date" | Background updates can corrupt running scheduler state; users dislike forced updates | Notify-only. |
| **Skill code signing / sandboxed execution** | "Untrusted skills are dangerous" — true | Real solution is subprocess isolation, which is a v2 problem. v1 mitigates with manifest-declared permissions + import warning | "Only install trusted skills" warning, manifest visible, future v2 can add isolation. |
| **Cloud-hosted memory sync** | "Use my companion across machines" | Local-first is the product. Cloud sync breaks privacy invariants and adds account/auth/server burden | Per-machine local memory. |
| **Voice cloning UI** | "Let me clone my voice in the app" | GPT-SoVITS training is a multi-hour GPU process; building a UI around it is a separate product | Users supply their own GPT-SoVITS model; app is a client. |
| **Plugin/extension marketplace** | "Discover skills like VS Code extensions" | Marketplace = trust + curation + payments + discovery — months of work. Skills system is plumbing, not a marketplace. | No marketplace in v1; users install skills from filesystem. |
| **Agent best-effort rollback for irreversible actions** | "Undo the email it sent" | Many actions aren't reversible by definition; promising rollback creates dangerous expectations | Listed irreversibles only — explicit user warning, no rollback attempt. |
| **Goal template parameterization** (`{account}`, `{date}`) | "Save 'check email for {account}' templates" | Templates-with-vars need a UI for var binding + validation + escape rules; opens injection vectors | Save concrete goal strings; users edit before re-run. |
| **Wake word activation** | "Hey companion!" | Wake-word detection adds always-listening + privacy concerns + a model | Raw VAD only; PTT remains the explicit-intent path. |
| **Memory encryption at rest** | "What if someone steals my laptop?" | OS user-account isolation is the standard; per-app encryption duplicates OS work and adds key-management burden | Plaintext + OS isolation. |
| **Per-avatar custom sound packs** | "Make notifications match the avatar" | Sound-pack registry + import + license tracking is more product than payoff | Default UI sounds only. |
| **Per-thread system prompt overrides** | "Make my RP thread spicier than my work thread" | Profile editing is filesystem-based; per-thread overrides duplicate that surface | Filesystem profile editing only. |

### Anti-feature requests we will receive within 30 days of launch (predicted)

Based on peer-product issue trackers (OLVT, AIRI, Soul of Waifu):

1. "Add Discord/Twitch streaming integration" — out of scope; this is a single-user companion, not a streamer tool
2. "Why no group chat with multiple avatars?" — see above
3. "Mobile when?" — separate project; mobile docs link
4. "Marketplace for skills?" — see above

Pre-emptive position in README/FAQ removes review burden.

---

## Feature Dependencies

```
Skeleton-scoped features only:

Mandatory LLM setup
    └──gates──> Text chat → LLM reply
                    └──feeds──> TTS sentence-buffered playback
                                    └──drives──> Lipsync (RMS → ParamMouthOpenY)
                                    └──drives──> Compositor speech driver
                                                     │
LLM intent tags ──────emitted-with──>  ──────────────┤
                                                     │
Compositor (60 Hz)
    ├── Idle baseline driver (Perlin drift + blink scheduler)
    ├── Speech driver (TTS RMS → head/body sway)
    ├── Intent overlay (smooth blend on [joy]/[shy] tags)
    └── ParamFrame stream
            └──via──> Renderer-aware ParamID resolver
                          └──to──> pyvts InjectParameterDataRequest
                                       └──renders──> VTS avatar (Teto, dev-only)

Cursor-in-canvas eye/head tracking ──feeds──> Compositor (as another driver)

Discrete event (1x prop hotkey) ──parallel-path──> pyvts hotkey trigger
                                                       (validates hotkey/param-stream split)

teto_overrides.yaml stub ──schema-prep──> (future) avatar import pipeline

OLVT-shape WebSocket protocol ──connects──> Electron renderer ↔ Python sidecar
```

### Dependency Notes

- **Mandatory LLM setup gates everything**: Without a configured provider, no chat, no TTS, no compositor speech driver can fire. First feature on the critical path.
- **TTS feeds two consumers**: Lipsync (mouth) and the compositor speech driver (head/body sway). Both consume RMS from the same audio chunk; only one synth happens per sentence.
- **Compositor is the merge point**: All four signal sources (idle, speech RMS, LLM intent tags, cursor) blend in the compositor and emerge as one ParamFrame stream. This is why the compositor is "the new work" and everything else is plumbing.
- **The `teto_overrides.yaml` stub doesn't enable any skeleton feature** — it's pure schema-prep for the avatar-import milestone. Cheap to ship now, expensive to retrofit later.

### Cross-milestone dependency callouts

- **Multi-thread chat** (deferred) requires **persistent memory** (deferred). Both land in the memory milestone together.
- **Saved/scheduled goals** (deferred) require **agent runtime** (deferred) which requires **skills system** (deferred). All three are gated on the agent-runtime milestone.
- **Pet mode** (deferred) requires **click-through controller** in Electron main and **separate dockable chat window** — independent of memory/agent milestones, can land in parallel.

---

## MVP Definition

### Launch With (walking-skeleton v1 == this milestone)

The walking skeleton IS the v1 milestone per PROJECT_DESIGN.md §14. Match PROJECT.md Active list exactly:

- [ ] Electron+React+Vite shell (windowed mode only)
- [ ] Python sidecar (FastAPI + uvicorn) from venv with eager-start + watchdog
- [ ] Mandatory LLM setup screen on first launch (LiteLLM → LM Studio default)
- [ ] OLVT-shape conversation pipeline (sentence_divider → actions_extractor → tts_filter → TTS queue)
- [ ] piper TTS with sentence-buffered playback + RMS-driven lipsync
- [ ] 60 Hz action compositor: idle + speech + intent overlay
- [ ] pyvts ParamFrame stream → one VTS avatar (Teto, dev-only)
- [ ] One discrete-event prop hotkey (validates split)
- [ ] Renderer-aware ParamID resolver stub (~30 LOC)
- [ ] Body-sway investigation report (R-OPEN-1 mitigation: ship visible body sway OR head-only with documented rationale)
- [ ] `teto_overrides.yaml` schema stub
- [ ] Single in-memory chat thread; cursor-in-canvas tracking
- [ ] OLVT-shape WebSocket protocol
- [ ] Smooth `[joy]` blend over ~300ms (the §14 headline test)

**Success = §14 success criteria 1–6 all pass.** Anything beyond this list is scope creep for the skeleton.

### Add After Walking Skeleton Validates (subsequent v1 milestones)

In rough recommended phase order based on dependencies and user-perceived value:

- [ ] **Voice input** (Whisper, PTT, VAD) — biggest UX gap users will notice; no architectural dependencies on memory/agent
- [ ] **Memory subsystem** (per-avatar Chroma + shared user-facts + FTS5 + RRF retrieval) — unlocks multi-thread + multi-avatar identity
- [ ] **Multi-thread chat** — depends on memory persistence
- [ ] **Multi-avatar switching + import pipeline** — depends on memory (per-avatar buckets)
- [ ] **Pet mode** (transparent borderless + click-through + dockable chat window) — independent track, can run parallel to memory milestone
- [ ] **Agent runtime** (goal-loop, screen-control sub-agent, CLI sub-agent) — the headline UC-3
- [ ] **Saved + scheduled goals** — depends on agent runtime
- [ ] **Skills system** (CLI + screen-control, manifest + auto-parser) — depends on agent runtime
- [ ] **Multiple TTS backends** (edge-tts, GPT-SoVITS, ComfyUI) — quality-of-life polish
- [ ] **Image input** (paste/drag/picker) — quality-of-life polish
- [ ] **Audio-to-params learned drivers** (v1.5) — replaces rule-based DSP in compositor speech driver
- [ ] **Telemetry, auto-update notify, audit log, i18n, settings UI surfaces** — release-readiness polish

### Future Consideration (v2+)

- [ ] **Pixi-live2d-display renderer** — exploratory, mobile-portability hedge, may be abandoned
- [ ] **Mobile companion** — separate future project entirely
- [ ] **Skill subprocess isolation / signature verification** — addresses R-8 properly
- [ ] **Bridge between CLI skills and screen-control skills** — §13.122 explicitly defers this to v1.5

---

## Feature Prioritization Matrix (skeleton-scope only)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mandatory LLM setup screen | HIGH (gates everything) | LOW | P1 |
| Text chat → LLM reply with TTS | HIGH | MEDIUM | P1 |
| Lipsync (RMS → ParamMouthOpenY) | HIGH | LOW | P1 |
| Compositor idle baseline (drift+blink) | HIGH (avatar looks alive between turns) | MEDIUM | P1 |
| Compositor intent overlay (smooth blend) | HIGH (the headline differentiator) | MEDIUM | P1 |
| Compositor speech driver (head sway) | HIGH (talking-head liveliness) | MEDIUM | P1 |
| Compositor speech driver (body sway) | MEDIUM (R-OPEN-1 may force head-only) | HIGH (research, not port) | P1 (with documented fallback) |
| Cursor-in-canvas eye/head tracking | MEDIUM (peers all have it; missing reads as broken) | LOW | P1 |
| Sentence-buffered TTS playback | HIGH (perceived latency) | MEDIUM | P1 |
| OLVT-shape WebSocket protocol | LOW direct user value, HIGH long-term (fix-portability) | LOW (just discipline) | P1 |
| Renderer-aware ParamID resolver | LOW direct, MEDIUM long-term (mobile/Pixi hedge) | LOW (~30 LOC) | P1 |
| `teto_overrides.yaml` schema stub | ZERO direct, MEDIUM long-term (avoids rework) | LOW | P1 |
| One discrete-event prop hotkey | LOW direct, validates architecture | LOW | P1 |

**Priority key:**
- P1: must ship in skeleton
- P2: deferred to next v1 milestone
- P3: future consideration

(Everything else from the PROJECT.md Out-of-Scope-this-milestone list is P2; everything from PROJECT.md Out-of-Scope-v1-entirely is anti-feature.)

---

## Competitor Feature Analysis (skeleton-relevant only)

| Feature | OLVT | AIRI | Soul of Waifu | AI Desktop Pet | Our Skeleton |
|---------|------|------|---------------|----------------|--------------|
| Live2D rendering | Web Live2D SDK | Live2D + VRM (web) | Live2D + VRM | Live2D | **VTS+pyvts** (decided §11; Cubism license avoided) |
| Lipsync | Hybrid backend RMS | Built-in | LipSync feature | Yes | **Our-RMS path → ParamMouthOpenY** (skeleton scope) |
| Expression mapping from LLM | Tag-based, hotkey trigger | Emotion classification | 28-emotion mapping | Yes | **Compositor blended overlay (smooth fade, not hotkey pop)** — the differentiator |
| Continuous idle motion | VTS rig physics only | Pre-authored animations | Some | Some | **60 Hz multi-driver compositor** — the differentiator |
| LLM provider config | YAML configs, manual | Web UI config | UI config | Bundled local default | **Mandatory setup screen + LiteLLM + LM Studio default** |
| Voice input | Whisper, full duplex | Realtime voice | Real-time voice | Yes | **Deferred** (skeleton is text-only) |
| Memory persistence | Per-conversation | Yes | Auto-summarize | Yes | **Deferred** (skeleton is in-memory) |
| Multi-thread chat | Yes | Unclear | Yes | Unclear | **Deferred** |
| Pet mode (transparent always-on-top) | Yes | Web/Desktop | Yes | Yes | **Deferred** (skeleton is windowed only) |
| Agent / tool calling | MCP + browser control | Game integrations (Minecraft/Factorio) | Roleplay-focused | No | **Deferred** (UC-3 is the v1 horizon, not skeleton) |

**Reading:** The skeleton intentionally trails peer feature parity on every row except the compositor. That's the bet — get the compositor right, and the layered features attach to a differentiated foundation.

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| Every peer ships Live2D + lipsync + LLM + voice + memory + pet mode | HIGH | Direct peer feature pages (OLVT README, AIRI README, Soul of Waifu README, AI Desktop Pet Steam page) |
| No peer ships continuous compositor-driven blended motion | MEDIUM-HIGH | Peer surveys show hotkey/emotion-classification patterns; targeted searches for "compositor" / "blended motion" / "60Hz parameter stream" returned no peer matches. Confidence less than HIGH because researchers can't read every peer's source code. |
| Hotkey-pop expressions are a known UX failure mode | HIGH | [3daily.ai animation guide](https://3daily.ai/blog/the-secret-to-smooth-vtuber-animation-blendshapes-timing-real-time-syncing/), [authorea Kalman-filter paper](https://www.authorea.com/doi/full/10.22541/au.169272418.88758655) both confirm "robotic" reactions are a primary complaint |
| Sentence-buffered streaming TTS is the standard pattern | HIGH | [Deepgram streaming TTS analysis](https://deepgram.com/learn/streaming-tts-latency-accuracy-tradeoff) confirms full-sentence buffering vs mid-sentence-chunking tradeoff |
| Mobile is correctly out-of-scope | HIGH | PROJECT_DESIGN.md §10 + ecosystem signal (no peer ships true mobile companion with rendering parity) |
| Multi-avatar identity (per-avatar episodic + shared facts) is differentiating | MEDIUM | Soul of Waifu has 28 emotions per avatar but unclear on memory bucket isolation; OLVT has multi-character group chat but it's not the same as identity-switching. Researchers couldn't fully verify peer memory schemas. |
| Saved + scheduled agent goals are differentiating | MEDIUM | No peer survey result mentions cron-style scheduling for agent templates; Anthropic's computer-use is one-shot. Confidence less than HIGH because researchers can't survey every desktop AI assistant. |

---

## Sources

### Direct peer products
- [Open-LLM-VTuber GitHub](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) — direct predecessor, feature reference
- [Project AIRI GitHub](https://github.com/moeru-ai/airi) — closest peer in agentic ambition
- [Project AIRI README](https://github.com/moeru-ai/airi/blob/main/README.md)
- [AIRI feature deep dive](https://www.blog.brightcoding.dev/2026/03/30/airi-the-revolutionary-ai-companion-platform)
- [Soul of Waifu GitHub](https://github.com/jofizcd/Soul-of-Waifu) — Live2D/VRM roleplay companion
- [AI Desktop Pet on Steam](https://store.steampowered.com/app/4227700/AI_Desktop_Pet/) — bundled-LLM Live2D pet
- [Desktop Companion (desktopaicompanion.com)](https://desktopaicompanion.com/en) — screen-aware Live2D pet
- [CielChan (itch.io)](https://elushis.itch.io/cielchan-desktop-ai-companion-free) — offline anime desktop companion
- [Kim Jammer's Neuro recreation](https://github.com/kimjammer/Neuro) — 7-day Neuro-sama clone reference

### Animation / lipsync references
- [VTube Studio official](https://denchisoft.com/) — v1 renderer
- [3daily.ai: Smooth VTuber animation](https://3daily.ai/blog/the-secret-to-smooth-vtuber-animation-blendshapes-timing-real-time-syncing/) — confirms 16ms/60FPS target, "robotic" failure mode
- [Authorea: Smoothed Facial Motion Capture for Live2D](https://www.authorea.com/doi/full/10.22541/au.169272418.88758655) — Kalman filter for jitter

### TTS streaming references
- [Deepgram: Streaming TTS Latency Tradeoff](https://deepgram.com/learn/streaming-tts-latency-accuracy-tradeoff) — sentence-buffer vs streaming analysis
- [Modal: One-Second Voice-to-Voice with Pipecat](https://modal.com/blog/low-latency-voice-bot)
- [Inworld: Best TTS APIs for Real-Time Voice Agents 2026](https://inworld.ai/resources/best-voice-ai-tts-apis-for-real-time-voice-agents-2026-benchmarks)

### Local-LLM desktop app references (chat-UX baseline)
- [AnythingLLM official](https://anythingllm.com/) — RAG + agent skills
- [LM Studio 2026 Review](https://elephas.app/blog/lm-studio-review)
- [15 Best LM Studio Alternatives 2026](https://blog.premai.io/15-best-lm-studio-alternatives-for-running-local-llms-2026/)

### Internal design docs (canonical)
- `PROJECT_DESIGN.md` — 28-round brainstorm (~123 resolved decisions); §2 Use Cases, §3 User Flows, §5.2 Action Compositor, §11 Live2D, §14 Walking Skeleton, §16 Out of Scope
- `.planning/PROJECT.md` — Active list (skeleton scope) + Out of Scope (this milestone) + Out of Scope (v1 entirely)
- `README.md` — Highlights and predecessor context

---
*Feature research for: local-first desktop Live2D VTuber companion app — walking-skeleton scope*
*Researched: 2026-05-06*
