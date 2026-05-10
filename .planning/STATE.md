---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: milestone
status: executing
stopped_at: Completed 17-05-PLAN.md
last_updated: "2026-05-10T00:00:30Z"
last_activity: 2026-05-10 - Completed Phase 17 plan 17-05 app-managed GPT-SoVITS launch lifecycle
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 14
  completed_plans: 9
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** Multi-avatar identity persistence (v1 horizon - v3.0 improves voice usability before memory/avatar identity work)
**Current focus:** Phase 17: GPT-SoVITS Provider + Voice Presets

## Current Position

Phase: 17 of 22 (GPT-SoVITS Provider + Voice Presets)
Plan: 5/7 complete
Status: Executing Phase 17 plans
Last activity: 2026-05-10 - Completed Phase 17 plan 17-05 app-managed GPT-SoVITS launch lifecycle

Progress: [█████░░░░░] 5/7 plans complete in Phase 17

## Performance Metrics

**Velocity:**

- Total plans completed in v3.0: 5
- Average duration: 7 min
- Total execution time: 36 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16. Audio Contracts + TTS Provider Shell | 4/4 | same-session | same-session |
| 17. GPT-SoVITS Provider + Voice Presets | 5/7 | 36 min | 7 min |
| 18. Rich Voice Settings + Persistence | 0/TBD | - | - |
| 19. STT Provider Abstraction + Local/Cloud Providers | 0/TBD | - | - |
| 20. Renderer Voice Capture + PTT/VAD Preview UX | 0/TBD | - | - |
| 21. Code-Switch Evaluation + Hardening | 0/TBD | - | - |
| 22. AEC Spike + No-Headphones Decision | 0/TBD | - | - |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- v3.0 starts at Phase 16 after v2.1 completed Phases 11-15; numbering must not reset.
- v3.0 follows the research-recommended order: contracts -> GPT-SoVITS/presets -> settings -> STT providers -> voice capture -> code-switch eval -> AEC decision.
- Preserve app invariants: Piper fallback, ordered sentence playback, renderer audio payloads, RMS/lipsync, VTS compositor, and conversation-history semantics.
- Open-LLM-VTuber is the implementation reference for ASR provider shape, VAD state machine, and audio capture integration patterns.
- Phase 16 was planned without a CONTEXT.md at user direction; plans are based on roadmap, requirements, codebase research, and v3.0 research artifacts.
- Phase 17 plan 17-01 established generated GPT-SoVITS provider, test-synthesis, voice preset, reference-audio, and failed-audio contracts.
- Phase 17 plan 17-03 added the sidecar GPT-SoVITS HTTP provider, candidate health/test synthesis endpoints, and failed-audio metadata on provider failures.
- Phase 17 plan 17-04 added Electron IPC/preload health and test-synthesis bridges with typed redacted failures.
- Phase 17 plan 17-05 added app-owned GPT-SoVITS launch/status/stop/restart lifecycle controls that never terminate external servers.

### Pending Todos

- Execute Phase 17 plans 17-06 through 17-07.

### Blockers/Concerns

- FunASR/SenseVoiceSmall quality and Windows/Python 3.12 packaging need provider-phase verification.
- AEC/no-headphones support is empirical and must not be promised before Phase 22 results.
- Cloud STT must remain explicit opt-in with redacted credentials/logs and no silent fallback.
- Phase 16 must not silently fall back between providers mid-turn; failures need typed health/failure states.
- Phase 17 plan 17-02 added managed reference-audio validation IPC and preset/reference delete guards.
- Phase 17 plan 17-03 keeps GPT-SoVITS failures visible and prevents silent Piper fallback within a failed chat turn.
- Phase 17 plan 17-04 keeps renderer GPT-SoVITS candidate checks behind fixed Electron IPC/preload methods.
- Phase 17 plan 17-05 scopes stop/restart to the tracked app-owned child process only; external servers return not-app-managed status.

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| v2.0 event UAT | Live `<event>` UAT requires an active avatar catalog with events; current Teto has `events: []` | deferred |
| v2.1 memory | Memory, semantic retrieval, and per-avatar identity remain deferred to v4.0 with the agentic system | deferred |
| v3.0 exclusions | GPT-SoVITS installer/training/voice cloning, wake word, translation, barge-in, silent cloud fallback, and perfect no-headphones claim | out of scope |

## Session Continuity

Last session: 2026-05-10T00:00:30Z
Stopped at: Completed 17-05-PLAN.md
Resume file: None
