# Project Research Summary

**Project:** AgenticLLMVTuber
**Domain:** Electron + React + Python sidecar; VTube Studio Live2D renderer; LiteLLM gateway; 60 Hz action compositor
**Researched:** 2026-05-06
**Confidence:** HIGH for stack versions and core architecture; MEDIUM for body-sway outcome; LOW for which speech driver wins

## Executive Summary

AgenticLLMVTuber is a local-first desktop Live2D companion built on a proven pattern (Electron shell, Python sidecar over localhost WebSocket, VTube Studio as external renderer) differentiated by a 60 Hz multi-driver action compositor that blends idle motion, speech-driven sway, and LLM intent overlays smoothly rather than firing hotkey-pop expressions. The 2026 peer survey confirms this compositor approach is genuinely novel: AIRI, Soul of Waifu, OLVT, and AI Desktop Pet all use hotkey or emotion-classification animation rather than a continuous parameter stream. The walking-skeleton milestone (PROJECT_DESIGN.md section 14) is the right scope: validate the compositor and OLVT pipeline port end-to-end before adding voice, memory, agent, or multi-avatar layers.

The single largest architectural risk is the body-sway investigation (R-OPEN-1). OLVT Phase 4 IN-twin physics-chain trick (ParamAngleXIN additive injection) is a documented failure on the Teto rig, not a solved recipe. A strategy-pattern speech driver with four implementations (head-only guaranteed fallback, physics-chain reference, exp3-modulation, proxy-param) turns the investigation into runnable evidence and lets the skeleton ship with documented rationale if head-only is the best achievable.

