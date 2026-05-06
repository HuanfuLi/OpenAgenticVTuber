# Requirements: AgenticLLMVTuber

**Defined:** 2026-05-06
**Milestone:** Walking Skeleton (PROJECT_DESIGN.md §14)
**Core Value:** Multi-avatar identity persistence (v1 horizon — skeleton lays the foundation, doesn't deliver it)

The walking-skeleton scope validates the layered architecture (Electron + Python sidecar + VTS rendering + LLM gateway + TTS pipeline + 60 Hz action compositor) end-to-end with one hardcoded avatar, one in-memory chat thread, and companion mode only. Subsequent milestones add memory, agent runtime, scheduler, skills, multi-thread, multi-avatar, and pet mode.

## v1 Requirements

### Plumbing & Process Lifecycle

- [x] **PLUMB-01**: Electron shell (windowed mode only) wraps a React + Vite + TypeScript renderer with TS-end-to-end shell config; npm package manager (not pnpm — pnpm conflicts with electron-builder asar packaging)
- [x] **PLUMB-02**: Electron main spawns a Python sidecar (FastAPI + uvicorn) under a uv-managed venv with eager-start at boot, parent-PID watchdog so the sidecar exits when Electron crashes, and graceful-shutdown handshake on normal close
- [x] **PLUMB-03**: Sidecar exposes a localhost-only WebSocket endpoint whose message envelope shape matches Open-LLM-VTuber's protocol so OLVT plumbing fixes can copy back; port-allocation strategy is decided at phase-1 planning (`port:0` ephemeral OR fixed-port + handshake)
- [x] **PLUMB-04**: First-launch flow shows a mandatory LLM setup screen (provider URL/key + test-connection round-trip); the screen blocks the app until a successful test completes; LM Studio default at `http://localhost:1234/v1` is pre-filled
- [x] **PLUMB-05**: pyvts is vendored into the sidecar from day one (`sidecar/vendor/pyvts/`), since upstream is unmaintained since 2024-09-10; in-tree patches applied as needed without forking the project

### LLM Conversation Pipeline

- [ ] **LLM-01**: LiteLLM is the single LLM client; the setup screen supports two providers in the skeleton — LM Studio default and a custom OpenAI-compatible endpoint; LiteLLM timeout is set to ≥120s to absorb LM Studio cold-start lazy model loading
- [ ] **LLM-02**: Conversation orchestrator runs the OLVT-style decorator chain (sentence_divider via pysbd → actions_extractor with buffer-then-extract on **completed** sentences only → tts_filter → TTS queue) — never extract `[tag]` markers from streaming token deltas; BPE splits like `[`, `jo`, `y]` are common
- [ ] **LLM-03**: LLM-gateway boundary strips `<think>` reasoning blocks from any provider that emits them (DeepSeek-R1 distills, o1-style traces) before the orchestrator sees the content; reasoning is captured to a side channel for future UI surfacing but not displayed in the skeleton
- [ ] **LLM-04**: Conversation runs on a single in-memory thread that clears on relaunch — no persistence, no FTS5, no thread sidebar in the skeleton

### TTS & Audio Playback

- [ ] **TTS-01**: piper TTS (ONNX, local) is the only voice backend in the skeleton; warmup synth at app launch caches one-token render to amortize ~200-500ms cold-start latency
- [ ] **TTS-02**: TTS playback uses sentence-buffered model — per-sentence parallel synth + ordered delivery (the OLVT pattern); first sentence plays while subsequent sentences synthesize; perceived latency = first-sentence-synth-time
- [ ] **TTS-03**: TTS gateway exposes an RMS feature tap (audio amplitude envelope) that the action compositor's speech driver consumes in real time
- [ ] **TTS-04**: Lipsync drives `ParamMouthOpenY` from the TTS RMS we compute (our-RMS path); VTS-native lipsync is not wired in the skeleton

### Action Compositor & VTS Bridge

- [ ] **AVT-01**: 60 Hz action compositor merges three drivers (idle baseline, speech driver, intent overlay) into a single `ParamFrame` stream sent **sidecar-direct to VTS via pyvts** — NOT through the Electron renderer (which only forwards UI events like cursor-in-canvas back to the sidecar)
- [ ] **AVT-02**: Idle baseline driver runs continuously even when no other driver is active, writing rest-state values at least every second to comply with the VTS lower-bound rate limit; if no parameter is re-sent within 1s, VTS reverts that parameter to the face tracker
- [ ] **AVT-03**: Speech driver writes additive (`mode:"add"`) updates so it does not conflict with VTS's internal face tracker on machines where a webcam is active; intent overlay uses `mode:"set"` only with an explicit `weight` fade for smooth blends
- [ ] **AVT-04**: pyvts is wrapped behind a single-writer asyncio task (one coroutine owns the WebSocket) so concurrent producers don't trigger pyvts open issue #51 (`recv()` race during concurrent `asyncio.gather`)
- [ ] **AVT-05**: Renderer-aware ParamID resolver (~30 LOC) chooses the param-name strategy by renderer: VTS path writes input-layer names (`ParamAngleX`) and lets VTS internal routing handle smoothing; non-VTS branch is a `NotImplementedError` stub
- [ ] **AVT-06**: Speech-driver body-sway investigation runs at least two strategy-pattern implementations against the dev Teto rig (candidates: smoke-pass discovery of non-orphan downstream body params; `.exp3.json` body-pose modulation by RMS; custom physics chain via `<model>.vtube.json`); skeleton ships either visible body sway OR head-only motion (with breathing/micro-shoulder alternative) plus a committed written rationale documenting what was tried — investigation IS the deliverable, not a port-from-OLVT
- [ ] **AVT-07**: Skeleton ships a stub `teto_overrides.yaml` (or `.json`) checked into the repo even though import + smoke-pass tooling is deferred — empty orphan-params list, physics-chain proxy slots, sign-inversion slots — establishing the per-avatar override file schema for the future avatar-import milestone
- [ ] **AVT-08**: LLM emits `[joy]` → expression smoothly blends in over ~300ms and decays after the sentence ends — **not a hotkey pop**. This is §14 success criterion #2 and the skeleton's headline differentiator demo.
- [ ] **AVT-09**: One `DiscreteEvent` (e.g., prop visibility toggle) maps to a VTS hotkey via the discrete-event path, demonstrating the rare-discrete-trigger contract alongside the dominant continuous-param contract
- [ ] **AVT-10**: Cursor-in-canvas (React transparent overlay div over the VTS window) emits `ActionIntent(kind="reaction", ...)` events to the sidecar; compositor produces visible avatar eye/head tracking on the cursor

### Skeleton Verification & Contracts

- [ ] **SC-01**: All six §14 success criteria are formally verified against the running system and recorded in a `.planning/skeleton-verification.md` handoff document (1. text→reply with synced lipsync, 2. `[joy]` smooth blend, 3. visible idle micro-motion, 4. visible speech-driven body/head sway, 5. cursor tracking, 6. WS protocol matches OLVT shape)
- [ ] **SC-02**: `packages/contracts/` initially ships hand-written TypeScript mirroring the Pydantic models in Python; final phase replaces hand-written TS with codegen (`datamodel-code-generator` or `pydantic2ts`); Pydantic models are the source of truth

## v2 Requirements

Acknowledged for v1 horizon, deferred to subsequent milestones in priority order. Tracked but not in current roadmap.

### Memory Subsystem (next milestone after skeleton)

- **MEM-01**: Per-avatar profile loader (markdown/yaml/json with hot-reload via watchdog/chokidar `awaitWriteFinish`)
- **MEM-02**: Per-avatar episodic Chroma store, per-turn-pair chunks, thread-tagged
- **MEM-03**: Shared user-facts bucket (single Chroma collection, write-on-promotion)
- **MEM-04**: Hybrid retrieval — vector top-k + BM25 top-k merged via reciprocal rank fusion
- **MEM-05**: SQLite FTS5 full-text search over chat history (Ctrl+F)
- **MEM-06**: Memory write triggers — session-end summarizer, every-50-turns checkpoint, "remember this" command
- **MEM-07**: Per-message "forget this" + per-avatar wipe deletion ops

### Multi-thread Chat & Multi-avatar Identity

- **MULTI-01**: Multi-thread chat per avatar (ChatGPT-style sidebar, virtualized scroll, LLM-auto-named threads)
- **MULTI-02**: Avatar import pipeline (VTS .zip + raw Cubism folders); refuse Cubism 5.3 with helpful message until VTS upstream support lands
- **MULTI-03**: Avatar dropdown switching — atomic swap of personality + voice + episodic memory bucket; shared user-facts persist
- **MULTI-04**: Default shipping avatar = Live2D Inc. sample model (Hiyori/Mark/Wanderer); Teto stays dev-only

### Voice & Image Input

- **VI-01**: Voice input via faster-whisper ASR (default `small` model, user-selectable `tiny`/`base`/`medium`)
- **VI-02**: silero-vad raw VAD (no wake word); medium default sensitivity, slider in settings
- **VI-03**: Push-to-talk + VAD interrupt of in-flight TTS
- **VI-04**: Image input (paste/drag/file picker) for multimodal LLMs

### Agent Runtime (entire PROJECT_DESIGN.md §9)

- **AGENT-01**: Goal-loop with router (same LLM as conversation) + ScreenControlSubAgent (Claude Agent SDK + OmniParser-v2 + pyautogui + mss) + CLISubAgent (claude-code subprocess)
- **AGENT-02**: Verification loop — re-screenshot + multimodal LLM "is goal met?" + screenshot-perceptual-hash cache
- **AGENT-03**: Permission strip (file_ops/web/screen_control), all-off default, per-session re-grant
- **AGENT-04**: File-ops directory allowlist (only meaningful when file_ops on)
- **AGENT-05**: Audit log (per-action SQLite, exportable JSON, screenshot refs)
- **AGENT-06**: Click-through avatar window during goal-loop
- **AGENT-07**: Triple-Esc kill switch + stop button; best-effort rollback prompt on cancel
- **AGENT-08**: 30-step budget with extend prompt
- **AGENT-09**: Mid-loop permission prompt when goal needs a denied capability
- **AGENT-10**: Verifier verdict + final-screenshot user-confirmation gate before DONE
- **AGENT-11**: Companion-mode agent suggestion when user asks for goal-shaped task with agent off

### Goal Templates & Scheduler

- **SCHED-01**: Saved goal templates (plain-text only, no `{placeholder}` params)
- **SCHED-02**: One-click re-run from agent panel dropdown
- **SCHED-03**: Cron schedule per template via APScheduler in the Python sidecar
- **SCHED-04**: Scheduled goals fire while app is running or in tray; missed-runs prompt-on-next-launch
- **SCHED-05**: Per-template permission grants with visible badge (the §13.121 backdoor + transparency)

### In-app Skills System

- **SKILL-01**: Skill manifest discovery — `skill.yaml`/`.yml`/`.json`/`pyproject.toml [tool.skill]` priority order
- **SKILL-02**: Auto-parser fallback — inspect Python files, propose manifest, require user confirm before install
- **SKILL-03**: Per-skill permission grants (sticky across sessions); first-time prompt on need
- **SKILL-04**: Skills run in-process unsandboxed; "only install trusted skills" warning at install time

### Pet Mode & Form Factor

- **FORM-01**: Pet mode toggle — transparent borderless always-on-top avatar window
- **FORM-02**: Chat moves into a separate dockable window in pet mode; positions/sizes persist
- **FORM-03**: Avatar drag-and-move with light inertia + edge resistance
- **FORM-04**: Configurable close-button behavior (quit/minimize-tray/ask-each-time)

### Multiple TTS Backends

- **TTSv2-01**: edge-tts online fallback
- **TTSv2-02**: GPT-SoVITS as external API client (we don't manage SoVITS lifecycle)
- **TTSv2-03**: ComfyUI graph-based TTS (advanced users)
- **TTSv2-04**: Per-avatar voice selection in `voice.yaml`
- **TTSv2-05**: Audio output device picker, hot-swap honored at next TTS sentence boundary

### UX Polish

- **UX-01**: Per-message reasoning-text expand chevron (DeepSeek-R1 thinking blocks visible on demand)
- **UX-02**: Hit zones (`hitZones.json`) for click reactions on avatar regions
- **UX-03**: Edit/resend past user message + regenerate any assistant response
- **UX-04**: Per-avatar entrance motion declaration; fade-in fallback
- **UX-05**: Sliding-window context manager + auto-summary + UI eviction divider
- **UX-06**: Telemetry (opt-in: crash + anonymized usage)
- **UX-07**: Auto-update notify-only (electron-updater)
- **UX-08**: i18n English-only translations day-1 with scaffold for future locales
- **UX-09**: Markdown export per conversation
- **UX-10**: Crash-recovery snapshot + auto-resume of chat thread (no goal-loop replay)

### Post-MVP Exploratory

- **EXPLOR-01**: pixi-live2d-display(-advanced) as a non-VTS renderer fallback — **post-MVP only**, attempted after the project is otherwise fully working as a mobile-portability hedge; may be abandoned if it doesn't pan out

## Out of Scope

Explicitly excluded from v1 entirely. Not in v2, not in any future milestone of this project.

| Feature | Reason |
|---------|--------|
| Mobile companion | Separate future project with its own design doc and tech stack (PROJECT_DESIGN.md §10, §16) |
| Cross-device pairing / remote control / relay servers | Local-first by design; no LAN/WAN protocol |
| Group avatars / multi-character scenes | Single-avatar UX target; "one at a time" decided in §13.33 |
| Multi-user / family accounts | Single-user by design (§13.7) |
| Anti-cheat-game automation | Carved out of supported agent scope (R-2) |
| Native Cubism Web SDK rendering | Cubism licensing burden + VTS handles deformer math (§11) |
| Auto-update auto-install | Notify-only forever (§13.44) |
| Skill code signing / sandboxed execution | Trust burden on user; same model as Claude Code skills (§5.9) |
| Cloud-hosted memory sync | Local-first by design |
| Voice cloning UI | Users supply their own GPT-SoVITS model (§13.119) |
| Plugin/extension marketplace | No skill catalog/registry — drop-folder distribution only |
| Agent best-effort rollback for irreversible actions | Sent emails / posted comments listed but not undone |
| Goal template parameterization (`{account}`, `{date}`) | Plain text only (§13.83) |
| Wake word activation | Raw VAD only when voice ships (§13.45) |
| Memory encryption at rest | Plaintext + OS user-account isolation (§13.112) |
| Active screen-context injection into system prompt | Privacy concern; gated future feature requiring explicit screen permission |
| Per-thread system prompt overrides | Filesystem profile editing only (§13.103) |
| Scheduled goals running while app fully closed | Tray required (§13.77) |
| Per-avatar custom sound packs | Default UI sounds only |

## Traceability

Populated by the roadmapper during ROADMAP.md creation (2026-05-06). Maintained as phases complete.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLUMB-01 | Phase 1 | Complete |
| PLUMB-02 | Phase 1 | Complete |
| PLUMB-03 | Phase 1 | Complete |
| PLUMB-04 | Phase 1 | Complete |
| PLUMB-05 | Phase 1 | Complete |
| LLM-01 | Phase 2 | Pending |
| LLM-02 | Phase 2 | Pending |
| LLM-03 | Phase 2 | Pending |
| LLM-04 | Phase 2 | Pending |
| TTS-01 | Phase 3 | Pending |
| TTS-02 | Phase 3 | Pending |
| TTS-03 | Phase 3 | Pending |
| TTS-04 | Phase 3 | Pending |
| AVT-01 | Phase 4 | Pending |
| AVT-02 | Phase 4 | Pending |
| AVT-03 | Phase 4 | Pending |
| AVT-04 | Phase 4 | Pending |
| AVT-05 | Phase 4 | Pending |
| AVT-06 | Phase 4 | Pending |
| AVT-07 | Phase 4 | Pending |
| AVT-08 | Phase 4 | Pending |
| AVT-09 | Phase 4 | Pending |
| AVT-10 | Phase 4 | Pending |
| SC-01 | Phase 5 | Pending |
| SC-02 | Phase 5 | Pending |

**Cross-phase note**: PLUMB-05 (pyvts vendoring) is logically Phase 1 plumbing but is *consumed* by Phase 4 (compositor's single-writer wrapper around the vendored pyvts). It is mapped to Phase 1 only — Phase 4 builds on Phase 1's deliverable.

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0
- Distribution: Phase 1 = 5, Phase 2 = 4, Phase 3 = 4, Phase 4 = 10, Phase 5 = 2

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 — traceability populated by roadmapper (5-phase walking-skeleton structure)*
