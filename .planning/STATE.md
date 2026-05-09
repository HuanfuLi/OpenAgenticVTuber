---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Rich Voice Configuration + Voice Input
status: ready_to_execute
stopped_at: Phase 16 planned; ready to execute
last_updated: "2026-05-09T18:20:00-04:00"
last_activity: 2026-05-09
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** Multi-avatar identity persistence (v1 horizon - v3.0 improves voice usability before memory/avatar identity work)
**Current focus:** Phase 16: Audio Contracts + TTS Provider Shell

## Current Position

Phase: 16 of 22 (Audio Contracts + TTS Provider Shell)
Plan: 0/3 complete
Status: Ready to execute Phase 16
Last activity: 2026-05-09 - Phase 16 planned with 3 execution plans

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed in v3.0: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16. Audio Contracts + TTS Provider Shell | 0/3 | - | - |
| 17. GPT-SoVITS Provider + Voice Presets | 0/TBD | - | - |
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

### Pending Todos

- Execute Phase 16 plans:
  - `16-01`: Audio Contracts and Config Migration
  - `16-02`: TTS Provider Shell and Piper Adapter
  - `16-03`: Provider Health, Failure Semantics, and Non-Blocking Regression

### Blockers/Concerns

- FunASR/SenseVoiceSmall quality and Windows/Python 3.12 packaging need provider-phase verification.
- AEC/no-headphones support is empirical and must not be promised before Phase 22 results.
- Cloud STT must remain explicit opt-in with redacted credentials/logs and no silent fallback.
- Phase 16 must not silently fall back between providers mid-turn; failures need typed health/failure states.

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| v2.0 event UAT | Live `<event>` UAT requires an active avatar catalog with events; current Teto has `events: []` | deferred |
| v2.1 memory | Memory, semantic retrieval, and per-avatar identity remain deferred to v4.0 with the agentic system | deferred |
| v3.0 exclusions | GPT-SoVITS installer/training/voice cloning, wake word, translation, barge-in, silent cloud fallback, and perfect no-headphones claim | out of scope |

## Session Continuity

Last session: 2026-05-09T18:20:00-04:00
Stopped at: Phase 16 planned; ready for `/gsd-execute-phase 16`
Resume file: .planning/STATE.md
