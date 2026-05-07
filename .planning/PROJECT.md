# AgenticLLMVTuber

## What This Is

A local-first desktop companion app: a VTube Studio Live2D avatar that holds conversations and reacts continuously, with an opt-in agent mode that can drive the user's screen — daily GUI routines, scheduled goals, code/file/web tasks delegated to a CLI sub-agent. Successor to the Open-LLM-VTuber Vivid Actions phase, single-user, designed so each avatar can become a distinct persistent companion rather than a chatbot wearing a face.

## Core Value

Multi-avatar identity persistence — the same user can have meaningfully *distinct* relationships with different avatars (per-avatar episodic memory + shared user-facts) such that switching avatars genuinely switches the conversation partner, not just the skin.

This is the **v1-horizon** core value. The current milestone (walking skeleton, §14 of `PROJECT_DESIGN.md`) is single-avatar / in-memory only — it lays the architectural foundation that makes multi-avatar identity achievable in the milestone after.

## Requirements

### Validated

- [x] Electron shell (windowed mode only) wraps a React+Vite renderer with TS-end-to-end shell config — *Validated in Phase 1: Plumbing & Process Lifecycle (PLUMB-01)*
- [x] Python sidecar (FastAPI + uvicorn) runs from venv with eager start + watchdog from Electron main; PyInstaller packaging deferred to a later milestone — *Validated in Phase 1 (PLUMB-02); orphan-process recovery confirmed live on Windows*
- [x] Mandatory LLM setup screen on first launch — block until provider URL/key tested; LiteLLM connected to LM Studio (default) on localhost:1234 — *Validated in Phase 1 (PLUMB-04); real 1-token completion confirmed live against LM Studio*
- [x] WebSocket protocol shape matches OLVT's so plumbing fixes can copy back — *Validated in Phase 1 (PLUMB-03); echo round-trip confirmed live*

### Active

<!-- Walking-skeleton scope only (per PROJECT_DESIGN.md §14). Subsequent milestones layer memory, agent, scheduler, skills, multi-thread, pet mode, multi-avatar on top. -->

- [ ] OLVT-style conversation pipeline ported: sentence_divider → actions_extractor → tts_filter → TTS queue, with sentence-buffered playback (parallel synth, ordered delivery)
- [ ] piper TTS only; lipsync via our-RMS path driving `ParamMouthOpenY`
- [ ] Minimal action compositor running at 60 Hz with three drivers — idle baseline (Perlin drift + blink scheduler), speech driver (TTS RMS → head sway; body-sway is an unsolved problem on VTS rigs and may end up head-only in the skeleton — see Risks), intent overlay (smooth fade-in/out on `[joy]`/`[shy]` etc.)
- [ ] Renderer binding: `ParamFrame` stream → pyvts `InjectParameterDataRequest` (60 Hz) against one VTS avatar; one `DiscreteEvent` test (e.g. prop) maps to a hotkey
- [ ] Renderer-aware ParamID resolver (~30 LOC) — VTS path writes input-layer names (`ParamAngleX`) and lets VTS internal routing handle smoothing; non-VTS branch is a stub that errors helpfully. Keeps the compositor portable to a post-MVP Pixi attempt without rewrite.
- [ ] Speech-driver body-sway investigation: try multiple approaches on VTS rigs (smoke-pass for non-orphan downstream body params; `.exp3.json` body-pose modulation by RMS; custom physics chain via `<model>.vtube.json`; head-only with breathing/micro-shoulder alternative). Skeleton ships either with visible body sway OR with head-only motion + a written rationale documenting what was tried.
- [ ] Ship a stub `teto_overrides.yaml` (or .json) checked into the repo even though import + smoke-pass tooling is deferred — establishes the per-avatar override file schema (orphan params list, physics-chain proxies, sign inversions) so the import-pipeline milestone inherits it for free.
- [ ] Companion-mode chat: single thread, in-memory only (cleared on relaunch); cursor-in-canvas eye/head tracking on the avatar
- [ ] LLM emits `[joy]` → expression smoothly blends in over ~300ms and decays after the sentence ends — **not a hotkey pop** (success criterion §14)
### Out of Scope (this milestone — deferred to later v1 milestones)

- **Agent mode and goal-loop** — entire §9; deferred to dedicated agent-runtime milestone
- **Saved goals + scheduler (APScheduler)** — depends on agent runtime
- **Skills system + auto-parser (in-app screen-control)** — depends on agent runtime
- **Memory subsystem** — profile loading, Chroma per-avatar episodic, FTS5 chat search, shared user-facts bucket, RRF retrieval, deletion ops; deferred to memory milestone
- **Multi-thread chat per avatar** — single in-memory thread for skeleton
- **Multi-avatar switching + import pipeline** — single hardcoded avatar (Teto, dev-only) for skeleton
- **Pet mode (form-factor toggle and click-through)** — windowed mode only for skeleton
- **Audio-to-params learned drivers (v1.5)** — rule-based DSP only
- **Voice input (PTT, VAD, faster-whisper)** — text input only for skeleton
- **Image input (paste/drag/picker)** — text only
- **Multiple TTS backends (edge-tts, GPT-SoVITS, ComfyUI)** — piper only
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
*Last updated: 2026-05-07 after Phase 1 complete*
