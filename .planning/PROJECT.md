# AgenticLLMVTuber

## What This Is

A local-first desktop companion app: a VTube Studio Live2D avatar that holds conversations and reacts continuously, with an opt-in agent mode that can drive the user's screen — daily GUI routines, scheduled goals, code/file/web tasks delegated to a CLI sub-agent. Successor to the Open-LLM-VTuber Vivid Actions phase, single-user, designed so each avatar can become a distinct persistent companion rather than a chatbot wearing a face.

## Core Value

Multi-avatar identity persistence — the same user can have meaningfully *distinct* relationships with different avatars (per-avatar episodic memory + shared user-facts) such that switching avatars genuinely switches the conversation partner, not just the skin.

This is the **v1-horizon** core value. The v1.0 walking skeleton shipped the single-avatar / in-memory foundation; v2.0 shipped the animation-control refactor so later multi-avatar identity work can depend on explicit rig capabilities, avatar catalogs, and swappable motion plugins. v3.0 made the companion conversationally usable by voice, with rich TTS configuration and high-accuracy Chinese/English STT input. v4.0 is expected to move into agentic behavior plus memory.

## Current State

**Shipped:** v1.0 Walking Skeleton on 2026-05-08; v2.0 Plugin + Animation Control on 2026-05-09; v2.1 Mock/Reality Cleanup on 2026-05-09; v3.0 Rich Voice Configuration + Voice Input on 2026-05-14.

The app now boots as an Electron desktop shell with a Python sidecar, speaks via local Piper or configured GPT-SoVITS, streams LLM replies sentence-by-sentence, and drives VTube Studio through a sidecar-owned compositor. Teto remains the dev rig. Animation control is plugin-driven: avatar imports produce `AvatarOverrides` and `RigCapabilities`, the default plugin owns action-code motion, the parser routes `[action]` / `{variant}` / `<event>` codes, and a HUD exposes a focused live parameter/lock surface for operator discovery. Status chrome reports persisted provider/model, real sidecar lifecycle, and real VTS status/unavailable state instead of hardcoded mock values. Settings exposes real voice output, voice input, provider consent, local STT model cache, Avatars, VTube Studio, Conversation, Memory, and Diagnostics state. Conversation history sessions persist locally, production renderer flows no longer depend on dev mock modules, and voice input can submit final STT transcripts through PTT or VAD while preserving the existing chat pipeline.

v3.0 closed with FunASR as the current local-first STT recommendation, faster-whisper retained as a local fallback with documented CUDA-runtime dependency and weaker code-switch quality, cloud STT providers behind explicit consent, final-only STT instead of live preview, stop-current-turn, edit/regenerate typo recovery, and a Limited no-headphones/AEC verdict for the tested hardware setup. Unsafe remains the default no-headphones status for unverified hardware.

The §14 ceremony has been re-run under the refactored architecture. All six success criteria are PASS in `.planning/skeleton-verification.md` after gap closure for smirk rendering, cursor eye tracking, and blink ownership.

## Current Milestone

No active milestone is currently open. v3.0 is complete and archived.

**Last shipped milestone:** v3.0 Rich Voice Configuration + Voice Input.

**Delivered in v3.0:**
- TTS backend abstraction preserves sentence-buffered playback, ordered delivery, RMS/lipsync envelope, and Piper fallback while allowing provider-specific synthesis backends.
- GPT-SoVITS support includes external-server mode, optional app-managed launch command mode, provider activation, presets, reference audio, visible failure states, and no dependency installer or model training/cloning UI.
- Rich voice settings expose provider switching, optional diagnostics, backend-specific controls, named voice presets, STT cache controls, explicit cloud STT consent/credentials, and truthful enablement blockers.
- STT service exposes FunASR as the default local provider, faster-whisper as local fallback, and OpenAI + Groq as explicit opt-in cloud transcription providers.
- Voice input supports final-only STT through push-to-talk and VAD auto-submit; final transcripts enter the chat pipeline unchanged with no translation, while stop and edit/regenerate allow typo recovery.
- Code-switch evaluation is based on a locked bilingual/code-switch corpus, provider scorecard, no-translation checks, and Settings copy aligned to the actual final-transcript path.
- No-headphones/AEC work produced diagnostics and a truthful product decision: Limited for the tested setup, Unsafe by default for unverified hardware, and conservative VAD behavior during active TTS.

