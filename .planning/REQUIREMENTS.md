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

- [x] **LLM-01**: LiteLLM is the single LLM client; the setup screen supports two providers in the skeleton — LM Studio default and a custom OpenAI-compatible endpoint; LiteLLM timeout is set to ≥120s to absorb LM Studio cold-start lazy model loading
- [x] **LLM-02**: Conversation orchestrator runs the OLVT-style decorator chain (sentence_divider via pysbd → actions_extractor with buffer-then-extract on **completed** sentences only → tts_filter → TTS queue) — never extract `[tag]` markers from streaming token deltas; BPE splits like `[`, `jo`, `y]` are common
- [x] **LLM-03**: LLM gateway uses LiteLLM call-level reasoning-disable kwargs to suppress `<think>` reasoning blocks at the API boundary (provider-specific: `extra_body.chat_template_kwargs.enable_thinking=False` for LM Studio / custom OpenAI-compatible; `reasoning_effort="none"` for Anthropic; `reasoning_effort="minimal"` for OpenAI o1/o3; no kwarg for Gemini). NO parser-strip safety net and NO out-of-band reasoning capture — non-compliant models leak `<think>` to chat as a visible bug, the user's signal to switch models. Verified by Phase 5 SC-01 with a compliant reasoning model (latest DeepSeek-R1 distill or Qwen3-Reasoning).
- [x] **LLM-04**: Conversation runs on a single in-memory thread that clears on relaunch — no persistence, no FTS5, no thread sidebar in the skeleton

### TTS & Audio Playback

- [ ] **TTS-01**: piper TTS (ONNX, local) is the only voice backend in the skeleton; warmup synth at app launch caches one-token render to amortize ~200-500ms cold-start latency
- [x] **TTS-02**: TTS playback uses sentence-buffered model — per-sentence parallel synth + ordered delivery (the OLVT pattern); first sentence plays while subsequent sentences synthesize; perceived latency = first-sentence-synth-time
- [ ] **TTS-03**: TTS gateway exposes an RMS feature tap (audio amplitude envelope) that the action compositor's speech driver consumes in real time
- [ ] **TTS-04**: Lipsync drives `ParamMouthOpenY` from the TTS RMS we compute (our-RMS path); VTS-native lipsync is not wired in the skeleton

### Action Compositor & VTS Bridge

- [x] **AVT-01**: 60 Hz action compositor merges three drivers (idle baseline, speech driver, intent overlay) into a single `ParamFrame` stream sent **sidecar-direct to VTS via pyvts** — NOT through the Electron renderer
- [x] **AVT-02**: Idle baseline driver runs continuously even when no other driver is active, writing rest-state values at least every second to comply with the VTS lower-bound rate limit; if no parameter is re-sent within 1s, VTS reverts that parameter to the face tracker
- [x] **AVT-03**: Speech driver writes additive (`mode:"add"`) updates so it does not conflict with VTS's internal face tracker on machines where a webcam is active; intent overlay uses `mode:"set"` only with an explicit `weight` fade for smooth blends
- [x] **AVT-04**: pyvts is wrapped behind a single-writer asyncio task (one coroutine owns the WebSocket) so concurrent producers don't trigger pyvts open issue #51 (`recv()` race during concurrent `asyncio.gather`)
- [x] **AVT-05**: Renderer-aware ParamID resolver (~30 LOC) chooses the param-name strategy by renderer: VTS path writes input-layer names (`ParamAngleX`) and lets VTS internal routing handle smoothing; non-VTS branch is a `NotImplementedError` stub
- [x] **AVT-06**: Speech-driver body-sway investigation runs at least two strategy-pattern implementations against the dev Teto rig (candidates: smoke-pass discovery of non-orphan downstream body params; `.exp3.json` body-pose modulation by RMS; custom physics chain via `<model>.vtube.json`); skeleton ships either visible body sway OR head-only motion (with breathing/micro-shoulder alternative) plus a committed written rationale documenting what was tried — investigation IS the deliverable, not a port-from-OLVT
- [x] **AVT-07**: Skeleton ships a stub `teto_overrides.yaml` (or `.json`) checked into the repo even though import + smoke-pass tooling is deferred — empty orphan-params list, physics-chain proxy slots, sign-inversion slots — establishing the per-avatar override file schema for the future avatar-import milestone
- [x] **AVT-08**: LLM emits `[joy]` → expression smoothly blends in over ~300ms and decays after the sentence ends — **not a hotkey pop**. This is §14 success criterion #2 and the skeleton's headline differentiator demo.
- [x] **AVT-09**: One `DiscreteEvent` (e.g., prop visibility toggle) maps to a VTS hotkey via the discrete-event path, demonstrating the rare-discrete-trigger contract alongside the dominant continuous-param contract
- [x] **AVT-10**: Sidecar Win32 cursor polling detects VTube Studio window bounds and cursor position; compositor produces visible avatar eye/head tracking on the cursor and eases back when the cursor leaves

