# Roadmap: AgenticLLMVTuber — Walking Skeleton

## Overview

Five sequential phases that build the AgenticLLMVTuber walking skeleton end-to-end (PROJECT_DESIGN.md §14). Each phase's acceptance test is a **superset** of the previous phase — Phase 1 produces a typed echo round-trip; Phase 2 adds real LLM replies on top of that round-trip; Phase 3 adds spoken sentence-buffered audio; Phase 4 adds the 60 Hz multi-driver action compositor and VTS bridge (the unique value-add); Phase 5 closes the §14 success criteria with a formal verification record and replaces hand-written contracts with codegen. The skeleton validates the layered architecture (Electron + Python sidecar + VTS rendering + LiteLLM gateway + TTS pipeline + 60 Hz compositor) with one hardcoded avatar (Teto, dev-only), one in-memory chat thread, and companion mode only. Subsequent milestones (memory, agent, scheduler, skills, multi-thread, multi-avatar, pet mode) layer on top without rearchitecting.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Plumbing & Process Lifecycle** - Electron + sidecar + WS round-trip + LLM setup screen, no AI yet (2026-05-07)
- [ ] **Phase 2: Conversation Pipeline** - Real LLM replies streamed sentence-by-sentence with `[joy]` extracted, no audio
- [ ] **Phase 3: TTS & Sentence-Buffered Audio** - Avatar replies are spoken with our-RMS feature tap exposed
- [ ] **Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation** - 60 Hz blended drivers; Teto moves; smooth `[joy]` blend; cursor tracking
- [ ] **Phase 5: Polish, Contracts Codegen, §14 Verification** - All six §14 success criteria formally verified; codegen replaces hand-written TS

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
  4. Switching LM Studio to a DeepSeek-R1 distill: `<think>...</think>` content is captured to a side channel and never appears in the main chat stream or in extracted `ActionIntent`s
  5. Closing and relaunching the app starts a fresh empty in-memory thread (no persistence, no FTS5)
**Plans**: TBD

Plans:
- [x] 02-01-PLAN.md — LiteLLM streaming gateway + AvatarCapabilities loader + WSMessage/AudioPayload/ActionIntent contracts + Wave-0 reasoning-disable smoke (LLM-01)
- [x] 02-02-PLAN.md — OLVT 4-decorator chain port + Orchestrator (append-only memory, KV-cache discipline) + WS handler wiring + boot warmup ping (LLM-02, LLM-03, LLM-04)
- [ ] 02-03-PLAN.md — useStreamingMessages renderer reducer + WS dispatcher routing + LogsDrawer [INTENT] coloring + 4 new copy keys + ROADMAP SC#4 amendment (LLM-02, LLM-03)

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
**Plans**: TBD

Plans:
- [ ] 03-01: TBD — piper backend + RMS envelope + warmup (TTS-01, TTS-03, TTS-04)
- [ ] 03-02: TBD — TTSTaskManager (indexed-slot queue) + Web Audio playback (TTS-02)

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
**Plans**: TBD

Plans:
- [ ] 04-00: TBD — **Teto smoke-pass entry gate** (AVT-06 entry; AVT-07 stub schema). Run smoke-pass on the dev Teto rig; record non-orphan downstream body params (or absence thereof) and physics-chain proxy candidates into `avatars/teto/teto_overrides.yaml`. Outputs the input that 04-02 needs to pick a default speech-driver strategy.
- [ ] 04-01: TBD — pyvts single-writer task + ParamID resolver + rest-state continuous-write (AVT-01, AVT-04, AVT-05, AVT-09)
- [ ] 04-02: TBD — Compositor core + idle/intent/reaction drivers + speech-driver strategy registry + body-sway investigation (AVT-02, AVT-03, AVT-08, AVT-10, AVT-06 main work). **NEEDS RESEARCH-PHASE**: minimum 2 strategy implementations attempted on the Teto rig before head-only fallback ships.
- [ ] 04-03: TBD — Cursor tracker overlay + test hotkey + DiscreteEvent path (AVT-09 main work, AVT-10 renderer side)