**Key context:**
- Phase numbering continues after v2.1, so this milestone starts at Phase 16.
- Open-LLM-VTuber is the implementation reference for ASR provider shape, VAD state machine, and audio capture integration patterns.
- Existing Piper behavior is the regression baseline for TTS latency, ordered playback, and lipsync RMS envelopes.
- FunASR is the current local-first recommendation after Phase 19 local live acceptance; Phase 21 must validate whether that recommendation is still justified by bilingual/code-switch quality results.
- faster-whisper remains the local fallback/provider baseline. CUDA acceleration is environment-dependent on the required CUDA runtime libraries, while CPU latency improvements must not downgrade the selected model quality.
- Cloud STT providers are opt-in and require user-supplied credentials; local-first remains the default posture. Cloud live transcription was skipped in Phase 19 because credentials were not used, but automated coverage verifies consent, credential gates, language propagation, and redacted diagnostics.

**Next milestone intent:**
- v4.0 carries the agentic system plus memory.

**Accepted deferred items:**
- Phase 7 live `<event>` UAT remains catalog-gated because active Teto currently has `events: []`; automated parser/routing/tracker coverage is present.
- Phase 10 no-VTS-rect cursor synthetic fallback remains primary-monitor-only. The live DPI-aware VTS-window path is validated on a two-monitor Windows setup with VTS on the secondary display.

## Requirements

### Validated

- [x] Electron shell (windowed mode only) wraps a React+Vite renderer with TS-end-to-end shell config — *Validated in Phase 1: Plumbing & Process Lifecycle (PLUMB-01)*
- [x] Python sidecar (FastAPI + uvicorn) runs from venv with eager start + watchdog from Electron main; PyInstaller packaging deferred to a later milestone — *Validated in Phase 1 (PLUMB-02); orphan-process recovery confirmed live on Windows*
- [x] Mandatory LLM setup screen on first launch — block until provider URL/key tested; LiteLLM connected to LM Studio (default) on localhost:1234 — *Validated in Phase 1 (PLUMB-04); real 1-token completion confirmed live against LM Studio*
- [x] WebSocket protocol shape matches OLVT's so plumbing fixes can copy back — *Validated in Phase 1 (PLUMB-03); echo round-trip confirmed live*
- [x] LiteLLM streaming gateway with provider-specific reasoning-disable (no parser-strip, no out-of-band capture) — *Validated in Phase 2 (LLM-01); 4 provider branches verified by unit tests; live `<think>` suppression confirmed against compliant reasoning model*
- [x] OLVT 4-decorator chain ported (sentence_divider → actions_extractor → display_processor → tts_filter); LLM emits `[tag]` → ActionIntent extracted, bracket stripped from chat, INTENT log line fires; adversarial split-bracket robustness — *Validated in Phase 2 (LLM-02); split-bracket SC #3 BLOCKER closed programmatically; live verified against real Teto rig vocabulary (Blush, Cry, Star Eye, …)*
- [x] Append-only `_memory` + forward-only `_head_idx` orchestrator; in-memory single thread cleared on relaunch — *Validated in Phase 2 (LLM-04); KV-cache discipline grep returns 0 violations; fresh-thread invariant verified at runtime introspection*
- [x] Pydantic contracts are the source of truth for the six TypeScript contract mirrors; JSON Schema intermediates are committed and `npm run check:contracts` guards drift — *Validated in Phase 5: Polish, Contracts Codegen (SC-02)*
- [x] Slider HUD exposes a focused rig parameter surface with session-only per-param locks — *Validated in Phase 9: Slider HUD + Per-Param Lock (HUD-01..HUD-08); live UAT approved after `hud_visible_param_ids` and non-blocking HUD stream fixes*
- [x] Avatar import + catalogs create and review `_avatar_overrides.yaml`, populate `AvatarOverrides`, and define the rig-introspection data consumed by plugins, parsers, and HUD — *Validated in Phase 8 (IMP-01..IMP-10, ARCH-02)*
- [x] Plugin runtime moves body-motion behavior behind `BodyMotionPlugin`, default plugin, manifest validation, supervisor, rate limiting, clamp, and single-writer VTS routing — *Validated in Phase 6 (ARCH-01..ARCH-12, PLG-01..PLG-10)*
- [x] Three-category code system routes `[action]` to plugin logic, `{variant}` to persistent avatar variants, and `<event>` to one-shot motion/event hotkeys — *Validated in Phase 7 (PARSE-01..PARSE-08); live event UAT is catalog-gated by current Teto `events: []`*
- [x] v2.0 §14 re-verification records all six success criteria as PASS under the refactored plugin architecture — *Validated in Phase 10 (VFY-01..VFY-05)*
- [x] Status and app chrome use real provider/model, sidecar, and VTS state instead of mocks or hardcoded copy — *Validated in Phase 11 (STAT-01..STAT-05)*
- [x] Settings sections for existing v2.0 systems are wired to real data/actions, while Conversation and Memory are labeled by shipped/deferred reality — *Validated in Phase 12 (SET-01..SET-07)*
- [x] Conversation history sessions provide persistent ChatGPT-style transcripts and real Settings wiring. — *Validated in Phase 13 (HIST-01..HIST-05)*
- [x] Plugin developer documentation and plugin swap hardening make the motion-plugin path operable and diagnosable. — *Validated in Phase 14 (PLUGDOC-01..PLUGDOC-05)*
- [x] Development mocks are isolated from production user flows and documented as dev-only. — *Validated in Phase 15 (MOCK-01..MOCK-04)*
- [x] Audio backend contracts, provider health/failure semantics, and Piper regression safety are implemented. — *Validated in Phase 16*
- [x] GPT-SoVITS voice output, provider activation, reference audio, and presets are implemented without silent provider fallback. — *Validated in Phase 17*
- [x] Rich voice settings, provider labels, explicit cloud STT consent, credential redaction, and diagnostics are implemented. — *Validated in Phases 18 and 20.1*
- [x] STT provider set is implemented: FunASR default, faster-whisper local fallback, OpenAI cloud, and Groq cloud behind one lazy-loaded provider interface. Local live provider acceptance passed; cloud live transcription was skipped with automated consent/credential/redaction coverage. — *Validated in Phase 19*
- [x] Voice input supports final-only PTT/VAD capture, visible readiness/VAD state, active-turn queueing, stop-current-turn, and sent-message edit/regenerate for typo recovery. — *Validated in Phases 20 and 20.2*
- [x] Code-switch evaluation and hardening: user can speak Chinese, English, or code-switched utterances through final-only PTT/VAD; provider recommendations and copy are backed by a locked corpus and scorecard. — *Validated in Phase 21*
- [x] Echo-cancellation/no-headphones decision: the milestone includes AEC diagnostics, active-TTS safety checks, no-headphones status policy, and documented remaining limitation. — *Validated in Phase 22*