Three external risks have concrete mitigation: (1) pyvts is unmaintained since 2024-09-10 - vendor it from day one and use a single-writer async pattern to avoid its known concurrent-call deadlock (issue #51); (2) VTS has a mandatory lower-bound rate limit of re-injecting each parameter at least once per second or VTS reverts it to the face tracker - compositor must send rest-state frames continuously even when no driver is active; (3) LiteLLM + LM Studio needs a 120-second timeout and warmup completion call because LM Studio lazy-loads models on first request.

---

## Key Findings

### Recommended Stack

All core version pins are HIGH confidence via direct PyPI and official changelog verification. The only stack component that has meaningfully aged since the design was written is pyvts (0.3.3, 2024-09-10, no 2025-2026 activity). All other choices are on active stable lines.

**Core technologies - lock for skeleton:**

| Technology | Version | Role |
|---|---|---|
| Electron | 40.x | Desktop shell, sidecar lifecycle, IPC |
| electron-vite | 5.0.x | Build tooling for Electron+React+Vite |
| React | 19.2.x (pin >=19.2.1) | SPA framework; 19.0/19.1 had SCS RCE audit concern |
| Vite | 6.x | Renderer bundler; Vite 8+Rolldown is 2 months old, skip for skeleton |
| TypeScript | 5.7.x | End-to-end TS |
| Node.js | 22.x LTS | Match Electron 40 bundled Node; avoid native-module ABI mismatch |
| Python | 3.12.x | Sidecar runtime; 3.13 ML wheel parity not yet confirmed |
| FastAPI | 0.136.1 | Sidecar WebSocket + HTTP surface |
| Uvicorn | 0.46.0 | ASGI host, single-worker |
| LiteLLM | 1.83.14 | LLM gateway; v1.83.x is the post-supply-chain-incident stable line |
| pyvts | 0.3.3 | VTS WebSocket client; vendor from day one |
| piper-tts | 1.4.2 | Local ONNX TTS; use piper-tts package not piper-onnx |
| VTube Studio | 1.32.71 (external) | Live2D renderer; Cubism 4 and 5.0-5.2 only; 5.3 not yet supported |

**Stack flags for later milestones (not skeleton-relevant):**
- claude-agent-sdk: correct package is claude-agent-sdk (v0.1.73), NOT deprecated claude-code-sdk. Opus 4.7 requires >=0.2.111 which does not yet exist as of May 2026.
- Tavily: acquired by Nebius Feb 2026; evaluate Brave Search API or Exa.ai as alternatives at agent-runtime milestone planning time.
- Cubism 5.3: VTS does not yet support Cubism 5.3; avatar-import milestone must gate 5.3 rigs on import.

**Tooling decisions:**
- Use uv not pip for Python dependency management.
- Use npm not pnpm for the Electron skeleton (pnpm symlinked node_modules breaks electron-builder without node-linker=hoisted).
- Hand-write the ~10 TS contract types that mirror Pydantic models for the skeleton. Correct codegen direction is Pydantic model_json_schema() -> JSON Schema -> json-schema-to-typescript. datamodel-code-generator goes JSON Schema -> Pydantic (not the reverse) and is not the right tool for TS generation.

### Expected Features

**Walking-skeleton table stakes (must ship for section 14 success criteria):**
- Live2D avatar visible in VTS (Teto, dev-only)
- Lipsync during TTS: sidecar-computed RMS -> ParamMouthOpenY (not VTS-internal lipsync)
- Text chat -> LLM reply with sentence-buffered TTS playback
- Mandatory LLM setup screen on first launch; blocks until LM Studio reachable via real completion call, not /v1/models
- Cursor-in-canvas eye/head tracking (ParamAngleX/Y + ParamEyeBallX/Y)
- Idle baseline: Perlin drift + blink scheduler (avatar looks alive between turns)
- [joy] tag -> smooth 300ms fade-in/decay expression blend (the headline success criterion - NOT a hotkey pop)
- Compositor speech driver: head sway guaranteed; body sway is open investigation (R-OPEN-1), ships head-only with rationale if no body param is reachable
- One discrete-event prop hotkey (validates hotkey path coexists with param stream)
- teto_overrides.yaml schema stub (schema-prep for import-pipeline milestone, zero user-visible effect)
- OLVT-shape WebSocket protocol (section 14 success criterion 6)
- Renderer-aware ParamID resolver (~30 LOC stub)

**Skeleton differentiators (already differentiate vs all surveyed peers):**
- 60 Hz multi-driver action compositor with blended overlays; no peer ships this
- Smooth intent-tag fade-in/decay vs hotkey pop; single most visible difference from every peer
- Sentence-buffered TTS with parallel synth and ordered delivery
- LiteLLM single-client gateway; provider-dropdown not hardcoded single provider

**Deferred to later v1 milestones (explicitly out of skeleton scope):**
- Voice input (PTT/VAD/Whisper); text-only in skeleton
- Persistent memory (Chroma + BM25 + RRF); in-memory only in skeleton
- Multi-thread chat, multi-avatar switching, avatar import pipeline
- Pet mode (transparent borderless + click-through); windowed only in skeleton
- Agent runtime (goal-loop, screen control, CLI sub-agent)
- Multiple TTS backends (edge-tts, GPT-SoVITS), image input, telemetry, full settings UI

**Anti-features (never in v1):**
- Mobile companion; VTS is desktop-only and Pixi post-MVP exploration may be abandoned
- Multi-user accounts; pixi-live2d-display as a v1 renderer; cloud-hosted memory sync; wake-word activation

### Architecture Approach

The skeleton is a vertical slice through the full section 4 architecture with five OS-level process boundaries at minimum viable depth. Electron main owns sidecar lifecycle via eager spawn + watchdog + port discovery from [READY] stdout line. The React renderer is a thin UI host with a transparent div overlay for cursor tracking - VTS owns the avatar window, not the renderer. ParamFrames flow sidecar -> VTS direct via pyvts, NOT through the React renderer. The renderer only originates UI-event traffic (cursor, hotkey, text input). This avoids a 60 Hz WebSocket -> IPC -> WS cascade.

**Major skeleton components:**

1. Electron main (apps/electron-main/) - sidecar spawn/watchdog/port-discovery; one test hotkey; IPC bridge to renderer
2. React renderer (apps/renderer/) - LLM setup screen; single-thread chat panel; CursorTracker.tsx transparent overlay div emitting throttled cursor events at 15 Hz; Web Audio queue for sentence playback
3. Python sidecar (apps/sidecar/) - FastAPI WS endpoint; OLVT decorator pipeline (sentence_divider -> actions_extractor -> tts_filter -> TTSTaskManager); LiteLLM gateway; piper TTS + RMS feature tap; 60 Hz compositor (idle + speech + intent + reaction drivers); ParamID resolver; pyvts bridge
4. VTube Studio (external) - renders Teto rig; receives InjectParameterDataRequest at 60 Hz from pyvts
5. packages/contracts/ - Pydantic-first cross-language types; hand-written TS mirror for skeleton; codegen in Phase 5

**VTS rate-limit constraints (both bounds matter):**
- Upper bound: 60 Hz hard cap enforced in the writer task; exceeding this causes VTS UI hangs and parameter drops
- Lower bound: re-send every controlled parameter at least once per second or VTS reverts it to face tracker; compositor must send rest-state frames even when no driver is active

**Speech driver body-sway strategy pattern:**
The compositor speech driver is implemented behind a strategy interface with four strategies: head_only (guaranteed visible, fallback), physics_chain (OLVT approach, known broken on Teto, kept as runnable reference), exp3_modulation (new approach using VTS expression blending modulated by RMS), proxy_param (runtime discovery of non-orphan body params). The smoke-pass on Teto before writing the driver determines which strategy ships as default.

### Critical Pitfalls

**1. pyvts sync-blocking deadlock under concurrent asyncio calls (Skeleton-blocker)**
pyvts 0.3.3 issue #51 (unfixed): concurrent coroutine calls raise RuntimeError. Compositor at 60 Hz plus discrete events will hit this immediately. Prevention: single-writer async task pattern; one asyncio.Task holds the only pyvts reference; all compositor frames and discrete events queue through it with frame coalescing when the writer lags.

**2. VTS 1-second re-injection rule causes visible snap-back (Skeleton-blocker)**
When the compositor stops writing a parameter, VTS reverts it to the face tracker after ~1 second. Body sway snaps to default when TTS finishes. Prevention: compositor writes every touched parameter to rest-state continuously at low frequency (every 500ms), or sends an explicit weight-0 release before going silent.

**3. Body-sway IN-twin assumption is a documented failure on Teto (Investigation required)**
OLVT Phase 4 ParamAngleXIN/ParamAngleZIN additive injection did not produce visible body sway on Teto. Do not copy this pattern verbatim. Prevention: mandatory smoke-pass before writing the speech driver; strategy-pattern interface with head-only as guaranteed fallback.

**4. Tag-parser tokenization breaks across LLM streaming boundaries (Skeleton-blocker for criterion 2)**
LLM providers emit tokens without word/punctuation boundaries; [joy] may arrive as [, jo, y]. Prevention: buffer-then-extract pattern from OLVT; run tag extractor on the complete buffered sentence, not on individual token deltas. Test with adversarial fixtures that split tag tokens.

**5. Reasoning-model think blocks leak into TTS (Latent skeleton-blocker)**
LM Studio increasingly defaults to reasoning models that emit think blocks in the content stream. pysbd sentence-splits inside think blocks and the avatar reads internal thought aloud. Prevention: streaming think-strip state machine at the orchestrator input boundary before sentence_divider sees the stream.

**6. VTS parameter ownership conflict with face tracker (Skeleton-blocker on webcam machines)**
InjectParameterDataRequest default mode set conflicts with VTS built-in face tracker. Prevention: use mode add for ambient and speech drivers; mode set with weight fade only for intent overlays. The 300ms [joy] fade is implemented as driving weight from 0->1, not hard-setting the param value.

**7. Orphan Python process holds sidecar port after Electron crash (Skeleton-blocker in dev)**
Windows has no POSIX PR_SET_PDEATHSIG equivalent. Prevention: sidecar polls parent PID every 5 seconds and self-terminates if parent is gone; prefer port 0 with [READY] line stdout port announcement to avoid hardcoded-port collisions.

---

## Implications for Roadmap

The walking skeleton splits cleanly into 5 sequential phases with a strict dependency chain. Each phase acceptance test is a superset of the previous phase. Allow roughly 2-3 days per phase; Phase 4 (compositor) takes the most unscheduled time due to the body-sway investigation.

### Phase 1: Plumbing skeleton

**Rationale:** Every subsequent phase requires a working round-trip. Fix the OLVT protocol envelope here; propagating it later is mechanical.
**Delivers:** npm run dev boots Electron -> spawns sidecar -> renderer connects via WS -> hardcoded echo round-trip works. No LLM, no TTS, no avatar.
**Addresses:** Electron+React+Vite shell; Python sidecar from venv with eager-start and watchdog; OLVT-shape WebSocket protocol bootstrap; hand-written contracts TS mirror
**Avoids:** Pitfall 11 (orphan process / port collision); Pitfall 12 (hot-reload double-spawn, spawn inside app.whenReady() only); Pitfall 13 (silent crash, 3-crashes-in-30s circuit breaker)
**Research flag:** Standard patterns - no research-phase needed.

### Phase 2: Conversation pipeline

**Rationale:** Validates LiteLLM/LM-Studio glue and OLVT decorator chain before introducing audio timing complexity. The pipeline is the most lifted-from-OLVT piece.
**Delivers:** Real LLM reply with sentence-streamed display, no audio, no avatar. Mandatory setup screen blocks until LM Studio is reachable. LLM emitting [joy] -> sidecar logs extracted ActionIntent.
**Addresses:** Mandatory LLM setup screen; OLVT pipeline port; LiteLLM -> LM Studio gateway with 120s timeout; think-strip state machine at orchestrator input
**Avoids:** Pitfall 5 (tag tokenization - buffer-then-extract); Pitfall 6 (think blocks - strip at orchestrator input); Pitfall 15 (LM Studio lazy-load timeout - warmup call + real-completion test in setup screen)
**Research flag:** Standard patterns. No dedicated research-phase needed.

### Phase 3: TTS + audio playback

**Rationale:** TTS adds the only genuinely new I/O complication (audio clock vs. sidecar clock). Doing it before the compositor means the RMS feature tap is real, not stubbed.
**Delivers:** Avatar reply is spoken with sentence-buffered parallel-synth ordered playback. First sentence plays while second is synthesizing (verifiable via logs).
**Addresses:** piper TTS backend + RMS envelope extraction; TTSTaskManager with indexed-slot queue not FIFO; Web Audio queue in renderer; audio-payload WS message end-to-end
**Avoids:** Pitfall 14 (piper cold start - synth a token at boot); Pitfall 16 (sounddevice underruns - pre-warm OutputStream, latency=high, pin sample rate to voice.config.sample_rate); Pitfall 17 (sentence ordering - indexed-slot queue)
**Research flag:** Standard patterns. No research-phase needed.

### Phase 4: Action compositor + VTS bridge

**Rationale:** This is where the unique value-add lives. Allow roughly half the total budget here. Body-sway investigation eats the unscheduled time.
**Delivers:** Section 14 success deliverable. Avatar idles, speaks, blinks, sways, blends [joy] smoothly at 300ms, tracks cursor. One prop hotkey via DiscreteEvent path.
**Addresses:** pyvts single-writer task (Pitfall 3); VTS rate-limit batching to exactly one InjectParameterDataRequest per frame (Pitfall 4); body-sway smoke-pass + strategy-pattern speech driver (Pitfall 1); mode add vs mode set per layer (Pitfall 6 and 8); rest-state continuous-write (Pitfall 9); ParamID resolver with loud NotImplementedError on non-VTS branch (Pitfall 2); VTS token path in user data dir (Pitfall 10)
**Open question (R-OPEN-1):** Which speech driver strategy produces visible body sway? Smoke-pass Teto first; if all body params are orphaned, ship head-only with documented rationale.
**Research flag:** NEEDS RESEARCH-PHASE during planning. Planning-time spike questions: (a) Does exp3-modulation provide a viable path to body sway on Teto? (b) Does proxy-param discovery find any non-orphan body param in the Teto deformer graph? (c) Confirm mode add with weight fade produces the exact 300ms blend that criterion 2 requires on the Teto joy expression.

### Phase 5: Polish, contracts codegen, success-criteria validation

**Rationale:** Integration polish and evidence-of-quality pass. Contracts codegen replaces hand-written TS mirror. Body-sway investigation report written. Section 14 criteria formally verified.
**Delivers:** Clean-clone -> all six section 14 success criteria pass. Contracts codegen pipeline (Pydantic -> JSON Schema -> TS). Body-sway investigation report. teto_overrides.yaml schema documented.
**Addresses:** Full Looks Done But Isn't checklist from PITFALLS.md including adversarial [joy] token boundary test, reasoning-model smoke test, VTS auth-reprompt test, port-collision test, OLVT protocol-shape parity diff
**Research flag:** Standard patterns. No research-phase needed.

### Phase Ordering Rationale

- Echo -> pipeline -> TTS -> compositor: each phase acceptance test is a superset of the previous, isolating integration failures to the phase introducing new components.
- Compositor last: most failure-prone chunk with open body-sway research and seven pitfalls mapped to it. Loading it last prevents earlier-phase bugs from compounding with compositor unknowns.
- TTS before compositor: compositor speech driver consumes a real RMS envelope tap, not a stub.
- pyvts single-writer architecture: establish the interface contract in Phase 1 WS protocol setup to avoid retrofitting when the concurrent-call deadlock surfaces during Phase 4.

### Research Flags

**Needs phase planning-time research:**
- Phase 4 (compositor + VTS bridge): body-sway investigation is empirical. Run smoke-pass on Teto before writing the speech driver; allocate explicit time for trying at least two speech-driver strategies before committing to head-only.

**Standard patterns (skip research-phase):**
- Phase 1 (plumbing): Electron + FastAPI + WS is the documented 2026 convention for local-AI desktop apps.
- Phase 2 (pipeline): OLVT decorator pipeline available for direct port; LiteLLM LM Studio integration is documented.
- Phase 3 (TTS): piper-tts, sounddevice, and sentence-buffered streaming patterns are well-documented.
- Phase 5 (polish): JSON Schema -> TS codegen is a 30-minute spike.

---

## Open Questions for Phase-Planning Decisions

Five questions needing a decision at planning time, not implementation time:

1. **pyvts vendoring acceptability.** Vendor from day one (lower risk, minor overhead) vs. wait-and-see (risk of mid-phase disruption when a bug surfaces during Phase 4)? The single-writer pattern works around issue #51 without forking, but any pyvts bug during Phase 4 requires in-tree forking.

2. **Port-0 vs. fixed port for the sidecar.** Port 0 + stdout [READY] line eliminates orphan-port collisions entirely. Fixed port is simpler in dev but requires the orphan-process handshake. Decision needed before Phase 1 implementation.

3. **Codegen tool for contracts.** Does codegen land in Phase 5, or become a separate post-skeleton task? If deferred, hand-written TS types must be documented as generated artifact placeholder with Pydantic as source of truth.

4. **Teto smoke-pass timing.** Is the body-sway smoke-pass a Phase 4 entry-gate task, or a Phase 3 concurrent task running while TTS pipeline is being built?

5. **Reasoning-model UI scope in skeleton.** Does the skeleton show a thinking placeholder in the chat panel during think blocks, or does it silently strip and discard reasoning content until a side-panel lands in a later milestone?

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core versions verified via PyPI and official changelogs. pyvts staleness is HIGH-confidence known; all other packages are on active stable lines. |
| Features | HIGH for table stakes; MEDIUM for differentiator durability | Peer survey confirms no competitor ships a 60 Hz blended compositor. Less than HIGH because researchers could not read every peer source code. |
| Architecture | HIGH for five-phase build order and component boundaries; MEDIUM for codegen tooling | OLVT protocol shape confirmed. Pydantic to TS codegen direction confirmed. Body-sway strategy outcomes are empirical with LOW confidence on which driver wins. |
| Pitfalls | HIGH for VTS API rate-limit rules and pyvts issue #51; MEDIUM for OLVT-port traps | VTS API wiki, pyvts GitHub issues, chokidar issues, LM Studio bug-tracker all verified. OLVT-port failure modes sourced from PROJECT_DESIGN.md section 5.3.1 as primary source with no independent validation. |

**Overall confidence:** HIGH for the skeleton scope. Architecture is well-specified and the stack is current. The only meaningful uncertainty is empirical (which speech driver produces body sway on Teto) not architectural.

### Gaps to Address

- **Body-sway empirical outcome (R-OPEN-1):** Not resolvable by research; must be determined by running the smoke-pass on the actual Teto rig. Address in Phase 4 entry gate.
- **pixi-live2d-display-advanced maintenance status:** Post-MVP exploratory only. Verify maintenance status before the v1.5 Pixi exploration begins.
- **claude-agent-sdk >=0.2.111 for Opus 4.7:** Latest published version is 0.1.73 as of May 2026. Not skeleton-relevant; agent-runtime milestone planning must check whether 0.2.111 has shipped.
- **Tavily post-acquisition:** Evaluate Brave Search API or Exa.ai at agent-runtime milestone planning time. Skeleton-irrelevant.
- **Cubism 5.3 VTS support ETA:** Avatar-import milestone should detect Cubism version on import and gate 5.3 rigs with a helpful message until VTS catches up.

---

## Sources

### Primary (HIGH confidence)
- VTubeStudio API GitHub (DenchiSoft/VTubeStudio) - InjectParameterDataRequest contract, weight/mode semantics, 1-second re-injection rule
- pyvts GitHub (Genteki/pyvts) - issue #51 sync-blocking, issue #49 connection stability, release history confirming 0.3.3 is last release 2024-09-10
- LiteLLM release notes (docs.litellm.ai) - 1.83.14 stable; v1.83.x as post-supply-chain-incident line
- FastAPI release notes - 0.136.1 on 2026-04-23
- Electron releases (releases.electronjs.org) - Electron 40 stable 2026-01-13
- React versions (react.dev/versions) - 19.2.5 latest; 19.2.1+ clears SCS RCE audit concern
- piper-tts PyPI - 1.4.2 on 2026-04-02
- claude-agent-sdk PyPI and GitHub - 0.1.73 on 2026-05-04; Opus 4.7 needs >=0.2.111
- VTube Studio Cubism 5.3 status (@VTubeStudio) - URP rewrite ongoing, no support ETA
- chokidar issues #189 and #1112 - awaitWriteFinish race condition confirmed
- LM Studio bug-tracker #944 - 300-second lazy-load timeout
- PROJECT_DESIGN.md section 5.3.1 - VTS rig two-layer architecture, IN-twin failure modes (primary source)

### Secondary (MEDIUM confidence)
- Open-LLM-VTuber GitHub and DeepWiki architecture docs - OLVT _route_message() protocol shape, decorator pipeline pattern
- Project AIRI, Soul of Waifu, AI Desktop Pet Steam page - peer feature survey confirming no blended-compositor competitor
- Deepgram streaming TTS latency analysis - sentence-buffer vs. mid-sentence-chunk tradeoff
- 3daily.ai animation guide and Authorea Kalman filter paper - robotic hotkey pop failure mode confirmed as primary VTuber UX complaint
- python-sounddevice issues #347 and #98 - underrun and latency configuration

### Tertiary (LOW confidence - inferred or single source)
- Specific chokidar awaitWriteFinish threshold values (stabilityThreshold 200, pollInterval 50) - sane defaults from examples; may need per-editor tuning
- Head-only + breathing/micro-shoulder fallback visual adequacy - sourced from PROJECT.md R-OPEN-1 description, not independently validated
- Five-phase skeleton build-order - opinionated construction based on dependency analysis; no canonical OLVT-port skeleton taxonomy exists

---
*Research completed: 2026-05-06*
*Ready for roadmap: yes*
