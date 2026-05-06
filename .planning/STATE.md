# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06)

**Core value:** Multi-avatar identity persistence (v1 horizon — skeleton lays foundation, doesn't deliver it yet)
**Current focus:** Phase 1 — Plumbing & Process Lifecycle

## Current Position

Phase: 1 of 5 (Plumbing & Process Lifecycle)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-05-06 — ROADMAP.md created from research synthesis

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Plumbing & Process Lifecycle | 0/2 | - | - |
| 2. Conversation Pipeline | 0/2 | - | - |
| 3. TTS & Sentence-Buffered Audio | 0/2 | - | - |
| 4. Compositor + VTS + Body-Sway | 0/4 | - | - |
| 5. Polish + Verification | 0/2 | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (12 decisions logged at init).
Recent decisions affecting current work:

- Pre-Phase-1: 5-phase sequential build order (per ARCHITECTURE.md §8) — coarse granularity from config.json
- Pre-Phase-1: Body-sway as research/strategy-pattern, not OLVT port (R-OPEN-1) — investigation IS the deliverable per AVT-06
- Pre-Phase-1: Sidecar→VTS direct via pyvts; renderer never sees `param-frame` traffic (avoids 60 Hz IPC cascade)

### Pending Todos

None yet.

### Blockers/Concerns

Carried forward from research synthesis as plan-time decision items:

- **Plan-time decision (Phase 1)**: pyvts vendoring acceptability — default: vendor from day one
- **Plan-time decision (Phase 1)**: port-allocation strategy — default: `port:0` ephemeral
- **Plan-time decision (Phase 2)**: reasoning-UI scope — default: parser-strip-only
- **Plan-time decision (Phase 4)**: body-sway investigation strategy count — default: ≥2 (AVT-06 mandates)
- **Plan-time decision (Phase 5)**: codegen tool choice — default: hand-rolled

### Open Risks

- **R-OPEN-1**: Body-sway-during-TTS unsolved on VTS rigs — Phase 4 entry gate (04-00 Teto smoke-pass) is the empirical resolver
- **R-OPEN-2**: VTS-only renderer locks out future mobile companion — accepted, post-MVP Pixi exploration is the hedge

## Session Continuity

Last session: 2026-05-06
Stopped at: ROADMAP.md + STATE.md written; REQUIREMENTS.md traceability updated
Resume file: None — ready for `/gsd:plan-phase 1`
