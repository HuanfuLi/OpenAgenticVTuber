---
phase: 22
slug: aec-spike-no-headphones-decision
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
validated: 2026-05-14
---

# Phase 22 - Validation Strategy

> Retroactive Nyquist validation for AEC / no-headphones decision coverage.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + TypeScript |
| Config file | `apps/renderer/vite.config.ts` |
| Quick run command | `npm --workspace apps/renderer run test -- --run aec-diagnostics ChatVoiceInput Settings` |
| Full suite command | `npm --workspace apps/renderer run test -- --run Settings ChatVoiceInput voice-input-store vad-controller aec-diagnostics ws-audio-player ws-store-audio voice-capture ChatStreaming` |
| Type check command | `npm --workspace apps/renderer run typecheck` |
| Estimated runtime | ~25 seconds |

---

## Sampling Rate

- After every task commit: run the quick command for the touched surface.
- After every plan wave: run the full suite command.
- Before `$gsd-verify-work`: full suite plus renderer typecheck must be green.
- Max feedback latency: ~30 seconds for the focused Phase 22 renderer suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 22-01 | 1 | AEC-01, AEC-04 | D-01, D-04, D-16, D-17, D-22, D-23 | Existing PTT/VAD capture requests AEC through the current renderer path and stores metadata only; VAD defaults stay conservative. | unit/component | `npm --workspace apps/renderer run test -- --run aec-diagnostics voice-capture vad-controller voice-input-store` | yes | green |
| 22-02-01 | 22-02 | 2 | AEC-02, AEC-04 | D-05, D-06, D-07, D-10, D-20 | Active renderer playback keeps speaking state true; VAD pauses during active TTS; final voice candidates queue instead of corrupting playback/order. | unit/component | `npm --workspace apps/renderer run test -- --run ws-audio-player ws-store-audio ChatVoiceInput ChatStreaming` | yes | green |
| 22-03-01 | 22-03 | 3 | AEC-02 | D-06, D-08, D-09, D-22 | No brittle content guard is added; existing pause/queue/stop/edit mitigations are locked by tests and documented in the guard decision. | unit/docs | `npm --workspace apps/renderer run test -- --run ChatVoiceInput ChatStreaming ws-audio-player ws-store-audio` | yes | green |
| 22-04-01 | 22-04 | 4 | AEC-03, AEC-04 | D-11..D-20, D-25 | Settings owns Ready/Limited/Unsafe status; Unsafe blocks VAD until explicit override; PTT remains available when STT is ready. | component/unit | `npm --workspace apps/renderer run test -- --run Settings voice-input-store ChatVoiceInput vad-controller` | yes | green |
| 22-05-01 | 22-05 | 5 | AEC-01, AEC-02, AEC-03, AEC-04 | D-01..D-04, D-21..D-25 | UAT verdict is recorded as Limited for the tested setup, Unsafe by default for unverified hardware, with no raw audio/TTS retained. | integration/docs/manual-backed | `npm --workspace apps/renderer run test -- --run Settings ChatVoiceInput voice-input-store vad-controller aec-diagnostics ws-audio-player ws-store-audio voice-capture ChatStreaming` | yes | green |

Status: green = automated command passed in this validation run.

---

## Requirement Coverage

| Requirement | Automated Coverage | Manual / Artifact Coverage | Status |
|-------------|--------------------|----------------------------|--------|
| AEC-01 | `aec-diagnostics.test.ts`, `voice-capture.test.ts`, `vad-controller.test.ts`, `voice-input-store.test.ts`, `Settings.test.tsx` cover AEC request/applied metadata capture and Settings display. | `22-UAT.md` records real PTT/VAD AEC observations; `22-AEC-DIAGNOSTICS.md` defines metadata-only boundary. | covered |
| AEC-02 | `ChatVoiceInput.test.tsx`, `ChatStreaming.test.tsx`, `ws-audio-player.test.ts`, and `ws-store-audio.test.ts` cover VAD pause, queued final transcripts, Stop, edit/regenerate, and playback lifecycle. | `22-UAT.md` records no assistant self-submit across active TTS, VAD, PTT, FunASR, faster-whisper, and OpenAI cloud STT paths. | covered |
| AEC-03 | `Settings.test.tsx` covers Ready/Limited/Unsafe labels, AEC diagnostics summary, Unsafe override, and Settings-only status surface. | `22-UAT.md` records the final verdict: Limited for the tested setup; Unsafe default for unverified hardware. | covered |
| AEC-04 | `voice-input-store.test.ts`, `vad-controller.test.ts`, `Settings.test.tsx`, and `ChatVoiceInput.test.tsx` cover conservative defaults, VAD explicit opt-in, Unsafe blocking, and PTT availability. | `22-SELF-SPEECH-GUARD-DECISION.md` and `22-UAT.md` document VAD pause as intentional safety behavior. | covered |

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 22 requirements.

- `apps/renderer/tests/aec-diagnostics.test.ts`
- `apps/renderer/tests/voice-capture.test.ts`
- `apps/renderer/tests/vad-controller.test.ts`
- `apps/renderer/tests/voice-input-store.test.ts`
- `apps/renderer/tests/ws-audio-player.test.ts`
- `apps/renderer/tests/ws-store-audio.test.ts`
- `apps/renderer/tests/ChatVoiceInput.test.tsx`
- `apps/renderer/tests/ChatStreaming.test.tsx`
- `apps/renderer/tests/Settings.test.tsx`

No new test stubs were required during this validation pass.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real no-headphones speaker/microphone behavior | AEC-01, AEC-02, AEC-03 | Browser AEC, room acoustics, selected microphone, speaker output, and cloud/local STT behavior are hardware/runtime dependent. | Use `22-UAT.md`: select physical microphone, keep speakers active, capture AEC metadata through PTT and VAD, test idle speech, active TTS, PTT during active TTS, Stop/edit recovery, local providers, and cloud STT when explicit credentials/consent are available. |
| Final product verdict | AEC-03, AEC-04 | The app must not infer Ready/Limited/Unsafe automatically from metadata; the shipped status comes from human UAT judgment. | Record verdict in `22-UAT.md` and ensure Settings defaults remain Unsafe unless the user verifies/overrides their setup. |

Manual rows are not unresolved gaps. They are the required empirical part of Phase 22 and are already recorded in `22-UAT.md`.

---

## Validation Commands Run

```powershell
npm --workspace apps/renderer run test -- --run Settings ChatVoiceInput voice-input-store vad-controller aec-diagnostics ws-audio-player ws-store-audio voice-capture ChatStreaming
npm --workspace apps/renderer run typecheck
```

Result:

- Renderer targeted tests: 9 files passed, 149 tests passed.
- Renderer typecheck: passed.

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Requirements audited | 4 |
| Automated coverage rows | 5 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Manual empirical rows | 2 |

---

## Validation Sign-Off

- [x] All tasks have automated verification or existing test infrastructure.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency < 30s.
- [x] `nyquist_compliant: true` set in frontmatter.

Approval: approved 2026-05-14
