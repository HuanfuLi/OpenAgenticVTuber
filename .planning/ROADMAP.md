# Roadmap: AgenticLLMVTuber — Walking Skeleton

## Milestones

- ✅ **v1.0 Walking Skeleton** — Phases 1-5 shipped 2026-05-08. Archive: `.planning/milestones/v1.0-ROADMAP.md`
- 🚧 **v2.0 Plugin + Animation Control** — Phase 8 ✅, Phase 6 ✅ (re_verification_4 passed 2026-05-08 PM after 06-07 writer consolidation + F-3 tracking-range fix + 06-08 active-Teto joy vocabulary correction), Phase 7 ✅, Phase 9 ✅, Phase 10 remaining.

## Overview

Five sequential phases that build the AgenticLLMVTuber walking skeleton end-to-end (PROJECT_DESIGN.md §14). Each phase's acceptance test is a **superset** of the previous phase — Phase 1 produces a typed echo round-trip; Phase 2 adds real LLM replies on top of that round-trip; Phase 3 adds spoken sentence-buffered audio; Phase 4 adds the 60 Hz multi-driver action compositor and VTS bridge (the unique value-add); Phase 5 closes the §14 success criteria with a formal verification record and replaces hand-written contracts with codegen. The skeleton validates the layered architecture (Electron + Python sidecar + VTS rendering + LiteLLM gateway + TTS pipeline + 60 Hz compositor) with one hardcoded avatar (Teto, dev-only), one in-memory chat thread, and companion mode only. Subsequent milestones (memory, agent, scheduler, skills, multi-thread, multi-avatar, pet mode) layer on top without rearchitecting.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Plumbing & Process Lifecycle** - Electron + sidecar + WS round-trip + LLM setup screen, no AI yet (2026-05-07)
- [x] **Phase 2: Conversation Pipeline** - Real LLM replies streamed sentence-by-sentence with `[joy]` extracted, no audio (2026-05-07)
- [x] **Phase 3: TTS & Sentence-Buffered Audio** - Avatar replies are spoken with our-RMS feature tap exposed (2026-05-07)
- [x] **Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation** - 60 Hz blended drivers; Teto moves; smooth `[joy]` blend; cursor tracking (2026-05-08)
- [x] **Phase 5: Polish, Contracts Codegen, §14 Verification** - Codegen replaces hand-written TS; §14 ceremony migrated to v2.0 Phase 10 (2026-05-08)

## Phase Details

### Phase 1: Plumbing & Process Lifecycle
**Goal**: A typed WebSocket round-trip works end-to-end — `npm run dev` boots Electron, which spawns the Python sidecar from venv, the renderer connects via WS, an "echo" message round-trips, and the mandatory LLM setup screen blocks first launch until LM Studio answers a real completion call.
**Depends on**: Nothing (first phase)
**Requirements**: PLUMB-01, PLUMB-02, PLUMB-03, PLUMB-04, PLUMB-05
**Success Criteria** (what must be TRUE):
  1. `npm run dev` boots the full stack on a clean clone — Electron window opens, sidecar starts from venv, log panel shows `[READY]` and connected
  2. Force-quitting Electron via Task Manager and immediately relaunching brings the sidecar back cleanly with no port collision (orphan-process handling works)
  3. First-launch flow shows a mandatory LLM setup screen that blocks the app until a real 1-token LM Studio completion succeeds (not just `/v1/models`)
  4. Typing `hello` in a minimal chat input round-trips through the sidecar and renders `echo: hello` in the renderer (proves the OLVT-shape WSMessage envelope end-to-end)
  5. `sidecar/vendor/pyvts/` exists and is importable; vendor stub-loads without contacting VTS
**Plans**: TBD

Plans:
- [x] 01-01-PLAN.md — Electron shell + sidecar lifecycle + chrome shell (PLUMB-01, PLUMB-02, PLUMB-05)
- [x] 01-02-PLAN.md — OLVT-shape WS envelope + echo round-trip + LLM setup gate (PLUMB-03, PLUMB-04)

**Open questions to resolve at plan-time:**
- **pyvts vendoring acceptability** (PLUMB-05): vendor from day one (recommended — upstream unmaintained since 2024-09-10) vs. wait-and-see. Default: vendor.
- **Port-allocation strategy** (PLUMB-03): `port:0` ephemeral with `[READY] ws://127.0.0.1:<port>/ws` stdout discovery (eliminates orphan-port collisions) vs. fixed-port + handshake. Default: `port:0`.
- **Reasoning-UI scope** (cross-cutting, surfaces in Phase 1's setup screen and Phase 2's chat panel): parser-strip-only (no UI surfacing, just suppress) vs. per-message expand chevron in chat. Default: parser-strip-only in skeleton; chevron deferred to UX milestone.

### Phase 2: Conversation Pipeline
**Goal**: A real LLM reply streams into the chat panel sentence-by-sentence, the `<think>` block is stripped at the orchestrator boundary, and `[joy]` is extracted as a logged `ActionIntent` (no audio, no avatar yet). Stub TTS (text-to-stdout) keeps Phase 3 fully decoupled.
**Depends on**: Phase 1
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04
**Success Criteria** (what must be TRUE):
  1. With LM Studio running, typing "tell me a 3-sentence story" produces three sentences appearing sequentially in the chat panel
  2. An LLM reply containing `[joy]` strips the tag from chat display AND logs an extracted `ActionIntent(kind="expression", name="joy", ...)` in the sidecar log panel
  3. An adversarial test fixture that splits `[joy]` across token deltas (`[`, `jo`, `y]`) still extracts cleanly via buffer-then-extract — no bracket character ever leaks to chat or stub-TTS output
  4. With a compliant reasoning model configured (latest DeepSeek-R1 distill that honors `enable_thinking:false`, or Qwen3-Reasoning), no `<think>...</think>` content appears in the main chat stream or in extracted `ActionIntent`s — verified by inspecting chat output during a multi-sentence reply. Non-compliant models leak `<think>` to chat as a visible bug; the user's signal to switch models. (Per CONTEXT.md D-10: API-level reasoning-disable, no parser-strip safety net, no side channel.)
  5. Closing and relaunching the app starts a fresh empty in-memory thread (no persistence, no FTS5)
**Plans**: TBD

Plans:
- [x] 02-01-PLAN.md — LiteLLM streaming gateway + AvatarCapabilities loader + WSMessage/AudioPayload/ActionIntent contracts + Wave-0 reasoning-disable smoke (LLM-01)
- [x] 02-02-PLAN.md — OLVT 4-decorator chain port + Orchestrator (append-only memory, KV-cache discipline) + WS handler wiring + boot warmup ping (LLM-02, LLM-03, LLM-04)
- [x] 02-03-PLAN.md — useStreamingMessages renderer reducer + WS dispatcher routing + LogsDrawer [INTENT] coloring + 4 new copy keys + ROADMAP SC#4 amendment (LLM-02, LLM-03)

**UI hint**: yes  <!-- Chat panel + sentence-streamed display + setup-screen interactions -->

### Phase 3: TTS & Sentence-Buffered Audio
**Goal**: The avatar's reply is **spoken** with sentence-buffered parallel synth + ordered playback (the OLVT pattern). The first sentence plays while the second is still synthesizing. The TTS gateway exposes a real RMS envelope tap that Phase 4's speech driver will consume — no stub.
**Depends on**: Phase 2
**Requirements**: TTS-01, TTS-02, TTS-03, TTS-04
**Success Criteria** (what must be TRUE):
  1. Typing a multi-sentence prompt produces audible TTS output for each sentence in correct order
  2. Logs prove parallel synth: sentence N audio playback begins while sentence N+1 synthesis is still running (verifiable via log timestamps)
  3. First-reply latency after a fresh launch is comparable to subsequent replies (warmup synth fired at boot — no ~900ms cold-start penalty)
  4. The first sentence's audio starts cleanly with no audible click/pop at sentence-start (sounddevice OutputStream pre-warmed; sample rate pinned to voice config)
  5. The TTS gateway's RMS feature tap is exposed via an in-process API that returns the per-sentence amplitude envelope synchronously when a sentence finishes synthesis (consumer contract for Phase 4)
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — TTSGateway (PiperVoice + warmup synth-and-discard + sounddevice OutputStream) + numpy chunk-RMS helper + synthesize_and_prepare_payload + SpeechEnvelopePayload contracts (Py + TS) + Phase 3 deps + Git LFS init + en_US-amy-medium voice bundle (TTS-01, TTS-03, TTS-04)
- [x] 03-02-PLAN.md — TTSTaskManager OLVT port (locked sender-task order: queue.put → ws.send → stream.write per D-11) + Orchestrator integration (compositor_speech_queue + pending_inputs FIFO + chain-end-after-drain per D-14) + sidecar lifespan TTSGateway pre-[READY] wiring + renderer "Teto is still speaking…" UX affordance (TTS-02)
- [x] 03-03-PLAN.md — Gap closure: minimal `SpeechEnvelopePayload` mouth driver + vendored-pyvts `ParamMouthOpenY` writer seam + server queue-consumer wiring (TTS-04)

### Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation
**Goal**: The §14 deliverable. Teto (running in VTube Studio) idles with visible micro-motion, speaks with synced lipsync, blends `[joy]` smoothly over ~300ms, sways its head (and body, if a strategy wins) through utterances with no flat moments, and tracks the cursor over the canvas. One discrete-event prop hotkey demonstrates the rare-trigger contract alongside the dominant 60 Hz parameter stream. **The body-sway investigation IS the deliverable** — ship visible body sway OR head-only with a committed written rationale.
**Depends on**: Phase 3
**Requirements**: AVT-01, AVT-02, AVT-03, AVT-04, AVT-05, AVT-06, AVT-07, AVT-08, AVT-09, AVT-10
**Success Criteria** (what must be TRUE):
  1. With VTube Studio running and Teto loaded, the avatar produces visible idle micro-motion (Perlin head drift + blinks) continuously when no one is talking
  2. During TTS playback, the avatar's mouth tracks RMS via `ParamMouthOpenY` (synced lipsync) AND the speech driver produces visibly continuous body OR head motion through the full TTS utterance with no flat moments (§14 success criterion #4 verbatim)
  3. An LLM reply containing `[joy]` makes Teto's joy expression smoothly blend in over ~300ms via `weight` fade and decay after the sentence ends — **not a hotkey pop** (§14 success criterion #2)
  4. Moving the cursor over the avatar canvas region makes Teto's eyes/head track the cursor; cursor exiting the canvas eases the avatar back to center (no wild dart)
  5. Pressing the test hotkey toggles a single VTS prop visibility (the discrete-event contract demo)
  6. With an active webcam feed in VTS, ambient and speech driver contributions still produce visible motion (proves `mode:"add"` for ambient layers, `mode:"set"` + `weight` only for intent overlays)
**Plans**: 8 plans

