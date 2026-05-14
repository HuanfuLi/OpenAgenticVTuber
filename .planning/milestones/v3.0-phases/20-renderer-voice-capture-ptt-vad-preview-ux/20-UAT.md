# Phase 20 UAT: Renderer Voice Capture + PTT/VAD UX

**Date:** 2026-05-13  
**Status:** Complete  
**Authoritative live artifact:** `20-HUMAN-UAT.md`

## Current Status

Phase 20 is closed. This file is retained as the phase-level UAT index, while `20-HUMAN-UAT.md` contains the detailed live gap history and retest evidence.

The original headless manual checklist has been superseded by live UAT:

- 9/9 live checks passed.
- VAD detection/observability gap was fixed by 20-08 and retested live.
- Active-turn queue ordering gap was fixed by 20-09 and retested live.
- STT model removal/redownload UX gap was fixed by 20-10 and retested live.
- Phase 20 remains scoped to PTT/VAD voice capture and queueing; Phase 21 covers code-switch quality, and Phase 22 covers no-headphones/AEC.

## Live UAT Matrix

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| UAT-20-01 | Live microphone PTT capture | Pass | `20-HUMAN-UAT.md` Test 1; startup readiness issue fixed and retested through readiness recovery plus long PTT final submission. |
| UAT-20-02 | Live microphone VAD auto-submit | Pass | `20-HUMAN-UAT.md` Test 2; VAD meter/status/threshold visibility added and live retest passed. |
| UAT-20-03 | Live active-turn playback queue | Pass | `20-HUMAN-UAT.md` Test 3; queued PTT after VAD turn now preserves order with no duplicate first Q/A. |
| UAT-20-04 | Startup readiness recovery | Pass | `20-HUMAN-UAT.md` Test 4. |
| UAT-20-05 | STT test save refreshes Chat | Pass | `20-HUMAN-UAT.md` Test 5. |
| UAT-20-06 | Truthful model cache and VAD copy | Pass | `20-HUMAN-UAT.md` Test 6. |
| UAT-20-07 | Local model removal blocks Chat readiness | Pass | `20-HUMAN-UAT.md` Test 7; 20-10 keeps the cache card visible and Download available after removal. |
| UAT-20-08 | Custom cache root consistency | Pass | `20-HUMAN-UAT.md` Test 8. |
| UAT-20-09 | Multi-chunk preview robustness | Pass | `20-HUMAN-UAT.md` Test 9. |

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Automated Regression Evidence

| Area | Status |
|---|---|
| Chat voice UI, preview isolation, final transcript, and queueing | Pass |
| Voice capture controller | Pass |
| VAD controller | Pass |
| Electron voice input IPC and permission bridge | Pass |
| Settings voice controls and model cache UX | Pass |
| Chat streaming/conversation ordering regressions | Pass |
| Sidecar voice-input and STT readiness/model-cache tests | Pass |
| Renderer typecheck, Electron build, and contract consistency | Pass |

## Boundaries

- VAD remains explicit opt-in and conservative by default.
- Phase 20 does not implement wake word or barge-in cancellation.
- Phase 20 does not claim no-headphones/AEC readiness; that is Phase 22 scope and is now documented as Limited for the tested setup, Unsafe by default for unverified hardware.
- Live preview transcription was later removed in Phase 20.2; Phase 20's retained guarantee is final-only committed chat text and transient voice-input state isolation.
