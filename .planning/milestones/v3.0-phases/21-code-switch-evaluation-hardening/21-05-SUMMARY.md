---
phase: 21
plan: 21-05
status: complete
requirements-completed: [CODE-01, CODE-03, CODE-04]
key-files:
  modified:
    - apps/renderer/src/state/audio-settings.ts
    - apps/renderer/src/audio/voice-capture.ts
    - apps/renderer/src/audio/vad-controller.ts
    - apps/renderer/src/screens/Chat/VoiceInputControl.tsx
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/tests/voice-capture.test.ts
    - apps/renderer/tests/vad-controller.test.ts
    - apps/renderer/tests/voice-input-store.test.ts
    - apps/renderer/tests/Settings.test.tsx
    - apps/renderer/tests/ChatVoiceInput.test.tsx
    - .planning/phases/21-code-switch-evaluation-hardening/21-SCORECARD.md
    - .planning/phases/21-code-switch-evaluation-hardening/21-VERIFICATION.md
    - .planning/phases/21-code-switch-evaluation-hardening/21-UAT.md
completed: 2026-05-13
---

# Phase 21 Plan 21-05: Microphone Source Isolation and Faster-Whisper Evidence Closure Summary

Implemented explicit microphone source selection for PTT and VAD, added loopback/system-audio warnings, and preserved faster-whisper's limited code-switch evidence in Phase 21 artifacts.

## What Changed

- Added normalized microphone settings with selected device id, label, and suspected system-audio flag.
- Added loopback/system-audio detection for labels such as Stereo Mix, loopback, monitor, virtual cable, speaker/output, and system audio.
- Routed the selected microphone into both `VoiceCapture` and `VadController`.
- Prevented silent fallback to default input when a selected microphone is unavailable.
- Added Settings > Voice input microphone selector and warning copy.
- Added regression tests for selected microphone constraints, unavailable selected devices, Settings persistence, and Chat PTT/VAD routing.

## Verification

- `cd apps/renderer; npm test -- voice-capture.test.ts vad-controller.test.ts voice-input-store.test.ts ChatVoiceInput.test.tsx Settings.test.tsx` - passed, 115 tests.
- `cd apps/renderer; npm run typecheck` - passed.

## Remaining Human Verification

- None blocking. Live retest passed for selected physical microphone isolation.
- Recommended-provider FunASR retest passed mixed Chinese/English and mixed key-token cases.

## Deviations from Plan

None - implementation followed the gap closure plan and live retest has since closed Phase 21.

## Self-Check: PASSED