**UI hint**: yes  <!-- Cursor tracker is a transparent React overlay; the avatar canvas region's UX is part of this phase -->

**Open questions to resolve at plan-time:**
- **Body-sway investigation scope** (AVT-06): minimum N strategy-pattern implementations tried on Teto before head-only fallback ships. Default: ≥2 (per AVT-06). Candidates: `head_only` (guaranteed fallback), `physics_chain` (OLVT IN-twin reference, known broken on Teto, kept as runnable evidence), `exp3_modulation` (new — modulating an `.exp3.json` body-pose expression's strength curves by RMS), `proxy_param` (smoke-pass-discovered non-orphan body param). The strategy registry pattern means the investigation produces *runnable evidence* not prose footnotes — this satisfies the "investigation IS the deliverable" framing.
- **Smoke-pass timing**: confirmed as 04-00 entry-gate (the very first task of Phase 4) per planning-time decision. Rejected alternative: running concurrently during Phase 3 TTS work.

**Cross-phase note on PLUMB-05**: pyvts is *vendored* in Phase 1 (PLUMB-05) but only *exercised* here in Phase 4. The single-writer-task wrapper that prevents pyvts issue #51 deadlock is implemented in 04-01 — Phase 1's PLUMB-05 deliverable is the vendor checkout + import, not the wrapper. Plan-time check: confirm Phase 1's PLUMB-05 closed before Phase 4 starts.

### Phase 5: Polish, Contracts Codegen, §14 Verification
**Goal**: Demo-able end-to-end run on a clean clone. The hand-written TS in `apps/renderer/src/types/control.ts` is replaced by codegen output (Pydantic → JSON Schema → TS). The body-sway investigation report is committed to `.planning/skeleton-verification.md`. All six §14 success criteria are formally verified against the running system and recorded in the handoff document.
**Depends on**: Phase 4
**Requirements**: SC-01, SC-02
**Success Criteria** (what must be TRUE):
  1. `.planning/skeleton-verification.md` exists and records pass/fail for all six §14 success criteria with concrete observations (text-reply with synced lipsync, `[joy]` smooth blend, idle micro-motion, speech-driven body/head sway, cursor tracking, OLVT-shape WS protocol diff)
  2. `packages/contracts/codegen.sh` runs successfully on a clean clone and produces TS types in `packages/contracts/generated/ts/control.ts` that the renderer imports without modification (replacing the hand-written mirror)
  3. The "Looks Done But Isn't" checklist from PITFALLS.md is run end-to-end with results recorded — adversarial `[joy]` token boundary test, DeepSeek-R1 reasoning smoke test, VTS auth-reprompt test, port-collision test, OLVT protocol-shape parity diff against OLVT's `_route_message()`
  4. The body-sway investigation report (committed under `.planning/skeleton-verification.md` or linked from it) documents which speech-driver strategies were tried, what was observed on Teto, and the rationale for the shipping default
  5. `avatars/teto/teto_overrides.yaml` is committed with the schema established (orphan-params list, physics-chain proxy slots, sign-inversion slots) and Teto-specific values populated from the Phase 4 smoke-pass
**Plans**: TBD

Plans:
- [ ] 05-01: TBD — Contracts codegen pipeline + TS-mirror replacement (SC-02). **30-minute spike**: choose between `datamodel-code-generator`, `pydantic2ts`, hand-rolled (Pydantic → `model_json_schema()` → `json-schema-to-typescript`). Recommended: hand-rolled JSON Schema intermediate.
- [ ] 05-02: TBD — Run §14 verification + write skeleton-verification.md + body-sway investigation report (SC-01)

**Open questions to resolve at plan-time:**
- **Codegen tool choice** (SC-02): `datamodel-code-generator` (wrong direction — JSON Schema → Pydantic, not the reverse) vs. `pydantic2ts` vs. hand-rolled (Pydantic `model_json_schema()` → `json-schema-to-typescript` chain). Default: hand-rolled per ARCHITECTURE.md §4.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plumbing & Process Lifecycle | 2/2 | Complete | 2026-05-07 |
| 2. Conversation Pipeline | 0/3 | Not started | - |
| 3. TTS & Sentence-Buffered Audio | 0/2 | Not started | - |
| 4. Action Compositor + VTS Bridge + Body-Sway Investigation | 0/4 | Not started | - |
| 5. Polish, Contracts Codegen, §14 Verification | 0/2 | Not started | - |

## Coverage

**v1 requirements:** 25 total
**Mapped to phases:** 25
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
| AVT-10 | 4 | Cursor-in-canvas → ActionIntent reaction → eye/head tracking |
| SC-01 | 5 | All six §14 criteria formally verified in `.planning/skeleton-verification.md` |
| SC-02 | 5 | Codegen replaces hand-written TS contracts |

**No orphaned requirements. No requirement is duplicated across phases.**

## Build-Order Constraints

These constraints are derived from the architecture research and must be honored during plan-phase decomposition:

1. **Phase 1 → Phase 2**: WS protocol envelope and sidecar lifecycle must be solid before Phase 2 produces real LLM content. Fix the OLVT-shape envelope here; propagating it later is mechanical.
2. **Phase 2 → Phase 3**: Phase 2 uses **stub TTS** (text-to-stdout or silent audio) so the conversation pipeline is verifiable independently. Phase 3 swaps in real piper.
3. **Phase 3 → Phase 4**: Phase 3 must expose the real RMS feature tap (TTS-03) that Phase 4's speech driver consumes. No stubbing this — Phase 4 needs real envelopes from real synthesis.
4. **Phase 4 entry gate**: 04-00 (Teto smoke-pass) runs as the **first task of Phase 4**. The smoke-pass output (which body params are non-orphan / writable on the Teto rig) determines which speech-driver strategy is the shipping default and populates `teto_overrides.yaml`.
5. **Phase 5 prerequisites**: §14 verification (SC-01) requires Phases 1–4 deliverables present and demo-able on a clean clone.

## Sequential vs Parallel Execution

`config.json` sets `parallelization: true`, but the architecture research explicitly recommends **sequential phase execution**: each phase produces the contract that the next consumes. The dependency chain (echo round-trip → real LLM stream → real audio with RMS → compositor that consumes RMS → verification) is the validation order.

**Within phases**, plans can run in parallel where independent (e.g., 04-01 single-writer wrapper and 04-03 cursor tracker overlay touch disjoint code paths). The plan-phase workflow is the right place to identify intra-phase parallelism.

## Open Architectural Questions (Surfaced for Plan-Phase)

These are decisions that need resolution at plan-time, not implementation-time. Tracked here so plan-phase can pick them up:

1. **PLUMB-05 / Phase 1**: pyvts vendoring acceptability (default: vendor from day one)
2. **PLUMB-03 / Phase 1**: Port-allocation strategy — `port:0` ephemeral vs. fixed-port + handshake (default: `port:0`)
3. **SC-02 / Phase 5**: Codegen tool — `datamodel-code-generator` vs. `pydantic2ts` vs. hand-rolled (default: hand-rolled JSON Schema intermediate)
4. **LLM-03 / Phase 2 (cross-cutting)**: Reasoning-UI scope in skeleton — parser-strip-only vs. per-message expand chevron (default: parser-strip-only; chevron is UX-01 in v2)
5. **AVT-06 / Phase 4**: Body-sway investigation minimum N strategies before head-only fallback (default: ≥2 per AVT-06)

---
*Roadmap created: 2026-05-06*
*Granularity: coarse (4-6 phases target — landed at 5)*
*Coverage: 25/25 v1 requirements mapped, no orphans*