### Skeleton Verification & Contracts

- [ ] **SC-01**: All six §14 success criteria are formally verified against the running system and recorded in a `.planning/skeleton-verification.md` handoff document (1. text→reply with synced lipsync, 2. `[joy]` smooth blend, 3. visible idle micro-motion, 4. visible speech-driven body/head sway, 5. cursor tracking, 6. WS protocol matches OLVT shape)
- [ ] **SC-02**: `packages/contracts/` initially ships hand-written TypeScript mirroring the Pydantic models in Python; final phase replaces hand-written TS with codegen (`datamodel-code-generator` or `pydantic2ts`); Pydantic models are the source of truth

## v2.0 Milestone Requirements: Plugin + Animation Control

**Defined:** 2026-05-08
**Phases:** 6, 8, 7, 9, 10 (gating-derived order — Phase 8 catalogs feed Phase 7 parsers; locked 2026-05-08)
**Source:** `PROJECT_DESIGN.md` §14B + `.planning/research/v2.0/SUMMARY.md`

This milestone refactors the animation layer from compositor-internal to plugin-driven, adds an in-app slider HUD with per-param locks, formalizes a three-category LLM emit code system (action / variant / event), and lands a user-facing avatar import flow. Agent system development (PROJECT_DESIGN.md §9) is deferred in favor of this animation-architecture pivot.

### Plugin Architecture & Contracts (cross-cutting; lands across Phases 6, 7, 9)

These are the load-bearing architectural invariants that make plug-and-play possible. Every concrete requirement in PLG/IMP/PARSE/HUD/VFY below must honor these. Violating any of these breaks the plug-and-play property.

