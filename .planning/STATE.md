---
gsd_state_version: 1.0
milestone: none
milestone_name: No active milestone
status: v3_0_closed
stopped_at: v3.0 complete and archived; ready for next milestone planning
last_updated: "2026-05-14T02:18:09-04:00"
last_activity: 2026-05-14 - v3.0 Rich Voice Configuration + Voice Input closed after milestone audit passed
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-14)

**Core value:** Multi-avatar identity persistence.
**Current focus:** v3.0 complete; next step is v4.0 milestone definition for agentic system plus memory.

## Current Position

No active phase is open.

The v3.0 milestone is complete and archived:

- Roadmap archive: `.planning/milestones/v3.0-ROADMAP.md`
- Requirements archive: `.planning/milestones/v3.0-REQUIREMENTS.md`
- Phase archive: `.planning/milestones/v3.0-phases/`
- Audit: `.planning/milestones/v3.0-MILESTONE-AUDIT.md`

## Last Closed Milestone

**v3.0 Rich Voice Configuration + Voice Input**

- Phases complete: 9/9
- Plans complete: 57/57
- Requirements complete: 39/39
- Verifications complete: 9/9
- Validations complete: 9/9
- Audit status: passed

## v3.0 Outcomes

- TTS provider contracts and Piper regression safety.
- GPT-SoVITS provider support with activation, presets, reference audio, app-managed/external-server modes, and visible failure handling.
- Settings refactor that made voice configuration understandable and removed mandatory test-before-enable gates.
- STT provider layer with FunASR, faster-whisper, OpenAI, and Groq plus local model cache and explicit cloud consent.
- Final-only PTT/VAD voice input, active-turn queueing, stop-current-turn, and edit/regenerate typo recovery.
- Code-switch corpus and scorecard; FunASR is the current local-first recommendation, faster-whisper remains limited for code-switch quality.
- AEC/no-headphones decision: Limited for the tested setup, Unsafe by default for unverified hardware.

## Accepted Limitations

- faster-whisper CUDA requires NVIDIA CUDA 12 runtime libraries; CPU and FunASR paths remain available.
- No-headphones support is hardware-dependent and not universally claimed.
- Cloud STT remains explicit opt-in and credential-gated.
- GPT-SoVITS installer/training/voice-cloning UI remains out of scope.
- Wake word, barge-in, translation, memory, and agent mode remain deferred.

## Pending Todos

- Start the next milestone requirements and roadmap for v4.0 Agentic System + Memory.

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| v2.0 event UAT | Live `<event>` UAT requires an active avatar catalog with events; current Teto has `events: []` | deferred |
| v4.0 memory | Memory, semantic retrieval, and per-avatar identity remain deferred to v4.0 with the agentic system | deferred |
| v3.0 exclusions | GPT-SoVITS installer/training/voice cloning, wake word, translation, barge-in, silent cloud fallback, and perfect no-headphones claim | out of scope |

## Session Continuity

Last session: 2026-05-14T02:18:09-04:00
Stopped at: v3.0 milestone closeout
Resume file: `.planning/PROJECT.md`