Plans:
- [x] 04-00-PLAN.md — Teto smoke-pass entry gate: TetoOverrides Pydantic loader + sidecar/scripts/teto_smoke_pass.py CLI + populated avatars/teto/teto_overrides.yaml (AVT-06, AVT-07) [Wave 1]
- [x] 04-01-PLAN.md — VTS infrastructure: PyvtsSafeWriter (issue #51 mitigation) + ParamID resolver + DiscreteDispatcher + VTS handshake + DPI awareness + ParamFrame/DiscreteEvent contracts (AVT-04, AVT-05, AVT-09, AVT-02 partial) [Wave 1]
- [x] 04-02-PLAN.md — Compositor core: 60Hz deadline scheduler + idle/intent/speech drivers + body-sway strategy registry (head_only/proxy_param/exp3_modulation) + dev-panel hot-switch + sentence-end signal (AVT-01, AVT-02, AVT-03, AVT-06 foundation, AVT-08) [Wave 2]
- [x] 04-03-PLAN.md — Cursor tracker (Win32-poll → ParamAngle deflection with 80px dead-zone + cubic ease-back) + DiscreteEvent demo target lock (Star Eye [7]) + sidecar lifespan integration (AVT-09 demo, AVT-10) [Wave 3 — depends on 04-02 ws/server.py edits]
- [x] 04-04-PLAN.md — Body-sway investigation execution + per-strategy evidence (operator-driven A/B via dev-panel hot-switch, RESEARCH §Open-Q2 closure, ship-default locked in teto_overrides.yaml) (AVT-06 execution) [Wave 3 — operator-driven, runs in parallel with 04-03]
- [x] 04-05-PLAN.md — Gap closure: replace expression hotkey-pop path with exp3-backed weighted ParamFrame set_params and no HotkeyTriggerRequest for expression intents (AVT-03, AVT-08) [Wave 1 gap]
- [x] 04-06-PLAN.md — Gap closure: lock AVT-10 to the accepted D-09/D-11 sidecar Win32 window-bounds + cursor-polling contract; no renderer overlay or renderer cursor WS path (AVT-10) [Wave 1 gap]
- [x] 04-07-PLAN.md — Gap closure: align SpeechDriver body_params runtime logs with plot_speech_evidence.py parser for Phase 5 live evidence re-runs (AVT-06) [Wave 1 gap]

**UI hint**: no  <!-- Cursor tracking is sidecar Win32 polling per D-09/D-11; renderer overlay work is explicitly deferred. -->

**Open questions to resolve at plan-time:**
- **Body-sway investigation scope** (AVT-06): minimum N strategy-pattern implementations tried on Teto before head-only fallback ships. Default: ≥2 (per AVT-06). Candidates: `head_only` (guaranteed fallback), `physics_chain` (OLVT IN-twin reference, known broken on Teto, kept as runnable evidence), `exp3_modulation` (new — modulating an `.exp3.json` body-pose expression's strength curves by RMS), `proxy_param` (smoke-pass-discovered non-orphan body param). The strategy registry pattern means the investigation produces *runnable evidence* not prose footnotes — this satisfies the "investigation IS the deliverable" framing.
- **Smoke-pass timing**: confirmed as 04-00 entry-gate (the very first task of Phase 4) per planning-time decision. Rejected alternative: running concurrently during Phase 3 TTS work.

**Cross-phase note on PLUMB-05**: pyvts is *vendored* in Phase 1 (PLUMB-05) but only *exercised* here in Phase 4. The single-writer-task wrapper that prevents pyvts issue #51 deadlock is implemented in 04-01 — Phase 1's PLUMB-05 deliverable is the vendor checkout + import, not the wrapper. Plan-time check: confirm Phase 1's PLUMB-05 closed before Phase 4 starts.

### Phase 5: Polish, Contracts Codegen (scope reduced 2026-05-08)
**Goal**: Land the codegen pipeline that closes SC-02. Pivot decision 2026-05-08: §14 verification ceremony (originally 05-02) is **dropped** because the animation layer Phase 4 produced is being refactored in Milestone 2 (see `PROJECT_DESIGN.md` §14B), making formal verification of the about-to-be-rebuilt animation behavior wasted effort. Codegen infrastructure (05-01) stays — milestone-2 will add several new contracts (BodyMotionPlugin ABC, plugin manifest, HUD-mode IPC envelope), and the codegen pipeline pays compound returns there.
**Depends on**: Phase 4
**Requirements**: SC-02 (SC-01 deferred — see note below)
**Success Criteria** (what must be TRUE):
  1. `packages/contracts/codegen.sh` runs successfully on a clean clone and regenerates the six TS files at `packages/contracts/ts/*.ts` from Pydantic source
  2. `npm run check:contracts` passes (drift guard: regenerate + `git diff --exit-code`)
  3. Renderer typechecks (`tsc --noEmit`) cleanly against generated TS
**Plans**: 1 plan (was 2; 05-02 deferred to Milestone 2 close)

Plans:
- [x] 05-01-PLAN.md — Hand-rolled Pydantic -> JSON Schema -> TS codegen pipeline replacing six packages/contracts/ts/*.ts files (SC-02)
- ~~05-02-PLAN.md~~ — **Deferred**: skeleton-verification.md ceremony does not justify itself when the verified animation layer is being refactored. The 5 PITFALLS plumbing tests it would have run (token-boundary, DeepSeek-R1, VTS auth-reprompt, port-collision, OLVT protocol diff) are absorbed into Milestone-2 phase plans where they regression-test against ongoing changes. SC-01 re-emerges as the milestone-2 close criterion (final §14 verification under refactored architecture). Original plan preserved as `05-02-PLAN.md.deferred-m2-pivot` for future reference.

**Note on SC-01:** SC-01 ("six §14 SCs formally verified in skeleton-verification.md") is **not abandoned** — it migrates to Milestone 2 Phase 10's exit criterion. The verification will be performed once the animation layer is refactored, capturing the architecture that ships rather than the architecture being torn out.

## v2.0 Phases

### Overview (v2.0)

Five additional phases (6, 7, 8, 9, 10) refactoring the milestone-1 animation layer from compositor-internal to plugin-driven, formalizing a three-category LLM emit code system (`[action]` / `{variant}` / `<event>`), adding a user-facing avatar import flow with mandatory review screen, exposing a slider HUD with per-param locks for parameter discovery, and re-running the §14 success-criteria ceremony against the refactored architecture (the SC-01 milestone-1 deferred). Source: `PROJECT_DESIGN.md` §14B + `.planning/research/v2.0/SUMMARY.md`.

**Execution order: 8 → 6 → 7 → 9 → 10 (REVISED 2026-05-08).** Originally locked as 6 → 8 → 7 → 9 → 10 (research-recommended) but swapped to 8 → 6 after analysis showed Phase 6's RigCapabilities + AvatarOverrides contracts depend on data Phase 8 produces (import-time introspection + variant/event/emotion-binding catalog separation). With Phase 8 first, Phase 6's plugin runtime builds against the cleaner schema instead of compatibility-shimming the milestone-1 flat `expressions` list. Phase 8 is the largest phase (1.5–2 weeks) and putting it first delays plug-and-play deliverables, but the contract-cleanliness gain is judged worth it.

**Granularity:** coarse (5 phases — 53 v2.0 requirements partitioned across distinct delivery boundaries: catalogs → plugin runtime → parser → HUD → verification). Phase 6 carries 5 critical pitfalls and is recommended to run an internal plumbing-week sub-phase that lands ABC + manifest + supervisor + clamp + rate-limiter + writer-pattern + side-by-side baseline harness BEFORE the default-plugin behavior gets debugged.

### v2.0 Phases Summary

- [x] **Phase 8: Avatar Import + Catalogs** — Type-detected auto-extraction (VTS / Cubism w-exp / Cubism bare / OLVT) + mandatory React review screen + `_avatar_overrides.yaml` writes + `RigCapabilities` + `AvatarOverrides` contract definition — **first in execution order (REVISED — produces schema Phase 6 builds against)** (2026-05-08)
- [x] **Phase 6: Plugin Runtime + Default Plugin** — Plugin contracts (ABC, manifest), in-sidecar loader with supervisor + clamp + rate-limiter, default plugin absorbing milestone-1 IntentDriver + body-sway logic; consumes Phase 8's `RigCapabilities` + `AvatarOverrides` — **second in execution order** *(2026-05-08 PM passed re_verification_4 after 06-08 corrected active Teto joy vocabulary; 06-07 closed ARCH-05/06 split-writer violation + tracking-range fix closed F-3)*
- [x] **Phase 7: Three-Category Code Parsing + Dispatch** — `code_extractor` decorator dispatching `[xxx]` / `{xxx}` / `<xxx>` to plugin / variant-toggle / event-fire paths — third in execution order; complete after 07-08 prompt-catalog gap closure and live `{heart-eye}` UAT confirmation
- [x] **Phase 9: Slider HUD + Per-Param Lock** — Sidecar 15 Hz HUD-mode IPC tap + dedicated React route + per-param lock with auto-engage on drag — fourth in execution order (2026-05-09)
- [ ] **Phase 10: Cursor Fix + §14 SC Re-Verification** — Mandatory cursor namespace fix (per 2026-05-08 discuss-phase amendment) + drop in-VTS-window gate + synthetic-canvas fallback + side-by-side §14 SC harness replay (lipsync + idle) + operator ceremony for SC #2 [smirk] / SC #4 body sway / SC #5 cursor + skeleton-verification.md commit — last in execution order; 4 plans including gap closure for SC2-SMIRK-RENDERING and SC5-EYE-TRACKING

### Phase 6: Plugin Runtime + Default Plugin
**Goal**: The animation layer becomes plug-and-play. A developer can swap the body-motion strategy by changing one config line, restarting the sidecar, and observing the avatar move differently — without touching idle / lipsync / cursor / pyvts-writer code. The default plugin ships with the system and absorbs the milestone-1 `IntentDriver` + `compositor/body_sway/*` logic. As of 06-08, the active imported Teto catalog is strict: `joy` is obsolete/invalid and absent, so declared default-plugin actions such as `[smirk]` cover ParamFrame ramp behavior while model-owned variants such as `heart-eye` are deferred to Phase 7 `{variant}` dispatch.
**Depends on**: Phase 8 (`RigCapabilities` + `AvatarOverrides` contracts; `_avatar_overrides.yaml` schema with explicit variant/event/emotion-binding catalogs) + Milestone-1 Phase 4 + Phase 5 (compositor + codegen pipeline)
**Requirements**: PLG-01, PLG-02, PLG-03, PLG-04, PLG-05, PLG-06, PLG-07, PLG-08, PLG-09, PLG-10, ARCH-01, ARCH-03, ARCH-04, ARCH-05, ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10, ARCH-11, ARCH-12 *(ARCH-02 moved to Phase 8 — Phase 6 consumes the contract Phase 8 defines)*
**Success Criteria** (what must be TRUE):
  1. Developer changes the active-plugin name in config-file, restarts the sidecar, and the avatar's body-motion behavior visibly changes — without editing idle / lipsync / cursor / pyvts-writer source
  2. With the default plugin loaded, an LLM reply containing a declared action such as `[smirk]` produces a smooth ParamFrame ramp with ~300ms ramp-in / ~600ms ramp-out timing; forcing obsolete `[joy]` is ignored safely because active Teto does not own that variant/expression. Model-owned visual variants such as `heart-eye` are Phase 7 `{variant}` dispatch work.
  3. A deliberately broken plugin (raises in `__init__` / blocks 30s in `on_load` / yields `NaN` ParamFrames / declares a reserved-name action code) fails loud with a clear log line and falls back to a null plugin emitting rest-state ParamFrames at 60 Hz; the sidecar process does NOT crash and AVT-02's 1-second re-injection rule is preserved
  4. CI grep-test confirms exactly one `import pyvts` in `sidecar/src/` (the `PyvtsSafeWriter` file); plugin code cannot import or instantiate pyvts directly
  5. System prompt assembled from plugin's `action_codes` is bytes-identical across two consecutive boots with the same plugin (KV-cache prefix-stability per milestone-1 D-17); switching plugins requires sidecar restart (no mid-conversation rebuild)
**Plans**: 8 plans (3 original + 5 gap closures; original "3 plans" structure REVISED from ~2 per Phase 6 discuss-phase Area 2 decision; gap closures 06-04/05/06 landed 2026-05-08 AM; 06-07 added 2026-05-08 PM after post-verification F-1/F-2 — split mouth writer violates ARCH-05/06; 06-08 added 2026-05-08 PM after operator UAT diagnosed obsolete `joy` vocabulary mismatching the active Teto catalog)

Plans:
- [x] 06-01-PLAN.md — **Contracts**: `BodyMotionPlugin` ABC (`api.py`, `api_version: "1.0"` enum) + `PluginManifest` Pydantic (`manifest.py`) + jsonschema 4.26.0 manifest validator + reserved-name guard + manifest loader + `clamp_and_validate(frame, capabilities)` boundary stage + system-prompt action-code section assembly (per-action one-line-with-description format, code-key lex-sorted, KV-cache prefix-stable). Phase 6 SC #5 closes here; sidecar boots with null plugin if loader fails.
- [x] 06-02-PLAN.md — **Plumbing surgery**: supervisor (5s `on_load` timeout, async-gen task with 60s/3-restart circuit breaker, null-plugin fallback) + `PluginAdapter(TickDriver)` with coalescing rate-limiter + hold-last-frame on under-rate + `IntentDriver` DELETE + `compositor/body_sway/*` MOVE → `plugins/default/body_sway/` + `compositor.py` merge order rewrite per ARCH-05 + `ws/server.py` lifespan rewire (capabilities → RigCapabilities + plugin loader) + `actions_extractor` decoupling + `live2d_expression_prompt.txt` template adjustment + CI `import pyvts` grep == 1 + plumbing-week harness (lipsync RMS Pearson correlation + idle micro-motion variance saturation; cursor + WS-shape SCs OUT OF SCOPE for harness — verified separately in M1 Phase 1+2). Phase 6 SC #1, #3, #4 close here; `[joy]` still inactive (plugin is null).
- [x] 06-03-PLAN.md — **Default plugin port**: `plugins/default/__init__.py` (DefaultPlugin class via file-path loader; no pip install required, exploratory-phase audience model per project memory) + Phase 6 action codes with descriptions in `plugin.yaml` + plugin-internal split-token-safe bracket-walker (mirrors M1 SC #3 BLOCKER fix pattern) + `[anger]/[disgust]/[fear]/[neutral]/[sadness]/[smirk]/[surprise]` ParamFrame compositions (head/eye/face params only; zero exp3 dependency per Phase 8 D-A2-2) + body_sway strategy migration (head_only is the only selectable strategy per Phase 6 Area 3 decision; proxy_param + exp3_modulation files preserved as experimental, not registry-selectable; AvatarOverrides.body_sway_strategy field remains but accepts only `head_only` value at load time) + `on_load(capabilities: RigCapabilities, overrides: AvatarOverrides)` two-arg signature reading sign_inversions / writable_param_ids from capabilities, body_sway_strategy / proxy_body_param / param_probes from overrides. 06-08 superseded the original OLVT `joy` carry-forward because active Teto does not own that variant/expression.
- [x] 06-04-PLAN.md — **Gap closure: plugin sentence-text routing**: `Orchestrator.turn()` routes plugin-visible sentence text through `SentenceOutput.plugin_text` while display + TTS outputs remain bracket-stripped; DefaultPlugin owns action parsing (system does not emit plugin actions as VTS writes / exp3 activations); declared actions route to adapter ticks and ParamFrame ramps. Closes PLG-07, ARCH-01, ARCH-03, ARCH-04 sentence-routing path. (Wave 4)
- [x] 06-05-PLAN.md — **Gap closure: production manifest watcher**: `watchdog`-backed file watcher observes the active plugin's `plugin.yaml` after sidecar boot, triggers manifest re-parse + WARN log on change without reloading behavior (PLG-10) + plugin discovery precedence respects `userData/plugins/` overlay (PLG-09) + KV-cache prefix-stability preserved across re-parse (ARCH-09). (Wave 4)
- [x] 06-06-PLAN.md — **Gap closure: supervised render proxy**: `PluginSupervisor.render_frame(now)` safely proxies render-capable wrapped plugins, returning empty ParamFrame for missing-hook / circuit-open / failure cases; production-style `PluginAdapter(PluginSupervisor(DefaultPlugin))` receives declared actions such as `[smirk]`, emits nonzero timed params at +150ms / +300ms, decays by +950ms (regression test added). (Wave 5; depends on 06-04 + 06-05)
- [x] 06-07-PLAN.md — **Gap closure: writer consolidation (ARCH-05/06 enforcement)**: DELETED `vts/speech_mouth_driver.py` + `vts/parameter_writer.py` (separate VTS plugin identity for lipsync, M1 leftover not consolidated by 06-02) + flipped `SpeechDriver.emit_mouth=True` (flag removed entirely) so MouthOpen flows through compositor → single `PyvtsSafeWriter` per ARCH-05 merge order + removed `mouth_speech_queue` and `mouth_task` from `ws/server.py` lifespan + new CI test `test_arch06_single_writer.py` asserts `requestSetParameterValue` / `requestInjectParameterData` / `plugin_name` ownership stays in `pyvts_writer.py` only. Closed F-1 + F-2 in re_verification_2 (2026-05-08T18:09Z). F-3 closed by follow-on commits 946abd7 (lateral head_only sway) + 4e2ff12 (preserve VTS tracking input ranges) in re_verification_3 (2026-05-08T18:35Z). (Wave 6)
- [x] 06-08-PLAN.md — **Gap closure: active Teto joy vocabulary correction**: removed obsolete `joy` from default plugin manifest/runtime/prompt semantics; added active Teto catalog regression proving `heart-eye`/`star-eye` exist while `joy` is absent; forced direct or split-token `[joy]` is ignored safely with no active action/nonzero ParamFrame; Phase 6 UAT now defers model-owned variants such as `heart-eye` to Phase 7 `{variant}` dispatch. (Wave 7)

**UI hint**: no  <!-- Plugin runtime is sidecar-internal; no renderer surface in this phase. -->

**Open questions to resolve at plan-time:**
- **Reserved-name list completeness sweep**: PLG-06 lists `<think>`, `<thinking>`, `<tool_call>`, `<function_call>`, `<function_calls>`, `<invoke>`, `<parameter>` as the floor. Plan-time research extends to any additional Anthropic / Gemini / OpenAI o-series sentinels.
- **`RigCapabilities` shape**: shared with Phase 9 HUD via `GET /admin/rig-capabilities`. Design needs single-source-of-truth definition here; Phase 9 consumes.
- **Plugin API versioning policy** (ARCH-11): `api_version: "1.0"` floor. Plan-time decides the major-version-bump rule and the migration path for the default plugin.

### Phase 8: Avatar Import + Catalogs
**Goal**: A user can import a new avatar via the Electron file dialog, walk through a mandatory review screen (NOT modal — dedicated React route), edit auto-extracted variant + event names away from placeholders (`exp_01` → `smile`), and commit a working `_avatar_overrides.yaml` that Phase 7's parser will validate against. OLVT `model_dict.json` drop-in works; mandatory Save-disabled friction prevents placeholder commits. **Phase 8 also defines the `RigCapabilities` + `AvatarOverrides` Pydantic contracts** (ARCH-02) since this phase produces the data they hold and runs first in v2.0 execution order — Phase 6 plugin runtime + Phase 9 HUD both consume them.
**Depends on**: Milestone-1 Phase 4 (avatar.yaml + teto_overrides.yaml are the upgrade source) + Phase 5 (codegen pipeline)
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-07, IMP-08, IMP-09, IMP-10, ARCH-02 *(ARCH-02 added — `RigCapabilities` contract definition moved here from Phase 6 because Phase 8 produces the data and now executes first)*
**Success Criteria** (what must be TRUE):
  1. User imports a VTS-shape avatar via file dialog; sidecar auto-detects type, parses `*.vtube.json` `Hotkeys[]` filtered to `Action: "ToggleExpression"`, derives variant codes (strip `[N]` keybind suffix and `【】` decorations, lowercase, hyphenate), and presents the draft catalog on a dedicated React route
  2. User imports a Cubism-with-expressions avatar; `model3.json` `FileReferences.Expressions[].Name` produces placeholder names; review screen REQUIRES user to relabel placeholders before Save is enabled (placeholder-density friction prevents `exp_01` from reaching the YAML)
  3. User imports an OLVT-shape avatar with `model_dict.json`; `emotionMap` becomes default-plugin per-rig action-code → expression binding, `actionMap` becomes the variant catalog with semantic names (no placeholder relabeling required)
  4. Review screen is re-openable from Settings at any time for catalog re-edit; commits write `_avatar_overrides.yaml` (sibling to `avatar.yaml`); writes are jsonschema-validated at write-time
  5. VTS API introspection smoke-test (`sidecar/scripts/vts_introspect_smoke.py`) confirms `pyvts 0.3.3` produces expected fields against the actual Teto rig — pyvts vendor-patch lands here if introspection fails
**Plans**: 5 plans

Plans:
- [x] 08-01-PLAN.md — Wave 0 test scaffolds + Pydantic contracts (RigCapabilities, AvatarOverrides, VariantEntry, EventEntry, AvatarImportPlan) + 4 extractors (VTS / Cubism w-exp / Cubism bare / OLVT) + naming-normalization (verified against 15 Teto names) + motion3 meta + cdi3 reader + IMP-09 TetoOverrides→AvatarOverrides rename + IMP-10 vts_introspect_smoke.py — Wave 1 (IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-09, IMP-10, ARCH-02)
- [x] 08-02-PLAN.md — Type detector (5-shape ladder + Cubism 5.3 moc3 header check) + atomic overrides_writer (.tmp → fsync → os.replace, jsonschema pre-validate) + sidecar admin/avatar.py FastAPI router (POST /import + /import/commit + GET /import/current) + Electron IPC handlers (avatar:pickFolder, avatar:requestImportPlan, avatar:commitOverrides) + 5 hand-written TS contract mirrors — Wave 2 (IMP-01, IMP-08)
- [x] 08-03-PLAN.md — Dedicated React AvatarImport route (single-page scrollable per D-A3-1, NOT modal) + VariantTable/EventTable with 4 per-row controls + usePlaceholderGate (^exp_?\d+$/i regex) + Save-disabled friction with scroll-to-first-placeholder UX + AppShell + route-store wiring + Settings "Edit avatar catalogs" entrypoint + Cubism 5.3 reject UX + 9+ vitest assertions — Wave 3 (IMP-07)
- [x] 08-04-PLAN.md — Gap closure: add DefaultPluginActionBinding contracts, default_plugin_action_bindings fields, generated TS/schema output, and sidecar avatar_overrides schema support — Wave 4 (IMP-05, IMP-09, ARCH-02)
- [x] 08-05-PLAN.md — Gap closure: fix app-managed override save path, bottom-of-page Save/Cancel controls, VTS smoke stable auth/fail-fast behavior, then rerun Teto native-dialog dogfood and VTS PASS/BLOCKED evidence — Wave 5 (IMP-05, IMP-08, IMP-09, IMP-10, ARCH-02)

**UI hint**: yes  <!-- Dedicated React route for the review screen; multi-row catalog editor is core UI surface. -->

**Open questions to resolve at plan-time:**
- **OLVT `model_dict.json` schema commit-pin** — pin to a specific OLVT commit at design time and document
- **Real-rig sample collection** — gather 5+ community Cubism / VTS rigs to harden the `.vtube.json` parser against undocumented field-shape variation (Teto + Hiyori + Mark + 2 community models)
- **Catalog naming-normalization regex inventory** — exact regex set to handle `[N] 笑顔【明るい】`-style decorations, validated against the sample rigs

### Phase 7: Three-Category Code Parsing + Dispatch
**Goal**: The LLM can emit `[joy] {hold-mic} <wave>` in a single sentence and three distinct dispatch paths fire — action codes feed the active plugin's input queue, variant codes radio-button-toggle a VTS hotkey via `PyvtsSafeWriter`, event codes fire a VTS motion hotkey with `motion3.json.Meta.Duration + 1s blend pad` auto-completion. Reserved-name guard blocks LLM-protocol sentinels; cross-category uniqueness check fails loud at boot when manufactured collisions are introduced.
**Depends on**: Phase 8 (variant/event catalogs feed parser validation) + Phase 6 (default plugin is the action-code consumer)
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, PARSE-08
**Success Criteria** (what must be TRUE):
  1. LLM reply containing `[joy] {hold-mic} <wave>` in a single sentence triggers all three dispatch paths in correct order — `joy` action reaches the plugin's input queue, `hold-mic` toggles the registered VTS expression hotkey via `PyvtsSafeWriter`, `wave` fires the registered motion hotkey with auto-completion timeout from `motion3.json.Meta.Duration + 1s` blend pad
  2. Adversarial split-token-boundary test fixtures pass for ALL three syntaxes — `[`/`joy]` → ActionCode, `{`/`hold-mic}` → VariantToggle, `<`/`wave>` → EventFire (extends the milestone-1 SC #3 BLOCKER fix to `{` and `<`)
  3. Cross-category collision check: at sidecar boot, `plugin_action_codes ∩ variant_codes ∩ event_codes` is empty; a manufactured collision (e.g., adding `joy` to the variant catalog while the plugin already registers `[joy]`) produces a loud boot-blocking exception with a clear error message naming both sources
  4. Variant collision policy is radio-button single-active — emitting a new variant code while another variant is already toggled turns the new ON and the previous OFF deterministically (no additive layering); chat display + TTS strips all three syntaxes cleanly (no bracket character ever leaks)
  5. Parser policy is load-bearing and verified per Phase 7 CONTEXT D-A1: no parse-time `<think>` strip is added; API-level reasoning disable remains the defense, `<think>` is reserved at boot, and leaked `<think>` is treated as an unknown event dispatch rather than a valid `<event>` code.
**Plans**: 8 plans

Plans:
- [x] 07-01-PLAN.md — Python Dispatch contract, EventEntry hotkey_id, VTS event extraction, and Python output model updates
- [x] 07-02-PLAN.md — Generated Dispatch/EventEntry/AudioPayload TS and JSON Schema mirrors with ActionIntent mirrors removed
- [x] 07-03-PLAN.md — `code_extractor`, all-syntax chat/TTS stripping, no parse-time think strip, and adversarial split-token fixtures
- [x] 07-04-PLAN.md — Reserved-name and cross-category validation module with parser tests
- [x] 07-05-PLAN.md — VariantStateManager and EventCompletionTracker with radio-button and duration-pad tests
- [x] 07-06-PLAN.md — Runtime Dispatch routing, including active PluginAdapter/plugin ActionCode delivery and TTS payload dispatches
- [x] 07-07-PLAN.md — Boot validation/runtime manager wiring, shutdown cleanup, pyvts import guard, and `[DISPATCH]` renderer logs
- [x] 07-08-PLAN.md — Gap closure: expose active variant/event codes in the runtime prompt and gate live event UAT on an event-bearing avatar catalog

**UI hint**: no  <!-- Parser + dispatch lives in sidecar; renderer changes are limited to bracket-strip continuation, no new UI surface. -->

**Open questions to resolve at plan-time:**
- **Reserved-name list re-verification** — re-run the sweep started in Phase 6 against the latest LLM-protocol conventions before locking the guard
- **Hotkey registration timing** — Phase 8 import flow registers each motion as a VTS hotkey; Phase 7 dispatch consumes the registered `hotkey_id`. Validate that re-imported avatars re-bind cleanly without orphan hotkey IDs

### Phase 9: Slider HUD + Per-Param Lock
**Goal**: A user opens the HUD via Settings → "Open HUD" (a separate Electron BrowserWindow, not a tab in the main shell), sees a scrollable list of writable rig params (excluding system-primitive-owned params like `MouthOpen`), drags any slider, watches the lock auto-engage, and the locked value holds through `{variant}` / `<event>` activity until the user manually clicks unlock. HUD-mode IPC channel (`/hud/ws`) is inactive when the HUD window is closed (preserves AVT-01's "renderer never sees 60 Hz traffic" rule for non-HUD operation).
**Depends on**: Phase 6 (`RigCapabilities` contract; plugin output flowing through compositor) + Phase 7 (dispatch routes — HUD lock integrates cleanly with variant/event writes via compositor 60Hz re-injection) + Phase 8 (`RigCapabilities` populated from import-time introspection)
**Requirements**: HUD-01, HUD-02, HUD-03, HUD-04, HUD-05, HUD-06, HUD-07, HUD-08
**Success Criteria** (what must be TRUE):
  1. User opens the HUD via Settings → "Open HUD"; a separate BrowserWindow loads the HUD route; renderer fetches `GET /admin/rig-capabilities`; populates a scrollable list of writable param IDs from `RigCapabilities.writable_param_ids` MINUS any ID present in `compositor/lock_filter.py:SYSTEM_PRIMITIVE_OVERRIDES` (currently `MouthOpen`); sidecar opens `/hud/ws` only on HUD-window mount, closes on unmount
  2. User drags any slider; lock auto-engages renderer-side optimistically; `set-lock(param_id, value)` over `/hud/ws` reaches the sidecar; sidecar confirms within the next 15 Hz frame; the locked param value persists in `compositor.lock_state` (sidecar single-source-of-truth) and the compositor merge applies the lock LAST in merge order; lock holds even when LLM-driven `{variant}` / `<event>` would otherwise drive that param (60Hz re-injection wins)
  3. User locks any non-system-primitive param; lock persists until user clicks the lock toggle off (releasing the slider does NOT release the lock); control returns to the compositor on unlock
  4. App restart clears all lock state (session-only persistence — locks are a discovery tool, not a persistent preference); re-importing an avatar mid-session also clears all lock state and shows a toast
  5. `MouthOpen` (and any future `SYSTEM_PRIMITIVE_OVERRIDES` entry) does NOT appear in the HUD list under any circumstance — verified by an automated test that boots a default rig and asserts the HUD payload excludes the dict's keys (resolver-mapped to Cubism names where applicable)
**Plans**: 2 plans (planned 2026-05-08)

Plans:
- [x] 09-01-PLAN.md — Sidecar HUD foundation: HudMessage{S2C,C2S} Pydantic contracts + Phase 7 codegen integration; `compositor/hud_tap.py` 15 Hz fanout; Compositor lock_state dict + locks-LAST merge with SYSTEM_PRIMITIVE_OVERRIDES defense-in-depth; `hud_excluded_param_ids` resolver-mapped helper in lock_filter.py; `/hud/ws` FastAPI endpoint with set-lock/clear-lock handlers; `GET /admin/rig-capabilities` HTTP endpoint with sidecar-derived hud_excluded_param_ids — covers HUD-01, HUD-02, HUD-05, HUD-06, HUD-07, HUD-08
- [x] 09-02-PLAN.md — Renderer HUD UI: Electron multi-BrowserWindow factory (`hud-window.ts`, ipc:hud:open, before-quit cleanup); App.tsx route hash branch (`#/hud`); `<HudRoot>` component tree with `useHudStream` hook (drag→set-lock optimistic, manual-disengage, 1.5s reconnect); native `<input type=range>` sliders bounded by RigCapabilities.param_ranges; Lock/Unlock SVG icons; HUD CSS section in index.css; Settings "Open HUD" button entry point; auto-clear-locks toast on locked_ids drop; live operator UAT — covers HUD-03, HUD-04

**UI hint**: yes  <!-- Dedicated React route mounted in a separate Electron BrowserWindow; multi-row scrollable param list with slider + lock toggle. NO override-badge (designed out by HUD-exclusion rule). -->

**Open questions to resolve at plan-time:**
- **HUD throttle exact rate** (HUD-02): 15 Hz proposed; 30 Hz fallback if 15 Hz looks stuttery on fast-changing params. Perceptual benchmark required.
- **Filter set for the param list** (writable / animating / locked): cheap to add; default to all-three filters
- **HUD-exclusion namespace resolution**: `SYSTEM_PRIMITIVE_OVERRIDES` is keyed by VTS tracking input names (`MouthOpen`); `RigCapabilities.writable_param_ids` carries Cubism names (`ParamMouthOpenY`). Plan-phase researcher confirms whether exclusion runs through `compositor/param_id_resolver.py`'s reverse mapping, or whether the dict is extended to carry both namespace forms. Decision logged in 09-01-PLAN.

### Phase 10: Cursor Polish + §14 SC Re-Verification
**Goal**: The §14 success-criteria ceremony deferred from milestone-1 (SC-01) lands here under the refactored architecture. All six §14 SCs are re-run against the running system, recorded in `.planning/skeleton-verification.md` with PASS / PARTIAL / FAIL verdicts. SC #2 ([joy] smooth blend) and SC #3 (body sway through utterance) are **operator-judged via human visual review** — NOT diffed against milestone-1 baselines (per 2026-05-08 Phase 6 discuss-phase decision: head_only ship state is mediocre and locking it as regression reference would punish future better implementations). The side-by-side comparison harness (built in Phase 6 plumbing-week 06-02) covers only the **automatable, mechanism-preserving** §14 SCs (lipsync RMS-correlation, idle micro-motion variance) — NOT SC #2 or SC #3. Cursor polish is OPTIONAL per VFY-01; the original §14 SC #4 (cursor tracking visible across the desktop) becomes a PARTIAL verdict with a documented future-direction rationale.
**Depends on**: Phase 9 (and transitively all v2.0 phases — verification re-run is by definition last)
**Requirements**: VFY-01, VFY-02, VFY-03, VFY-04, VFY-05
**Success Criteria** (what must be TRUE):
  1. `.planning/skeleton-verification.md` is committed with PASS / PARTIAL / FAIL verdicts for all six §14 SCs and concrete observations per SC; SC #2 (`[joy]` smooth fade) and SC #3 (body sway through the full utterance) verdicts come from operator visual review (Phase 10 ceremony script) — NOT from automated baseline diff
  2. Side-by-side §14 SC comparison harness (built in Phase 6 plumbing-week 06-02) replays current behavior against milestone-1 captured baselines for the automatable subset only — lipsync RMS-vs-MouthOpen Pearson correlation (≥0.7 threshold) + idle micro-motion non-zero variance on `ParamAngle{X,Y,Z}` / `ParamEyeOpen{L,R}` (defaults; tune at plan-time if baselines indicate). Tolerance bands ±100ms / ±0.05 only apply to these mechanism-preserved SCs
  3. If cursor polish lands (optional per VFY-01): in-VTS-window gate at `cursor_driver.py:27-28` is dropped; synthetic-canvas fallback projects against primary-monitor center when no VTS window is detected; cursor SC verdict upgrades from PARTIAL to PASS. If cursor polish does not land: cursor SC is recorded as PARTIAL with the documented future-direction rationale (later milestone may introduce native Cubism integration with better global cursor tracking)
  4. CI grep-test still confirms exactly one `import pyvts` in `sidecar/src/` (the writer); single pyvts writer rule per ARCH-06 carried through all v2.0 entry points
**Plans**: 4 plans (2 original + 2 gap-closure plans)

Plans:
- [x] 10-01-PLAN.md — Cursor diagnose + namespace fix + drop in-VTS-window gate + synthetic-canvas fallback + regression test (VFY-01, VFY-02). Wave 1, autonomous.
- [ ] 10-02-PLAN.md — §14 SC ceremony script + skeleton-verification.md commit + plumbing harness replay (lipsync + idle) + operator-judged SC #2 [smirk] / SC #4 body sway / SC #5 cursor verdicts + milestone v2.0 close decision (VFY-03, VFY-04, VFY-05). Wave 2, has checkpoint:human-verify task.
- [x] 10-03-PLAN.md — GAP: close SC2-SMIRK-RENDERING by making routed `ActionCode(name="smirk")` visibly activate the default plugin and rerunning SC #2 UAT. Wave 3, gap_closure. Completed 2026-05-09.
- [ ] 10-04-PLAN.md — GAP: close SC5-EYE-TRACKING by fixing cursor eye routing/tuning and rerunning SC #5 UAT. Wave 4, gap_closure.

**UI hint**: no  <!-- Verification ceremony is observational; cursor polish is sidecar-only. -->

**Open questions to resolve at plan-time:**
- **§14 SC tolerance bands** (VFY-05): defaults are ±100ms latency, ±0.05 param values — apply ONLY to lipsync + idle harness checks (SC #2 / SC #3 are operator-judged; no tolerance bands)
- **Cursor polish optional/required** (VFY-01): defaults to optional. Re-evaluate at plan-time based on whether the milestone-1 in-VTS-window gate proved limiting in user testing during Phases 6–9
- **Phase 10 operator ceremony script for SC #2 / SC #3** — define the canned LLM prompts that elicit `[joy]` and a long-utterance reply, the visual-quality checklist (smooth fade onset visible? decay visible? body motion not jerky?), and the PASS / PARTIAL / FAIL decision rubric per 2026-05-08 Phase 6 discuss-phase decision (operator-judged, no JSON baseline)

## Progress

**Execution Order:**
Milestone-1 phases execute in numeric order: 1 → 2 → 3 → 4 → 5
Milestone v2.0 phases execute in REVISED order: 8 → 6 → 7 → 9 → 10 (revised 2026-05-08; Phase 8 first to define `RigCapabilities` + `AvatarOverrides` contracts before Phase 6 plugin runtime consumes them)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plumbing & Process Lifecycle | 2/2 | Complete | 2026-05-07 |
| 2. Conversation Pipeline | 3/3 | Complete | 2026-05-07 |
| 3. TTS & Sentence-Buffered Audio | 3/3 | Complete | 2026-05-07 |
| 4. Action Compositor + VTS Bridge + Body-Sway Investigation | 8/8 | Complete | 2026-05-08 |
| 5. Polish, Contracts Codegen (scope reduced) | 1/1 | Complete — 05-02 deferred to M2 | 2026-05-08 |
| 8. Avatar Import + Catalogs | 5/5 | Complete — VERIFICATION passed 5/5 must-haves | 2026-05-08 |
| 6. Plugin Runtime + Default Plugin | 8/8 | Complete — re_verification_4 passed; F-1/F-2 closed by 06-07 writer consolidation; F-3 closed by tracking-range fix; joy vocabulary gap closed by 06-08 | 2026-05-08 |
| 7. Three-Category Code Parsing + Dispatch | 8/8 | Complete — 07-08 gap closure exposed active dispatch codes in prompt; live `{heart-eye}` variant confirmed; event UAT prerequisite-gated by current Teto `events: []` | 2026-05-09 |
| 9. Slider HUD + Per-Param Lock | 2/2 | Complete — live HUD UAT approved after visible-param and stream-liveness fixes | 2026-05-09 |
| 10. Cursor Polish + §14 SC Re-Verification | 1/2 | In Progress|  |

## Coverage

**v1 requirements:** 25 total
**v2.0 requirements:** 53 total
**Total mapped:** 78 / 78
**Unmapped:** 0
**Coverage:** 100%

| Requirement | Phase | Notes |
|-------------|-------|-------|
| PLUMB-01 | 1 | Electron+React+Vite+TS shell |
| PLUMB-02 | 1 | Python sidecar lifecycle (uv venv, watchdog, graceful shutdown) |
| PLUMB-03 | 1 | OLVT-shape WS envelope; port-allocation strategy decided here |
| PLUMB-04 | 1 | Mandatory LLM setup screen with real-completion test |
| PLUMB-05 | 1 | pyvts vendoring (single-writer wrapper consumed in Phase 4 — see cross-phase note above) |
| LLM-01 | 2 | LiteLLM + LM Studio + 120s timeout |
| LLM-02 | 2 | OLVT decorator chain (sentence_divider → actions_extractor → tts_filter) |
| LLM-03 | 2 | `<think>` strip at orchestrator input boundary |
| LLM-04 | 2 | Single in-memory thread, clears on relaunch |
| TTS-01 | 3 | piper backend + warmup synth |
| TTS-02 | 3 | Sentence-buffered parallel synth + ordered playback |
| TTS-03 | 3 | RMS feature tap (consumer contract for Phase 4 speech driver) |
| TTS-04 | 3 | Lipsync via our-RMS → `ParamMouthOpenY` |
| AVT-01 | 4 | 60 Hz compositor; sidecar→VTS direct, NOT through renderer |
| AVT-02 | 4 | Idle baseline + 1-second re-injection rule (rest-state continuous-write) |
| AVT-03 | 4 | `mode:"add"` for ambient/speech, `mode:"set"`+weight for intent |
| AVT-04 | 4 | pyvts single-writer task (issue #51 mitigation) |
| AVT-05 | 4 | Renderer-aware ParamID resolver (~30 LOC), non-VTS branch raises |
| AVT-06 | 4 | **Body-sway investigation — research-flavored, ≥2 strategies on Teto** |
| AVT-07 | 4 | `teto_overrides.yaml` schema stub (populated by smoke-pass in 04-00) |
| AVT-08 | 4 | `[joy]` 300ms smooth fade — §14 success criterion #2 (the headline demo) |
| AVT-09 | 4 | One DiscreteEvent prop hotkey |
| AVT-10 | 4 | Sidecar Win32 VTS-window cursor polling → eye/head tracking |
| SC-01 | 5 → 10 | Migrated: §14 verification ceremony deferred from Phase 5; lands as Phase 10's exit criterion under refactored architecture |
| SC-02 | 5 | Codegen replaces hand-written TS contracts |
| ARCH-01 | 6 | System owns LLM+VTS contracts; plugin owns motion contract; plugin MUST NOT call pyvts/FS/network directly |
| ARCH-02 | 8 | `RigCapabilities` rig-introspection contract — single source for plugin `on_load` AND HUD `GET /admin/rig-capabilities` (MOVED to Phase 8 with 2026-05-08 order swap; Phase 8 defines + populates, Phase 6 + 9 consume) |
| ARCH-03 | 6 | Plugin token-stream input is orchestrator-decorated (post-sentence_divider, pre-code_extractor) |
| ARCH-04 | 6 | Plugin output is `AsyncIterator[ParamFrame]` ≤ 60 Hz; `PluginAdapter(TickDriver)` buffers/holds-last-frame |
| ARCH-05 | 6 | Compositor merge order is fixed and load-bearing (Idle → Speech → Plugin → Cursor → primitive-overrides → lock_filter → clamp → pyvts) |
| ARCH-06 | 6 | Single pyvts writer rule extends to all v2.0 entry points; CI grep-enforced |
| ARCH-07 | 6 | Plugin process model: in-sidecar Python, no isolation, full trust (R-19) |
| ARCH-08 | 6 | Plugin discovery precedence: `userData/plugins/` overrides `plugins/` (in-tree) on name conflict |
| ARCH-09 | 6 | Plugin extends LLM emit vocabulary at orchestrator boot under fixed delimiter; KV-cache prefix-stable; no mid-conversation rebuild |
| ARCH-10 | 6 | Plugin runtime decoupled from milestone-1 compositor primitives; `IntentDriver` DELETED; logic migrates to default plugin |
| ARCH-11 | 6 | Plugin authoring API gated by `api_version: "1.0"` in manifest; major-version mismatch refuses load |
| ARCH-12 | 6 | System-primitive override list (currently `MouthOpenY` only) is explicit, per-param, code-reviewed — not a runtime knob |
| PLG-01 | 6 | Single-active body-motion plugin from `plugin.yaml`; manifest fields fixed |
| PLG-02 | 6 | Plugin `action_codes` (sorted deterministically) feed system-prompt assembly under fixed delimiter |
| PLG-03 | 6 | `BodyMotionPlugin` ABC with `on_load(capabilities)` / `on_token_stream(tokens) -> AsyncIterator[ParamFrame]` / `on_unload()` |
| PLG-04 | 6 | Async-gen lifecycle supervisor with circuit breaker (3 restarts/60s) → fall back to null plugin emitting rest-state at 60 Hz |
| PLG-05 | 6 | ParamFrame values clamped to `[0, 1]` at compositor → renderer boundary; NaN/Inf drops frame; unknown keys WARN |
| PLG-06 | 6 | Manifest jsonschema-validated; reserved-name guard rejects LLM-protocol sentinels (`<think>`, `<thinking>`, `<tool_call>`, `<function_call>`, `<function_calls>`, `<invoke>`, `<parameter>`) |
| PLG-07 | 6 | Default plugin ships in-tree (`plugins/default/`); absorbs `IntentDriver` + body-sway logic; current Phase 6 action vocabulary excludes active-Teto-invalid `joy` |
| PLG-08 | 6 | Plugin discovery scans `plugins/` (in-tree) + `userData/plugins/` (user-installed) |
| PLG-09 | 6 | Plugin switching is startup-only; runtime hot-swap deferred |
| PLG-10 | 6 | `plugin.yaml` hot-reload via `watchdog` triggers manifest re-parse + WARN log; does NOT reload behavior |
| IMP-01 | 8 | Electron `dialog.showOpenDialog()` + `ipc:avatar:import-pick` + sidecar type-detect (VTS / Cubism w-exp / Cubism bare / OLVT) |
| IMP-02 | 8 | VTS `.vtube.json` extractor — filter `Action: "ToggleExpression"`, strip `[N]` and `【】`, lowercase + hyphenate |
| IMP-03 | 8 | Cubism-with-expressions extractor — `model3.json` `FileReferences.Expressions[].Name` placeholders; mandatory relabel to enable Save |
| IMP-04 | 8 | Cubism-bare extractor — empty variant catalog; events still extractable from `.motion3.json` |
| IMP-05 | 8 | OLVT `model_dict.json` — `emotionMap` → default-plugin per-rig binding; `actionMap` → variant catalog (no relabel) |
| IMP-06 | 8 | Event catalog from `.motion3.json` — `Motions` group keys + filenames; slug rule (lowercase, hyphenate) |
| IMP-07 | 8 | Mandatory review screen — dedicated React route (NOT modal); placeholder-density Save-disabled friction |
| IMP-08 | 8 | Review screen re-openable from Settings; commits write `_avatar_overrides.yaml`; jsonschema-validated |
| IMP-09 | 8 | `TetoOverrides` → `AvatarOverrides` rename; `avatar.yaml` read-only; `_avatar_overrides.yaml` carries user edits |
| IMP-10 | 8 | VTS API introspection smoke-test (`vts_introspect_smoke.py`) validates pyvts 0.3.3 against actual Teto rig |
| PARSE-01 | 7 | `code_extractor` decorator replaces `actions_extractor`; single-pass bracket walker dispatches on opener char |
| PARSE-02 | 7 | `display_processor.filter_brackets` extends to all three syntaxes (chat + TTS) |
| PARSE-03 | 7 | Action → plugin queue; Variant → `PyvtsSafeWriter` toggle hotkey; Event → motion hotkey |
| PARSE-04 | 7 | `<think>` reasoning-strip runs FIRST (before sentence-buffer, before three-category extractor) |
| PARSE-05 | 7 | Variant collision policy: radio-button single-active (new ON, previous OFF) |
| PARSE-06 | 7 | Event auto-completion: `motion3.json.Meta.Duration + 1s blend pad`; 10s ceiling fallback for missing/oversized Duration |
| PARSE-07 | 7 | Cross-category uniqueness check at boot — empty-intersection enforced; loud failure on collision |
| PARSE-08 | 7 | Adversarial split-token reassembly tests for all three categories |
| HUD-01 | 9 | Dedicated `/hud/ws` WebSocket endpoint; opened only on HUD mount; closed on unmount |
| HUD-02 | 9 | Compositor 15 Hz throttle (sidecar-side gate); pushes ParamFrame deltas to `/hud/ws` |
| HUD-03 | 9 | Renderer scrollable list of writable params from `RigCapabilities` (name, value, slider, lock toggle) |
| HUD-04 | 9 | Slider drag → `set-lock(param_id, value)` over `/hud/ws`; renderer optimistic; sidecar single-source-of-truth |
| HUD-05 | 9 | Compositor merge applies locks LAST; system primitives (lipsync on `MouthOpenY`) override locks |
| HUD-06 | 9 | Override-badge surfaces on slider rows where a primitive overrode the lock |
| HUD-07 | 9 | Lock state session-only; cleared on app restart |
| HUD-08 | 9 | `GET /admin/rig-capabilities` HTTP endpoint for HUD's first-open population (synchronous fetch, not WS push) |
| VFY-01 | 10 | Cursor polish OPTIONAL; current sidecar-side capture stays; future-direction documented; SC #4 may be PARTIAL |
| VFY-02 | 10 | If cursor polish lands: drop in-VTS-window gate; add synthetic-canvas fallback; DPI/multi-monitor deferred |
| VFY-03 | 10 | All six §14 SCs re-run; SC #2 (`[joy]` blend) and SC #3 (body sway) are highest-risk regressions |
| VFY-04 | 10 | `.planning/skeleton-verification.md` committed with PASS/PARTIAL/FAIL per SC + concrete observations |
| VFY-05 | 10 | Side-by-side §14 SC comparison harness (built in Phase 6 plumbing-week) replays against milestone-1 baselines |

**No orphaned requirements. No requirement is duplicated across phases.**

**Cross-phase notes (v2.0):**
- ARCH-01..12 are cross-cutting architectural invariants. They are *primary-mapped* to Phase 6 (where the plugin contracts cement) but every subsequent phase (7, 8, 9, 10) must honor them. Violating any of them at a later phase is a regression of Phase 6's deliverables.
- ARCH-02 (`RigCapabilities` shape) is *defined* in Phase 6 and *consumed* in Phase 9 (HUD `GET /admin/rig-capabilities`). Phase 9 plan-phase confirms the Phase 6 shape is sufficient before HUD UI lands.
- ARCH-06 (single pyvts writer rule) is *introduced* in milestone-1 (AVT-04) and *extended* to plugin output, variant dispatch, event dispatch, HUD lock writes, and cursor frames in v2.0. CI grep-test runs in Phase 6's plumbing-week.
- VFY-05 (side-by-side baseline harness) is *built* in Phase 6's plumbing-week sub-phase and *consumed* in Phase 10's verification replay. Capturing milestone-1 baselines before any v2.0 behavior changes is the only way the SC #2 / SC #3 regression checks have a reference.

## Build-Order Constraints

These constraints are derived from the architecture research and must be honored during plan-phase decomposition.

### Milestone-1 build-order (1 → 2 → 3 → 4 → 5)

1. **Phase 1 → Phase 2**: WS protocol envelope and sidecar lifecycle must be solid before Phase 2 produces real LLM content. Fix the OLVT-shape envelope here; propagating it later is mechanical.
2. **Phase 2 → Phase 3**: Phase 2 uses **stub TTS** (text-to-stdout or silent audio) so the conversation pipeline is verifiable independently. Phase 3 swaps in real piper.
3. **Phase 3 → Phase 4**: Phase 3 must expose the real RMS feature tap (TTS-03) that Phase 4's speech driver consumes. No stubbing this — Phase 4 needs real envelopes from real synthesis.
4. **Phase 4 entry gate**: 04-00 (Teto smoke-pass) runs as the **first task of Phase 4**. The smoke-pass output (which body params are non-orphan / writable on the Teto rig) determines which speech-driver strategy is the shipping default and populates `teto_overrides.yaml`.
5. **Phase 5 prerequisites**: §14 verification (SC-01) requires Phases 1–4 deliverables present and demo-able on a clean clone. (SC-01 deferred 2026-05-08 — migrates to Phase 10.)

### Milestone v2.0 build-order (8 → 6 → 7 → 9 → 10 — REVISED 2026-05-08, NOT numeric)

1. **Phase 8 first (REVISED)**: Avatar import + catalogs land here, AND the `RigCapabilities` + `AvatarOverrides` Pydantic contracts get their canonical definitions (since Phase 8 produces the data they describe). Schema cleanliness for Phase 6's plugin contract is the swap rationale: Phase 6's `BodyMotionPlugin.on_load(capabilities)` would otherwise have to compatibility-shim against milestone-1's flat `expressions` list and the unsplit OLVT 8-emotion → expression mapping. Phase 8 also handles `TetoOverrides` → `AvatarOverrides` rename + variant/event/emotion-binding catalog separation. Largest phase (1.5–2 weeks); the swap accepts a delay before plug-and-play deliverables in exchange for contract correctness.
2. **Phase 6 second**: Plugin runtime (ABC, manifest, loader with reserved-name guard, supervisor, clamp, rate-limiter, `PluginAdapter`, system-prompt assembly with action-code section) cements against the contracts Phase 8 defined. Default plugin absorbs milestone-1 `IntentDriver` + body-sway logic; reads emotion-bindings from Phase 8's curated `_avatar_overrides.yaml` for Teto. Plumbing-week sub-phase lands the contract plumbing + side-by-side §14 SC baseline harness BEFORE default-plugin behavior gets debugged. Plumbing-week deliverables include the harness consumed by Phase 10.
3. **Phase 7 third**: Catalogs from Phase 8 are inputs; default plugin from Phase 6 is the action-code consumer. Least parallelizable phase (decorator chain is sequential by nature).
4. **Phase 9 fourth**: HUD lock-aware merge depends on plugin output (Phase 6) + variant/event dispatch (Phase 7) + `RigCapabilities` populated from import (Phase 8).
5. **Phase 10 last**: Verification re-run is by definition last. Side-by-side baselines from Phase 6's plumbing-week consumed here.

## Sequential vs Parallel Execution

`config.json` sets `parallelization: true`, but the architecture research explicitly recommends **sequential phase execution** within each milestone: each phase produces the contract that the next consumes. The dependency chain (echo round-trip → real LLM stream → real audio with RMS → compositor that consumes RMS → verification → plugin contracts → catalogs → parser → HUD → re-verification) is the validation order.

**Within phases**, plans can run in parallel where independent (e.g., milestone-1 04-01 single-writer wrapper and 04-03 cursor tracker overlay touch disjoint code paths; v2.0 Phase 8's four extractors are independent; Phase 9 sidecar HUD tap can land in parallel with the React HUD UI if a fixture is in place). The plan-phase workflow is the right place to identify intra-phase parallelism.

**Cross-phase parallelism (v2.0):**
- Phase 8 UI design (review screen layouts) can start during Phase 6 implementation
- Phase 9 HUD UI design can start during Phase 7 implementation
- Phase 10 cursor polish (if it lands) can land during Phase 9 — no `cursor_driver.py` touch in Phase 9

## Open Architectural Questions (Surfaced for Plan-Phase)

These are decisions that need resolution at plan-time, not implementation-time. Tracked here so plan-phase can pick them up.

### Milestone-1 plan-time decisions (1.x → 5.x)

1. **PLUMB-05 / Phase 1**: pyvts vendoring acceptability (default: vendor from day one)
2. **PLUMB-03 / Phase 1**: Port-allocation strategy — `port:0` ephemeral vs. fixed-port + handshake (default: `port:0`)
3. **SC-02 / Phase 5**: Codegen tool — `datamodel-code-generator` vs. `pydantic2ts` vs. hand-rolled (default: hand-rolled JSON Schema intermediate)
4. **LLM-03 / Phase 2 (cross-cutting)**: Reasoning-UI scope in skeleton — parser-strip-only vs. per-message expand chevron (default: parser-strip-only; chevron is UX-01 in v2)
5. **AVT-06 / Phase 4**: Body-sway investigation minimum N strategies before head-only fallback (default: ≥2 per AVT-06)

### Milestone v2.0 plan-time decisions (6.x → 10.x)

1. **Phase 6 / PLG-06**: Reserved-name list completeness sweep — extend the floor (`<think>`, `<thinking>`, `<tool_call>`, `<function_call>`, `<function_calls>`, `<invoke>`, `<parameter>`) with any additional Anthropic / Gemini / OpenAI o-series sentinels current as of plan-phase
2. **Phase 6 / ARCH-02**: `RigCapabilities` contract shape — fields, units, optional-vs-required — single-source-of-truth definition shared with Phase 9
3. **Phase 6 / ARCH-11**: Plugin API versioning policy — major-version-bump rule + default-plugin migration path
4. **Phase 8 / IMP-05**: OLVT `model_dict.json` schema commit-pin — pin to a specific OLVT commit at design time and document
5. **Phase 8 / IMP-02**: Real-rig sample collection — gather 5+ community Cubism / VTS rigs to harden the parser against undocumented field-shape variation
6. **Phase 8 / IMP-02**: Catalog naming-normalization regex inventory — exact regex set for `[N] 笑顔【明るい】`-style decorations
7. **Phase 7 / PARSE-07**: Reserved-name list re-verification before locking the guard
8. **Phase 7 / PARSE-03**: Hotkey registration timing — re-imported avatars must rebind cleanly without orphan hotkey IDs
9. **Phase 9 / HUD-02**: HUD throttle exact rate — 15 Hz proposed; perceptual benchmark required; 30 Hz fallback if stuttery
10. **Phase 9 / HUD-03**: HUD window behavior — floating + always-on-top recommended; confirm at plan-time
11. **Phase 9 / HUD-03**: Filter set for the param list — writable / animating / locked (recommend all three)
12. **Phase 10 / VFY-05**: §14 SC tolerance bands — defaults ±100ms latency, ±0.05 param values; tune when Phase 6 baselines land
13. **Phase 10 / VFY-01**: Cursor polish optional/required — defaults to optional; re-evaluate at plan-time

---
*Roadmap created: 2026-05-06*
*v2.0 phases appended: 2026-05-08*
*Granularity: coarse (4-6 phases target — milestone-1 landed at 5; v2.0 lands at 5)*
*Coverage: 78/78 requirements mapped (25 v1 + 53 v2.0), no orphans*
