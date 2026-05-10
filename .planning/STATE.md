---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Rich Voice Configuration + Voice Input
status: ready_for_next_phase
stopped_at: Phase 17 plan 17-12 gap closure baseline complete; ready for Phase 18
last_updated: "2026-05-10T06:17:00Z"
last_activity: 2026-05-10 - Phase 17 plan 17-12 lipsync velocity and sentence-latency gap closure completed
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 27
  completed_plans: 16
  percent: 28
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** Multi-avatar identity persistence (v1 horizon - v3.0 improves voice usability before memory/avatar identity work)
**Current focus:** Phase 18: Rich Voice Settings + Persistence

## Current Position

Phase: 18 of 22 (Rich Voice Settings + Persistence)
Plan: Ready to plan/execute Phase 18
Status: Phase 17 gap closures complete; ready for next phase
Last activity: 2026-05-10 - Phase 17 plan 17-12 lipsync velocity and sentence-latency gap closure completed

Progress: [███░░░░░░░] 16/27 planned v3.0 plans complete

## Performance Metrics

**Velocity:**

- Total plans completed in v3.0: 12
- Average duration: 10 min
- Total execution time: 117 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16. Audio Contracts + TTS Provider Shell | 4/4 | same-session | same-session |
| 17. GPT-SoVITS Provider + Voice Presets | 12/12 | 117 min | 10 min |
| 18. Rich Voice Settings + Persistence | 0/TBD | - | - |
| 19. STT Provider Abstraction + Local/Cloud Providers | 0/TBD | - | - |
| 20. Renderer Voice Capture + PTT/VAD Preview UX | 0/4 | - | - |
| 21. Code-Switch Evaluation + Hardening | 0/4 | - | - |
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
- Phase 17 plan 17-06 added Settings provider selection, gated GPT-SoVITS test synthesis preview, voice preset CRUD, and reference-audio management UI.
- Phase 17 plan 17-07 added visible GPT-SoVITS failed-audio chat state, final cross-tier regression evidence, and environment-blocked live-server UAT tracking.
- Phase 17 plan 17-08 added per-preset GPT-SoVITS validation evidence, deterministic fingerprint invalidation, and validated preset switching with sidecar restart.
- Phase 17 plan 17-09 made renderer WebSocket store registration idempotent/HMR-safe to prevent duplicate visible GPT-SoVITS chat text; live Test 6 remains awaiting user retest.
- Phase 17 plan 17-10 aligned GPT-SoVITS returned PCM, renderer WAV payloads, and RMS envelopes to the output stream sample rate.
- Phase 17 plan 17-11 added per-preset GPT/SoVITS weight paths and independent synthesized Text language validation.
- Phase 17 plan 17-12 decoupled websocket audio delivery from sidecar playback, queued renderer audio playback, and damped GPT-SoVITS mouth motion.

### Pending Todos

- Execute Phase 18 Rich Voice Settings + Persistence.

### Blockers/Concerns

- FunASR/SenseVoiceSmall quality and Windows/Python 3.12 packaging need provider-phase verification.
- AEC/no-headphones support is empirical and must not be promised before Phase 22 results.
- Cloud STT must remain explicit opt-in with redacted credentials/logs and no silent fallback.
- Phase 16 must not silently fall back between providers mid-turn; failures need typed health/failure states.
- Phase 17 plan 17-02 added managed reference-audio validation IPC and preset/reference delete guards.
- Phase 17 plan 17-03 keeps GPT-SoVITS failures visible and prevents silent Piper fallback within a failed chat turn.
- Phase 17 plan 17-04 keeps renderer GPT-SoVITS candidate checks behind fixed Electron IPC/preload methods.
- Phase 17 plan 17-05 scopes stop/restart to the tracked app-owned child process only; external servers return not-app-managed status.
- Phase 17 plan 17-06 keeps GPT-SoVITS activation behind health plus audible test synthesis and keeps preset/reference deletes guarded.
- Phase 17 plan 17-07 keeps GPT-SoVITS chat failures visible without raw diagnostics inline and does not save config or switch to Piper from chat failure handling.
- Phase 17 live retests after 17-10 through 17-12 remain useful for user confidence, but automated coverage and verification allow Phase 18 to proceed.
- Phase 17 code review blockers were fixed and final `17-REVIEW.md` is clean; `17-VERIFICATION.md` passed all 5 roadmap success criteria.

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| v2.0 event UAT | Live `<event>` UAT requires an active avatar catalog with events; current Teto has `events: []` | deferred |
| v2.1 memory | Memory, semantic retrieval, and per-avatar identity remain deferred to v4.0 with the agentic system | deferred |
| v3.0 exclusions | GPT-SoVITS installer/training/voice cloning, wake word, translation, barge-in, silent cloud fallback, and perfect no-headphones claim | out of scope |

## Session Continuity

Last session: 2026-05-10T06:17:00Z
Stopped at: Completed 17-12-PLAN.md gap closure baseline; ready for Phase 18
Resume file: None
