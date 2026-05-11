---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Rich Voice Configuration + Voice Input
status: human_verification_pending
stopped_at: Phase 20 implementation complete; live microphone UAT approval pending
last_updated: "2026-05-11T05:50:00Z"
last_activity: 2026-05-11 - Phase 20 automated verification passed; live PTT, VAD, and active-turn queue UAT pending
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 27
  completed_plans: 27
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** Multi-avatar identity persistence (v1 horizon - v3.0 improves voice usability before memory/avatar identity work)
**Current focus:** Phase 20: live voice input UAT approval

## Current Position

Phase: 20 of 22 (Renderer Voice Capture + PTT/VAD Preview UX)
Plan: Human UAT approval pending after automated verification
Status: Phase 20 implementation complete; verifier reported human_needed for live microphone/playback checks
Last activity: 2026-05-11 - Phase 20 automated verification passed; live PTT, VAD, and active-turn queue UAT pending

Progress: [██████████] 27/27 Phase 20 plans complete; human UAT gate pending

## Performance Metrics

**Velocity:**

- Total plans completed in v3.0: 27
- Average duration: 10 min
- Total execution time: 172 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16. Audio Contracts + TTS Provider Shell | 4/4 | same-session | same-session |
| 17. GPT-SoVITS Provider + Voice Presets | 12/12 | 117 min | 10 min |
| 18. Rich Voice Settings + Persistence | 3/3 | same-session | same-session |
| 19. STT Provider Abstraction + Local/Cloud Providers | 4/4 | same-session | same-session |
| 20. Renderer Voice Capture + PTT/VAD Preview UX | 4/4 | 55 min | 14 min |
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
- Phase 20 plan 20-02 keeps PTT/VAD UI preferences in renderer-local audio settings to avoid changing generated STT provider contracts; preview transcripts remain transient and Chat submission remains 20-03 scope.
- Phase 20 plan 20-04 keeps VAD conservative and explicit opt-in, reuses the existing VoiceCapture and Chat final-text path, and defers no-headphones/AEC claims to Phase 22.

### Pending Todos

- Complete or approve Phase 20 live microphone UAT.

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
- Phase 18 added provider catalog labels, explicit cloud STT consent/API key persistence, redacted diagnostics, Voice in settings, and diagnostics-only STT tests without microphone capture or chat submission.
- Phase 19 plan 19-01 added STT contracts, lazy registry, app-managed model cache metadata, readiness fingerprints, and admin endpoint skeletons without provider-library imports at boot.
- Phase 19 plans 19-02 and 19-03 added lazy local/cloud STT adapters, local model cache prepare/remove/status, provider-specific cloud consent/credential gates, and readiness-gated test transcription.
- Phase 19 plan 19-04 added Electron STT model-cache bridges, Settings cache/test controls, and a Settings-only microphone recorder path without chat submission.
- Phase 20 plan 20-01 added runtime voice input contracts, narrow Electron microphone permission handling, preload IPC, and readiness-gated sidecar runtime transcription using the selected Phase 19 STT provider only.
- Phase 20 plan 20-02 added renderer microphone capture, sequence-gated preview transcription state, one queued final slot, Settings-only PTT shortcut configuration, and disabled-by-default conservative VAD settings.
- Phase 20 plan 20-03 added Chat-visible PTT mic controls, transient preview outside bubbles, unchanged final transcript submission through the existing text-input path, and one queued final transcript during active turns without barge-in.
- Phase 20 plan 20-04 added opt-in conservative VAD auto-submit, VAD state/safety copy, final regression evidence, and UAT tracking without wake word, barge-in, or AEC/no-headphones claims.

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| v2.0 event UAT | Live `<event>` UAT requires an active avatar catalog with events; current Teto has `events: []` | deferred |
| v2.1 memory | Memory, semantic retrieval, and per-avatar identity remain deferred to v4.0 with the agentic system | deferred |
| v3.0 exclusions | GPT-SoVITS installer/training/voice cloning, wake word, translation, barge-in, silent cloud fallback, and perfect no-headphones claim | out of scope |

## Session Continuity

Last session: 2026-05-11T05:50:00Z
Stopped at: Completed Phase 20 implementation and automated verification; live human UAT pending
Resume file: None