### Active

No active requirements are open. The next requirements set should be created with the next milestone.

### Out of Scope (deferred to later v1 milestones)

- **Agent mode and goal-loop** — entire §9; deferred to v4.0 agentic-system milestone
- **Saved goals + scheduler (APScheduler)** — depends on agent runtime
- **Skills system + auto-parser (in-app screen-control)** — depends on agent runtime
- **Memory subsystem** — profile loading, Chroma per-avatar episodic, FTS5 chat search, shared user-facts bucket, RRF retrieval, deletion ops; deferred to v4.0 with the agentic system
- **Per-avatar memory-backed conversation identity** — Phase 13 adds app-level transcript/session history, but per-avatar episodic memory and identity-backed retrieval remain deferred
- **Multi-avatar switching** — import/catalog infrastructure exists, but relationship identity, per-avatar memory, and first-class switching remain deferred
- **Pet mode (form-factor toggle and click-through)** — windowed mode only for skeleton
- **Audio-to-params learned drivers (v1.5)** — rule-based DSP only
- **Image input (paste/drag/picker)** — text only
- **Telemetry, auto-update, audit log, i18n strings, settings UI surfaces beyond LLM setup** — out of skeleton

### Out of Scope (v1 entirely — never in this project)

- **Mobile companion** — separate future project with its own design doc and tech stack (PROJECT_DESIGN.md §10, §16)
- Cross-device pairing / remote control / relay servers
- Group avatars / multi-character scenes / multi-user accounts
- Anti-cheat-game automation (R-2 carve-out)
- Native Cubism Web SDK rendering — VTube Studio is the rendering pipe
- Auto-update auto-install (notify-only ever)
- Skill code signing / sandboxed execution
- Cloud-hosted memory sync
- Voice cloning UI (users supply their own GPT-SoVITS model)
- Plugin/extension marketplace
- **pixi-live2d-display as a v1 renderer** — Pixi is *post-MVP exploratory only*, attempted after the project is otherwise fully working as a mobile-portability hedge (since VTube Studio likely can't run on a future mobile companion). May be abandoned if it doesn't pan out. The whole MVP renderer path is VTS+pyvts.
- Agent best-effort rollback for irreversible actions
- Goal template parameterization (`{account}`, `{date}` placeholders)
- Wake word activation (raw VAD only when voice ships)
- Memory encryption at rest (plaintext + OS user-account isolation)

## Context

- **Predecessor**: This project succeeds work in [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber), specifically the Vivid Actions phase explored in a fork's `.planning/phases/04-vivid-actions/`. Hard-won lessons about hotkey/parameter-stream split, IDLE pin conventions, and the `actionMap` pattern feed directly into the current design.
- **Design source-of-truth**: `PROJECT_DESIGN.md` at the repo root captures 28 rounds / 112 resolved decisions across vision, architecture, components, data contracts, library inventory, agent strategy, memory strategy, Live2D approach, and risks. All §13 open items have been closed in-place.
- **Inspiration target for liveliness**: Neuro-sama-style continuous expressivity — half-blinks, micro-nods, smooth blends — *not* VTS-hotkey pops. The action compositor (§5.2) is the unique value-add.
- **Stack philosophy** (§1.4): minimize self-built work. We are not rebuilding the Cubism SDK, Claude Code, or LiteLLM. Unique value-add = action compositor + agent router + goal-loop + scheduled-goal runtime + skills plumbing. Everything else is glue.
- **Walking-skeleton estimate** (§14): ~2 weeks with one engineer familiar with OLVT internals. Compositor is the new work; everything else is OLVT plumbing port.

## Constraints

- **Tech stack**: Electron (TS) + React + Vite + Python 3 sidecar (FastAPI + uvicorn) — locked per §13.1, §13.8. TS-end-to-end shell wins for TS-fluent team; Python backend reuses OLVT pipeline.
- **Live2D rendering**: VTube Studio + pyvts is the v1 path (§11). User must run VTS separately. No Cubism SDK in the repo.
- **LLM gateway**: LiteLLM single client (§5.5). LM Studio default, OpenAI/Anthropic/Gemini/custom-OpenAI-compatible all supported.
- **Local-first**: WebSocket protocol localhost-only (§10). No cross-device pairing in v1.
- **Single-user**: No multi-user/family accounts (§13.7).
- **Default avatar (shipping)**: Live2D Inc. sample model (Hiyori/Mark/Wanderer) — Teto is dev-only and not redistributable (§13.123).
- **Walking-skeleton timeline**: ~2 weeks single engineer (§14 estimate); not a hard deadline but the scope must collapse to fit the §14 success criteria.

## Risks

- **R-OPEN-1: Body-sway-during-TTS is unsolved on VTS rigs.** OLVT Phase 4 attempted the IN-twin physics-chain-shortcut pattern (§5.3.1) and it did **not** produce visible body sway — the design doc documents the *attempt*, not a confirmed solution. Direct writes to body params (`ParamBodyAngleX`) were no-ops because those params are orphans in the Teto rig. Skeleton planning must treat body sway as research, not port-from-OLVT. Mitigation paths to investigate: smoke-pass to find non-orphan downstream body params; modulating `.exp3.json` body-pose primitives by RMS; custom physics-chain authoring via `<model>.vtube.json`; or accepting head-only sway and finding alternative liveliness signals (breathing, micro-shoulder).
- **R-OPEN-2: VTS-only renderer locks out a future mobile companion.** Mitigation is post-MVP exploration of pixi-live2d-display once the project is otherwise working. If Pixi doesn't pan out, mobile becomes a renderer-research project before it can ship. Acceptable for v1 since mobile is out of scope by design (§10).

## Key Decisions

<!-- Foundational decisions resolved in PROJECT_DESIGN.md §13 (112 rows). Logging only the decisions that most affect this milestone's planning. Future decisions append below. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri (§13.1) | TS-end-to-end for a TS-fluent team; ~150 MB bundle/RAM gap is invisible to the target user (VTS already runs alongside) | — Pending |
| Python sidecar over Node (§13.8) | OLVT pipeline is Python; preserves WebSocket-protocol-shape reuse so OLVT fixes can copy back | — Pending |
| VTS+pyvts as the *whole-MVP* renderer; pixi parked post-MVP exploratory (supersedes §13.2 v1.5 framing) | VTS handles deformer math, physics, lipsync. Body-sway-during-TTS is unsolved on VTS — solving it on VTS first beats absorbing it into a renderer-portability goal. Pixi remains relevant only as a future mobile-portability hedge. | — Pending |
| 60 Hz `ParamFrame` stream as primary control surface (§5.2, §11) | Hotkeys produce pops; continuous param injection produces Neuro-sama-style fluidity | — Pending |
| Three-layer separation: LLM tags → compositor → renderer (§11) | Renderer swappable (VTS/pixi/Cubism) without touching prompts; learned drivers swap inside compositor without touching contracts | — Pending |
| Walking skeleton uses one hardcoded avatar (Teto, dev-only) | Avatar import pipeline + multi-avatar are deferred milestones; skeleton tests the layered architecture, not identity | — Pending |
| Renderer-aware ParamID resolver in v1 (~30 LOC stub for non-VTS branch) | Pay tiny cost now; preserves optionality for post-MVP Pixi attempt and future mobile renderer without later compositor rewrite | — Pending |
| Body-sway-during-TTS approached as research, not port (investigate+report success criterion) | OLVT IN-twin trick did not work; skeleton needs to either solve it on VTS or document fallback to head-only — not silently inherit a broken assumption | — Pending |
| Skeleton ships `teto_overrides.yaml` stub with empty orphan list | Establishes per-avatar override schema (orphan params, physics-chain proxies, sign inversions) so import-pipeline milestone doesn't have to invent it | — Pending |
| Per-avatar bucket + thread-tagged chunks for episodic memory (§13.120) | Cross-thread continuity preserved; retrieval bias 70/30 keeps current thread dominant | — Pending |
| Per-template permission grant + visible badge for scheduled goals (§13.121) | Per-session re-grant defeats unattended scheduling; per-template grants are the minimum viable backdoor with explicit user awareness | — Pending |
| Skill systems separate, non-overlapping in v1 (§13.122) | Two domains (CLI vs screen-control) have different permission models; bridge layer deferred to v1.5 | — Pending |
| Default avatar = Live2D Inc. sample model (§13.123) | Clean redistribution license; Teto is dev-only | — Pending |
| v2.0 execution order 8 → 6 → 7 → 9 → 10 | Phase 8 had to define `RigCapabilities` and `AvatarOverrides` before Phase 6 plugin runtime could consume them cleanly | ✓ Good |
| VTS owns normal idle blinking | App-owned idle blinking fought VTS/model blinking and caused half-blinks/long closed holds | ✓ Good |
| Live event UAT requires an event-bearing avatar catalog | Current active Teto catalog has `events: []`; treating this as a prerequisite avoids inventing fake live evidence | ✓ Good |
| v2.1 before v3.0 | User-facing UI still contains mocks/hardcoded state; cleanup should happen before adding larger voice or agentic features | ✓ Good |
| Memory ships with agentic system | Memory UX depends on agentic/personality context; v2.1 should mark Memory as deferred rather than implementing it prematurely | ✓ Good |
| v3.0 is STT/TTS; v4.0 is agentic + memory | Voice I/O is the next standalone capability, while agentic workflows and memory are a larger later milestone | ✓ Good |
| Conversation history ships before STT/TTS | ChatGPT-style sessions are a core chat capability and should be real before voice I/O adds more conversation entry points | ✓ Good |
| Final-only STT replaces live preview | Live preview transcription made local CPU STT too slow and added complexity; Phase 20.2 removed preview and kept final submitted transcripts as the evaluation and UX contract. | ✓ Good |
| Voice typo recovery is stop + edit/regenerate, not undo | User rejected grace-window undo; stopped or completed user messages can be edited and regenerated through normal dispatch. | ✓ Good |
| Phase 21 evaluates final transcripts only | Code-switch evidence must match the actual shipped voice path after Phase 20.2; no provider should be judged on removed preview behavior. | ✓ Good |
| Phase 22 must test existing mitigations, not assume AEC success | VAD pauses during active TTS, PTT can queue during active turns, and stop/edit/regenerate exist, but no-headphones support remains empirical and must cover local/cloud STT, VAD, and PTT paths. | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority? (specifically: when does multi-avatar identity move from horizon to in-scope?)
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after closing v3.0*