- [ ] **ARCH-01**: **Strict separation: system owns the LLM contract and the VTS contract; plugin owns the motion contract.** System routes LLM token stream into plugin's `on_token_stream`; system receives `ParamFrame` stream from plugin and dispatches to VTS via the single `PyvtsSafeWriter`. Plugin MUST NOT call pyvts, the filesystem, the network, or other side-effects directly outside its declared lifecycle hooks. The system is the intermediary; plugins are pure motion-functions.
- [ ] **ARCH-02**: **`RigCapabilities` is the rig-introspection contract** — single Pydantic model fed to BOTH plugin's `on_load(capabilities)` AND renderer's HUD via `GET /admin/rig-capabilities`. Fields: writable param IDs (Cubism-standard names), per-param ranges (when known), expressions list (per-rig), hotkeys list with VTS hotkey IDs, `cdi3.json` display-name map (when present), per-rig sign inversions from `_avatar_overrides.yaml`, plugin-default emotion bindings from `_avatar_overrides.yaml`. Frozen at sidecar boot. Plugin authors target this contract; plugins are rig-agnostic by design and adapt at `on_load` based on what `capabilities` reports.
- [ ] **ARCH-03**: **Plugin's token-stream input is the orchestrator-decorated stream, NOT raw LLM tokens.** Plugin sees per-sentence text deltas (post `sentence_divider`, pre `code_extractor`) so plugin sees its action codes IN context with surrounding text — plugin can use semantic context, not just bare codes. Action-code dispatch is in-band: plugin receives the sentence containing `[joy]` and emits ParamFrames in response. Plugin chooses its own parser strategy for its own action codes.
- [ ] **ARCH-04**: **Plugin's output is `AsyncIterator[ParamFrame]` at any cadence ≤ 60 Hz.** Compositor's `PluginAdapter(TickDriver)` buffers the most recent ParamFrame; `tick(now)` returns it (with stale-decay pattern matching milestone-1's `IntentDriver`). Plugin under-rate falls back to hold-last-frame (preserves AVT-02 1-second re-injection rule). Plugin over-rate is coalesced by rate-limiter at the loader boundary. Plugins are pull-rate-limited at the compositor edge — the plugin author cannot accidentally flood VTS.
- [ ] **ARCH-05**: **Compositor merge order is fixed and load-bearing:** `IdleDriver → SpeechDriver (lipsync only) → PluginAdapter (output from active plugin) → CursorDriver → system-primitive override list → lock_filter → clamp_and_validate → pyvts.inject_params`. Plugin output enters the merge in the third slot; lock filter applies last among contributors; system-primitive overrides (e.g., lipsync on `MouthOpenY` overrides user lock) apply BEFORE lock filter. This ordering is not a planner choice — Phase 6 implements it as written.
- [ ] **ARCH-06**: **Single pyvts writer rule (carried over from M1 AVT-04) extends to all v2.0 entry points.** Every new entry point — plugin output, variant dispatch, event dispatch, HUD lock writes, cursor frames — flows through `PyvtsSafeWriter`. Plugin CANNOT import or instantiate pyvts directly. CI enforces this via `grep "import pyvts" sidecar/src/ | wc -l == 1` test (must equal 1, the writer file).
- [ ] **ARCH-07**: **Plugin process model: in-sidecar Python, no isolation, full trust.** Plugins are trusted Python code with the same trust model as the existing skills system (PROJECT_DESIGN.md §13.122). Plugin marketplace, signing, sandboxing, and per-plugin venvs are explicitly deferred to milestone-3+. R-19 (PROJECT_DESIGN.md §15) tracks this risk.
- [ ] **ARCH-08**: **Plugin discovery precedence: `userData/plugins/` overrides `plugins/` (in-tree) when both declare the same `name`.** Allows users to install replacement implementations (including a replacement default plugin) without modifying the in-tree codebase. System emits a WARN log at boot when an override is detected, naming both paths.
- [ ] **ARCH-09**: **Plugin extends LLM emit vocabulary architecturally, not via mid-conversation prompt rebuild.** Plugin's `action_codes` (with descriptions) are appended to the system prompt under a fixed delimiter at orchestrator boot. Prompt is KV-cache prefix-stable (M1 D-17 rule). The LLM learns "you may emit `[joy]`, `[wave]`, ..." once at session start; switching plugins requires sidecar restart (PLG-09 lifecycle rule); no mid-conversation rebuild EVER.
- [ ] **ARCH-10**: **Plugin runtime is fully decoupled from milestone-1 compositor primitives.** `IdleDriver`, `SpeechDriver` (lipsync only post-v2), `CursorDriver`, `PyvtsSafeWriter` keep their `TickDriver` Protocol seams. `IntentDriver` is DELETED in Phase 6 — its body-motion logic migrates verbatim into the default plugin (rig-specific by definition). Adding or swapping a plugin must NOT require touching idle / lipsync / cursor / pyvts-writer code. This decoupling is what makes plug-and-play possible.
- [ ] **ARCH-11**: **Plugin authoring API surface is stable post-Phase-6 and gated by `api_version`.** The `BodyMotionPlugin` ABC, `RigCapabilities` contract, and `ParamFrame` payload shape are versioned via `api_version: "1.0"` in `plugin.yaml`. System refuses to load plugins with incompatible major versions; minor-version mismatches produce WARN log only. Breaking changes to the plugin contract bump the major version and migrate the default plugin in lockstep.
- [ ] **ARCH-12**: **System-primitive override list is explicit and per-param, not a magic global rule.** The list lives in `compositor/lock_filter.py` and currently contains only `MouthOpenY` (overridden by lipsync). Adding entries requires explicit code review — an architectural decision per param, not a runtime config knob. Documents WHY each entry is on the list (lipsync without mouth = broken).

### Plugin Runtime (Phase 6)

- [ ] **PLG-01**: System loads single-active body-motion plugin from `plugin.yaml` manifest at sidecar startup; manifest declares `name`, `version`, `entrypoint` (`module:class`), `api_version`, `action_codes` (with descriptions), and optional metadata fields `author`, `license`, `homepage`, `description`
- [ ] **PLG-02**: Plugin's `action_codes` (sorted deterministically) contribute to LLM system prompt assembly under a fixed delimiter; assembly happens once at orchestrator construction (KV-cache prefix-stability is load-bearing per Phase 2 D-17)
- [ ] **PLG-03**: Plugin implements `BodyMotionPlugin` ABC with three lifecycle hooks: `on_load(capabilities: RigCapabilities)` synchronous setup, `on_token_stream(tokens) -> AsyncIterator[ParamFrame]` async generator, `on_unload()` cleanup
- [ ] **PLG-04**: Plugin runtime supervises async-generator lifecycle with circuit-breaker (3 restarts within 60s); plugin crashes during `__init__`/`on_load`/`on_token_stream` are caught and fall back to a null plugin emitting rest-state ParamFrames at 60 Hz; the sidecar process must NOT crash
- [ ] **PLG-05**: ParamFrame values from plugin output are clamped to `[0, 1]` at the compositor → renderer boundary (`clamp_and_validate(frame, capabilities)` pass); NaN/Inf drops the frame; unknown param keys are dropped with WARN log
- [ ] **PLG-06**: Manifest loader validates against `plugin.yaml` JSON Schema via `jsonschema 4.26.0`; reserved-name guard rejects action_codes matching `<think>`, `<thinking>`, `<tool_call>`, `<function_call>`, `<function_calls>`, `<invoke>`, `<parameter>` (sweep extended during Phase 7 plan-phase research for any additional LLM-protocol sentinels)
- [ ] **PLG-07**: Default plugin ships in-tree at `plugins/default/`, absorbs current Phase-4 `IntentDriver` + `compositor/body_sway/*` logic, uses OLVT 8-emotion vocabulary (`neutral`, `anger`, `disgust`, `fear`, `joy`, `smirk`, `sadness`, `surprise`) as its `action_codes` set
- [ ] **PLG-08**: Plugin discovery scans both `plugins/` (in-tree, repo root — defaults ship here) and `app.getPath('userData')/plugins/` (user-installed)
- [ ] **PLG-09**: Plugin switching is startup-only: developer changes config-file, sidecar restart applies; runtime hot-swap is explicitly deferred (avoids state-handoff complexity for in-flight ParamFrames)
- [ ] **PLG-10**: `plugin.yaml` manifest hot-reload via `watchdog 6.0.0` triggers manifest re-parse + WARN log if `action_codes` set changed (engineer DX); does NOT reload plugin behavior

### Avatar Import + Catalog (Phase 8)

- [ ] **IMP-01**: User imports an avatar via Electron file dialog (`dialog.showOpenDialog()`); folder path passes to sidecar via `ipc:avatar:import-pick`; sidecar detects type from file shape: VTS standard (has `.vtube.json`), Cubism with named expressions (`model3.json` `FileReferences.Expressions` populated), Cubism bare (no expressions), or OLVT (has `model_dict.json`)
- [ ] **IMP-02**: VTS extractor parses `*.vtube.json` `Hotkeys[]`, filters `Action: "ToggleExpression"`, derives variant code names (strip `[N]` keybind suffix, strip `【】` decorative brackets, lowercase, hyphenate, e.g., `【SV】Microphone[1]` → `sv-microphone`)
- [ ] **IMP-03**: Cubism-with-expressions extractor reads `model3.json` `FileReferences.Expressions[].Name` and emits placeholder names; mandatory review screen REQUIRES the user to relabel placeholders before Save is enabled (e.g., `exp_01` → user-supplied semantic name)
- [ ] **IMP-04**: Cubism-bare extractor produces empty variant catalog (avatar is plugin-only); event catalog still extractable from `.motion3.json` files when present
- [ ] **IMP-05**: OLVT `model_dict.json` extractor reads `emotionMap` (becomes default-plugin per-rig action-code → expression binding) and `actionMap` (becomes variant catalog with semantic names — no placeholder relabeling required)
- [ ] **IMP-06**: Event catalog auto-extracted from `.motion3.json` files; event code names derived from `Motions` group keys + filenames (slug rule: lowercase, hyphenate, no path separators)
- [ ] **IMP-07**: Mandatory review screen presents draft variant + event catalogs in a dedicated React route (NOT modal); user edits names, deletes irrelevant entries, or skips a category; Save is disabled while placeholder names remain
- [ ] **IMP-08**: Review screen accessible from Settings at any time for re-edit; commits write `_avatar_overrides.yaml` (sibling to `avatar.yaml`); writes are validated against the YAML schema via `jsonschema` at write-time
- [ ] **IMP-09**: Existing `TetoOverrides` Pydantic class renamed to `AvatarOverrides`; `avatar.yaml` remains read-only (introspection-only); `_avatar_overrides.yaml` carries user-edited variant + event catalogs + per-rig sign inversions + plugin-default emotion bindings
- [ ] **IMP-10**: VTS API introspection smoke-test (`sidecar/scripts/vts_introspect_smoke.py`) validates `pyvts 0.3.3` produces expected fields against the actual Teto rig before extractor implementation lands (pyvts is aged with no commits since 2024-09-10)

### Three-Category Code Parsing + Dispatch (Phase 7)

- [ ] **PARSE-01**: New `code_extractor` decorator replaces `actions_extractor` in the orchestrator chain; single-pass bracket walker dispatches on opener char (`[` → action, `{` → variant, `<` → event); handles split-token-boundary cases for all three syntaxes (the milestone-1 `[`/`jo`/`y]` adversarial fix extends to `{` and `<`)
- [ ] **PARSE-02**: `display_processor.filter_brackets` extends to strip all three syntaxes from chat display + TTS text
- [ ] **PARSE-03**: Dispatch routing: action codes (`[xxx]`) feed the active plugin's input queue; variant codes (`{xxx}`) dispatch via `PyvtsSafeWriter` toggle hotkey; event codes (`<xxx>`) dispatch via VTS motion hotkey (registered during Phase 8 import)
- [ ] **PARSE-04**: Parser ordering is load-bearing: `<think>...</think>` reasoning-strip runs FIRST (before sentence-buffer, before three-category extractor) so DeepSeek-R1's reasoning never leaks into event-code dispatch
- [ ] **PARSE-05**: Variant collision policy is **radio-button single-active** — when LLM emits a new variant code while a previous variant is still toggled, the new variant turns ON and the previous variant turns OFF (deterministic, no additive layering)
- [ ] **PARSE-06**: Event auto-completion uses `motion3.json.Meta.Duration + 1s blend pad`; if `Meta.Duration` is missing or > 10s, hardcoded 10s ceiling fallback fires the auto-untoggle
- [ ] **PARSE-07**: Cross-category uniqueness check at sidecar boot: `plugin_action_codes ∩ variant_codes ∩ event_codes = ∅`; loud failure (boot-blocking exception) if collision detected
- [ ] **PARSE-08**: Adversarial test fixtures verify split-token reassembly for all three categories: `[`/`joy]` → ActionIntent, `{`/`hold-mic}` → VariantToggle, `<`/`wave>` → EventFire; no bracket character ever leaks to chat or TTS

### Slider HUD + Per-Param Lock (Phase 9)

- [ ] **HUD-01**: Sidecar exposes a separate WebSocket endpoint `/hud/ws` that is opened only when the renderer's HUD route is mounted; closed on unmount; preserves the AVT-01 "renderer never sees 60 Hz traffic" rule for non-HUD operation
- [ ] **HUD-02**: Compositor taps its emit step at 15 Hz throttle (sidecar-side gate, not renderer-side); ParamFrame deltas are pushed to `/hud/ws` connected clients
- [ ] **HUD-03**: Renderer HUD shows a scrollable list of all writable params from `RigCapabilities`; each row contains: param name, value display, slider, lock toggle
- [ ] **HUD-04**: Slider drag fires `set-lock(param_id, value)` over `/hud/ws`; lock auto-engages renderer-side optimistically; sidecar confirms within the next 15 Hz frame; the sidecar is single-source-of-truth for `compositor.lock_state`
- [ ] **HUD-05**: Compositor merge applies locks LAST in the merge order; system primitives (lipsync writing `MouthOpenY`) override locks for safety — speech without mouth movement looks broken
- [ ] **HUD-06**: Override badge surfaces on slider rows where a system primitive overrode the user lock (visual indication that lock didn't stick, with the cause — e.g., "lipsync overriding"); user understands without confusion
- [ ] **HUD-07**: Lock state is session-only — process memory in sidecar, cleared on app restart (locks are a discovery tool, not a persistent preference)
- [ ] **HUD-08**: New `GET /admin/rig-capabilities` HTTP endpoint returns rig param IDs + ranges + expressions + hotkeys for HUD's first-open population (synchronous fetch on HUD mount; not WS push, since the data is static for the session)

### Verification + Cursor Polish (Phase 10)

- [ ] **VFY-01**: Cursor sensor work is OPTIONAL polish for v2.0; the current sidecar-side cursor capture (Phase 4) keeps its in-VTS-window gate. **Documented future-direction:** a later milestone may introduce native Cubism rendering integration that supports better global cursor tracking; v2.0 doesn't bet on this. The original §14 SC #4 (cursor tracking visible across the desktop) becomes a PARTIAL verdict in §14 re-verification.
- [ ] **VFY-02**: If Phase 10 cursor polish does land: drop the in-VTS-window gate at `cursor_driver.py:27-28`; add synthetic-canvas fallback (project against primary-monitor center when no VTS window detected); DPI awareness + multi-monitor robustness is deferred (cursor is no longer a v2.0 priority)
- [ ] **VFY-03**: §14 success criteria re-run against the refactored architecture: all six SCs verified or explicitly marked PARTIAL with rationale (cursor SC may be PARTIAL per VFY-01); SC #2 (`[joy]` smooth fade) and SC #3 (body sway throughout utterance) are the highest-risk regressions because the responsibilities migrated from compositor-internal to default plugin
- [ ] **VFY-04**: §14 verification record committed to `.planning/skeleton-verification.md` (the milestone-1 SC-01 deferred deliverable, now realized under refactored architecture); records pass/partial/fail verdicts for all six §14 SCs with concrete observations
- [ ] **VFY-05**: Side-by-side §14 SC comparison harness (built as part of Phase 6's plumbing-week sub-phase) captures milestone-1 baselines; Phase 10 replays against current and reports tolerance-band passes (latency ±100ms, param values ±0.05 — defaults; tune at Phase 10 plan-phase if baselines indicate)

---

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
| LLM-01 | Phase 2 | Complete |
| LLM-02 | Phase 2 | Complete |
| LLM-03 | Phase 2 | Complete |
| LLM-04 | Phase 2 | Complete |
| TTS-01 | Phase 3 | Pending |
| TTS-02 | Phase 3 | Complete |
| TTS-03 | Phase 3 | Pending |
| TTS-04 | Phase 3 | Pending |
| AVT-01 | Phase 4 | Complete |
| AVT-02 | Phase 4 | Complete |
| AVT-03 | Phase 4 | Complete |
| AVT-04 | Phase 4 | Complete |
| AVT-05 | Phase 4 | Complete |
| AVT-06 | Phase 4 | Complete |
| AVT-07 | Phase 4 | Complete |
| AVT-08 | Phase 4 | Complete |
| AVT-09 | Phase 4 | Complete |
| AVT-10 | Phase 4 | Complete |
| SC-01 | Phase 5 → Phase 10 | Migrated 2026-05-08 (skeleton-verification.md ceremony lands as v2.0 Phase 10 exit criterion) |
| SC-02 | Phase 5 | Pending |
| ARCH-01 | Phase 6 | Pending — strict system/plugin separation invariant |
| ARCH-02 | Phase 6 | Pending — `RigCapabilities` shared with Phase 9 HUD |
| ARCH-03 | Phase 6 | Pending — orchestrator-decorated token stream feed |
| ARCH-04 | Phase 6 | Pending — `AsyncIterator[ParamFrame]` ≤ 60 Hz contract |
| ARCH-05 | Phase 6 | Pending — fixed compositor merge order |
| ARCH-06 | Phase 6 | Pending — single pyvts writer rule (extends AVT-04) |
| ARCH-07 | Phase 6 | Pending — in-sidecar Python, no isolation, full trust |
| ARCH-08 | Phase 6 | Pending — plugin discovery precedence (`userData/` > in-tree) |
| ARCH-09 | Phase 6 | Pending — vocabulary extension at orchestrator boot, KV-cache stable |
| ARCH-10 | Phase 6 | Pending — runtime decoupled from M1 primitives; `IntentDriver` deleted |
| ARCH-11 | Phase 6 | Pending — `api_version: "1.0"` gating |
| ARCH-12 | Phase 6 | Pending — system-primitive override list explicit + per-param |
| PLG-01 | Phase 6 | Pending — single-active body-motion plugin from `plugin.yaml` |
| PLG-02 | Phase 6 | Pending — sorted action_codes → fixed-delimiter system-prompt fragment |
| PLG-03 | Phase 6 | Pending — `BodyMotionPlugin` ABC with three lifecycle hooks |
| PLG-04 | Phase 6 | Pending — async-gen supervisor + circuit breaker + null-plugin fallback |
| PLG-05 | Phase 6 | Pending — `[0,1]` clamp at compositor → renderer boundary |
| PLG-06 | Phase 6 | Pending — jsonschema manifest + reserved-name guard |
| PLG-07 | Phase 6 | Pending — default plugin in-tree absorbs `IntentDriver` + body-sway |
| PLG-08 | Phase 6 | Pending — discovery scans both in-tree and `userData/` |
| PLG-09 | Phase 6 | Pending — startup-only switching (no runtime hot-swap) |
| PLG-10 | Phase 6 | Pending — manifest hot-reload via `watchdog` (engineer DX) |
| IMP-01 | Phase 8 | Pending — file-dialog import + sidecar type detection |
| IMP-02 | Phase 8 | Pending — VTS `.vtube.json` Hotkeys[] extractor |
| IMP-03 | Phase 8 | Pending — Cubism `model3.json` placeholder relabel-required |
| IMP-04 | Phase 8 | Pending — Cubism-bare extractor (events from .motion3.json only) |
| IMP-05 | Phase 8 | Pending — OLVT `model_dict.json` drop-in (emotionMap + actionMap) |
| IMP-06 | Phase 8 | Pending — event catalog from .motion3.json group keys + filenames |
| IMP-07 | Phase 8 | Pending — mandatory review React route (NOT modal) + Save-disabled friction |
| IMP-08 | Phase 8 | Pending — re-openable from Settings + `_avatar_overrides.yaml` jsonschema-validated |
| IMP-09 | Phase 8 | Pending — `TetoOverrides` → `AvatarOverrides` rename |
| IMP-10 | Phase 8 | Pending — `vts_introspect_smoke.py` against actual Teto rig |
| PARSE-01 | Phase 7 | Pending — `code_extractor` decorator (single-pass bracket walker) |
| PARSE-02 | Phase 7 | Pending — `display_processor.filter_brackets` extension to all three syntaxes |
| PARSE-03 | Phase 7 | Pending — three-path dispatch (action / variant / event) |
| PARSE-04 | Phase 7 | Pending — `<think>` reasoning-strip runs FIRST in chain |
| PARSE-05 | Phase 7 | Pending — radio-button single-active variant policy |
| PARSE-06 | Phase 7 | Pending — `motion3.json.Meta.Duration + 1s` event auto-completion + 10s fallback |
| PARSE-07 | Phase 7 | Pending — cross-category uniqueness check at boot (loud failure) |
| PARSE-08 | Phase 7 | Pending — split-token reassembly fixtures for all three categories |
| HUD-01 | Phase 9 | Pending — dedicated `/hud/ws` WebSocket endpoint |
| HUD-02 | Phase 9 | Pending — sidecar 15 Hz throttle gate |
| HUD-03 | Phase 9 | Pending — scrollable param list from `RigCapabilities` |
| HUD-04 | Phase 9 | Pending — drag → optimistic lock + sidecar single-source-of-truth |
| HUD-05 | Phase 9 | Pending — locks LAST in merge; system-primitive override list |
| HUD-06 | Phase 9 | Pending — override-badge UX surfaces lock-overridden rows |
| HUD-07 | Phase 9 | Pending — session-only lock persistence |
| HUD-08 | Phase 9 | Pending — `GET /admin/rig-capabilities` HTTP endpoint |
| VFY-01 | Phase 10 | Pending — cursor polish OPTIONAL; SC #4 may be PARTIAL |
| VFY-02 | Phase 10 | Pending — if cursor lands: drop in-canvas gate + synthetic fallback |
| VFY-03 | Phase 10 | Pending — re-run all six §14 SCs against refactored architecture |
| VFY-04 | Phase 10 | Pending — `.planning/skeleton-verification.md` commit |
| VFY-05 | Phase 10 | Pending — side-by-side baseline harness (built in Phase 6 plumbing-week) |

**Cross-phase note (M1)**: PLUMB-05 (pyvts vendoring) is logically Phase 1 plumbing but is *consumed* by Phase 4 (compositor's single-writer wrapper around the vendored pyvts). It is mapped to Phase 1 only — Phase 4 builds on Phase 1's deliverable.

**Cross-phase notes (v2.0):**
- ARCH-01..12 are cross-cutting architectural invariants. They are *primary-mapped* to Phase 6 (where the contracts cement) but every subsequent phase (7, 8, 9, 10) must honor them.
- ARCH-02 (`RigCapabilities`) is *defined* in Phase 6 and *consumed* by Phase 9 HUD `GET /admin/rig-capabilities`.
- ARCH-06 (single pyvts writer) is *introduced* in milestone-1 (AVT-04) and *extended* to all v2.0 entry points (plugin output, variant dispatch, event dispatch, HUD locks, cursor frames). CI grep-test runs in Phase 6's plumbing-week.
- VFY-05 (side-by-side baseline harness) is *built* in Phase 6's plumbing-week and *consumed* in Phase 10.
- SC-01 *migrated* from Phase 5 to Phase 10 (deferred 2026-05-08; skeleton-verification.md ceremony lands under refactored architecture).

**Coverage:**
- v1 requirements: 25 total — Mapped to phases: 25 ✓
- v2.0 requirements: 53 total — Mapped to phases: 53 ✓
- Total: 78 — Mapped: 78 ✓ — Unmapped: 0
- Distribution: Phase 1 = 5, Phase 2 = 4, Phase 3 = 4, Phase 4 = 10, Phase 5 = 2 (SC-01 migrated to 10), Phase 6 = 22 (12 ARCH + 10 PLG), Phase 8 = 10, Phase 7 = 8, Phase 9 = 8, Phase 10 = 5

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-08 — v2.0 traceability appended by roadmapper (5 v2.0 phases, 53 requirements; gating-derived order 6 → 8 → 7 → 9 → 10)*
