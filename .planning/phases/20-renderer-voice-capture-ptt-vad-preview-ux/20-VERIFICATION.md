---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
verified: 2026-05-11T05:47:35Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live microphone PTT capture"
    expected: "Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn."
    why_human: "Requires a live app session, OS microphone permission prompt, microphone hardware, and a ready STT provider."
  - test: "Live microphone VAD auto-submit"
    expected: "Opt-in VAD listens, records on speech, finalizes after configured silence, and submits only final text."
    why_human: "Requires real-time audio input and timing behavior that the headless automated runner cannot observe."
  - test: "Live active-turn playback queue"
    expected: "Speech captured while Teto is speaking queues until the current turn/playback clears and does not interrupt audio."
    why_human: "Requires live renderer playback state and audible/visual confirmation."
---

# Phase 20: Renderer Voice Capture + PTT/VAD Preview UX Verification Report

**Phase Goal:** Users can talk to the avatar through push-to-talk or VAD, see transient transcription preview, and submit final transcripts through the existing chat pipeline unchanged.  
**Verified:** 2026-05-11T05:47:35Z  
**Status:** human_needed  
**Re-verification:** No - initial verification

## Goal Achievement

Automated verification passes for all roadmap success criteria and VIN-01 through VIN-06. The remaining risk is live hardware/user-flow validation: `20-UAT.md` correctly marks microphone and live playback checks as pending in the headless executor.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can grant microphone permission and see idle/listening/recording/finalizing/error states. | VERIFIED | Electron permission handlers are scoped in `apps/electron-main/src/voice-input-permissions.ts:34-69`; preload exposes readiness/permission/transcribe in `apps/electron-main/preload/index.ts:142-148`; Chat refreshes readiness and requests permission in `apps/renderer/src/screens/Chat/VoiceInputControl.tsx:96-129`. |
| 2 | User can hold PTT, speak, see preview chunks, and submit only the final transcript. | VERIFIED | `VoiceCapture` starts on explicit action, emits preview requests, and finalizes separately in `apps/renderer/src/audio/voice-capture.ts`; Chat preview renders outside bubbles at `VoiceInputControl.tsx:262-268`; final candidates are handled by `Chat.tsx:104-113`. |
| 3 | User can enable VAD auto-submit with visible sensitivity and silence-timeout controls. | VERIFIED | VAD defaults are disabled/low/1800 ms in `apps/renderer/src/state/audio-settings.ts:14-21`; Settings exposes enable/sensitivity/timeout in `apps/renderer/src/screens/Settings/VoiceInputSection.tsx`; Chat starts `VadController` only after opt-in/readiness/permission in `VoiceInputControl.tsx:155-185`. |
| 4 | Preview text never appears in conversation history; only final STT text enters the existing chat pipeline unchanged with no translation. | VERIFIED | Preview is transient store state in `apps/renderer/src/state/voice-input-store.ts:108-133`; final text uses the same `appendUserMessage` plus `type: 'text-input'` helper as typed input in `apps/renderer/src/screens/Chat/Chat.tsx:77-93`; no translation/normalization field exists in voice contracts. |
| 5 | Speech captured while a turn is in progress queues safely instead of corrupting active TTS/playback state. | VERIFIED | Final candidates queue when `inputDisabled` or `isSpeaking` is true in `Chat.tsx:104-135`; VAD ignores speech while a turn is active via `shouldIgnoreSpeech` in `VoiceInputControl.tsx:169` and `VadController.ts:154-171`; no playback/TTS cancel call was added. |
| 6 | VIN-01 microphone permission/listening state is covered. | VERIFIED | Permission/readiness state crosses Electron IPC, sidecar readiness, store state, and Chat UI; tests pass in `ChatVoiceInput`, `voice-capture`, and `ipc-voice-input`. |
| 7 | VIN-02 PTT preview/final behavior is covered. | VERIFIED | PTT pointer/shortcut handlers call capture start/stop in `VoiceInputControl.tsx:204-243`; preview/final paths are separate in store and tests. |
| 8 | VIN-03 VAD controls and auto-submit are covered. | VERIFIED | `VadController` starts recording on threshold and stops after silence timeout; Settings and Chat tests cover disabled-by-default, opt-in, sensitivity, and timeout behavior. |
| 9 | VIN-04 preview/finalizing/error states are distinct from submitted chat text. | VERIFIED | `VoiceInputControl.tsx:262-288` renders preview/finalizing/queued/error surfaces outside chat bubbles; `ChatVoiceInput.test.tsx:346-356` asserts preview is not a bubble and does not commit history. |
| 10 | VIN-05 final STT text enters existing chat unchanged. | VERIFIED | `Chat.tsx:77-93` trims only for empty-submission semantics, then sends the same `text-input` envelope used by typed chat; `ChatVoiceInput.test.tsx:359-370` asserts mixed Chinese/English text is unchanged. |
| 11 | VIN-06 active-turn queueing is covered. | VERIFIED | One-slot queue exists in `voice-input-store.ts:152-195`; `ChatVoiceInput.test.tsx:380-419` covers queued send-after-turn and cancel without playback state mutation. |

**Score:** 11/11 truths verified by code inspection and automated tests.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/contracts/py/contracts/audio_provider.py` and generated TS/schema | Voice input readiness and preview/final transcription contracts | VERIFIED | Capture statuses, preview/final mode, transcript result, and readiness types exist; `npm run check:contracts` passed. |
| `apps/electron-main/src/voice-input-permissions.ts` | Narrow microphone permission handling | VERIFIED | Allows only app-origin audio media permission and denies unrelated origins/permissions. |
| `apps/electron-main/preload/index.ts` and `apps/electron-main/src/ipc.ts` | Typed preload-mediated voice bridge | VERIFIED | Renderer calls `window.api`; IPC proxies to `/admin/audio/voice-input/readiness` and `/admin/audio/voice-input`. |
| `sidecar/src/sidecar/admin/audio.py` | Runtime voice transcription through Phase 19 readiness/provider | VERIFIED | `_voice_input_readiness` gates disabled/unready STT; `/voice-input` builds the selected provider and returns preview/final result. |
| `apps/renderer/src/audio/voice-capture.ts` | PTT capture, preview chunks, final transcription, cleanup | VERIFIED | Uses explicit `getUserMedia`, MediaRecorder preview chunks, final transcription, sequence IDs, and track cleanup. |
| `apps/renderer/src/audio/vad-controller.ts` | Conservative VAD auto-submit controller | VERIFIED | Uses Web Audio RMS thresholds, configured silence timeout, and active-speaking suppression. |
| `apps/renderer/src/state/voice-input-store.ts` | Transient preview, final candidate, one queued final slot | VERIFIED | Preview state is not persisted; final and queued candidate helpers are separate. |
| `apps/renderer/src/screens/Chat/VoiceInputControl.tsx` | Chat mic/PTT/VAD control and preview/queue UI | VERIFIED | Visible mic control, setup/error state, preview, finalizing, queued and VAD blocked surfaces exist. |
| `apps/renderer/src/screens/Settings/VoiceInputSection.tsx` | PTT shortcut and VAD settings | VERIFIED | Settings-only shortcut, VAD enable, sensitivity, and silence timeout controls exist. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Renderer capture | Electron preload | `window.api.transcribeVoiceInput` | WIRED | `VoiceCapture` defaults to `window.api.transcribeVoiceInput`; preload invokes `voiceInput:transcribe`. |
| Electron IPC | Sidecar voice route | Admin HTTP proxy | WIRED | `ipc.ts:587-619` posts readiness and transcription to sidecar admin endpoints. |
| Sidecar route | Phase 19 STT provider | `STTProviderRegistry().build_provider(payload.config)` | WIRED | `audio.py:567-568` builds/transcribes with selected config; tests assert selected provider without fallback. |
| Chat final transcript | Existing text input pipeline | Shared `submitFinalText` helper | WIRED | `Chat.tsx:77-93` sends `type: 'text-input'` with active session id and history for typed and voice final text. |
| Preview state | Conversation history | No direct commit path | WIRED | Preview remains in `voice-input-store.ts`; only final candidate submission calls `appendUserMessage`. |
| VAD controller | PTT/final submit path | `startRecording`/`stopRecording` hooks | WIRED | `VoiceInputControl.tsx:161-185` wires VAD to the same `VoiceCapture` start/stop path. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `VoiceInputControl.tsx` | `voice.previewTranscript` | `VoiceCapture.transcribePreview` -> `window.api.transcribeVoiceInput` -> sidecar STT provider | Yes, selected STT provider result; tests also mock real non-empty transcript flow. | FLOWING |
| `Chat.tsx` | `voice.finalCandidate.transcript` | `VoiceCapture.finalizeRecording` -> `applyFinalResult` -> shared `submitFinalText` | Yes, sidecar final result is submitted as existing text input. | FLOWING |
| `Chat.tsx` | `voice.queuedFinalCandidate` | `applyFinalResult(..., turnInProgress)` or `queueFinalCandidate` | Yes, queued candidate is promoted and submitted after active turn clears. | FLOWING |
| `VoiceInputSection.tsx` | `settings.vad.*` and `settings.pttShortcut` | Renderer local settings load/save and subscription | Yes, Settings tests verify persisted controls and defaults. | FLOWING |
| `sidecar/admin/audio.py` | `stt_result.text` | `STTProviderRegistry().build_provider(payload.config).transcribe(...)` | Yes, endpoint dispatches to configured provider and returns provider transcript. | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Chat voice UI, preview isolation, unchanged final text, queueing | `npm --workspace apps/renderer run test -- --run ChatVoiceInput` | 13 tests passed | PASS |
| Renderer capture controller | `npm --workspace apps/renderer run test -- --run voice-capture` | 5 tests passed | PASS |
| VAD controller | `npm --workspace apps/renderer run test -- --run vad-controller` | 7 tests passed | PASS |
| Electron voice input IPC/permission | `npm --workspace apps/electron-main run test -- --run voice-input` | 4 tests passed | PASS |
| Settings voice controls | `npm --workspace apps/renderer run test -- --run Settings` | 61 tests passed | PASS |
| Chat streaming regression | `npm --workspace apps/renderer run test -- --run ChatStreaming` | 8 tests passed | PASS |
| Chat regression | `npm --workspace apps/renderer run test -- --run Chat` | 3 files, 32 tests passed | PASS |
| Renderer typecheck | `npm --workspace apps/renderer run typecheck` | Passed | PASS |
| Electron build | `npm --workspace apps/electron-main run build` | Passed | PASS |
| Sidecar voice input and STT tests | `uv run pytest tests/admin/test_audio_voice_input_endpoint.py tests/stt -q` from `sidecar/` | 15 tests passed | PASS |
| Contract consistency | `npm run check:contracts` | Passed, no generated contract diff | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| VIN-01 | 20-01, 20-02, 20-03, 20-04 | User can grant microphone permission and see current microphone/listening state. | SATISFIED | Permission handlers, readiness IPC, store state, Chat labels, and permission/no-device tests. |
| VIN-02 | 20-01, 20-02, 20-03, 20-04 | User can use PTT to record, preview chunks, and submit only final transcript. | SATISFIED | PTT handlers, `VoiceCapture`, transient preview store, final candidate submission, and ChatVoiceInput tests. |
| VIN-03 | 20-02, 20-04 | User can enable VAD auto-submit with visible sensitivity and silence-timeout controls. | SATISFIED | Settings controls, conservative defaults, `VadController`, and VAD tests. |
| VIN-04 | 20-01, 20-02, 20-03, 20-04 | User sees recording/preview/finalizing/error states distinct from submitted chat text. | SATISFIED | Chat UI renders state labels/previews outside bubbles; tests assert preview isolation. |
| VIN-05 | 20-01, 20-03, 20-04 | Final STT text enters existing chat pipeline unchanged with no translation. | SATISFIED | Shared `submitFinalText` sends `text-input`; tests assert mixed-language text unchanged. |
| VIN-06 | 20-03, 20-04 | Speech captured during active turn queues safely instead of corrupting TTS/playback. | SATISFIED | Queue state and Chat promotion logic; tests cover queue send/cancel and streaming regression. |

No orphaned Phase 20 VIN requirements were found in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `sidecar/src/sidecar/admin/audio.py` | 633 | Existing `download_placeholder` model-cache helper | INFO | Existing Phase 19 model-cache behavior, not used by Phase 20 runtime voice-input transcription path verified here. |

No Phase 20 blocker stubs, placeholder UI, hardcoded empty data flow, or console-only handlers were found in the verified voice-input paths.

### Human Verification Required

#### 1. Live Microphone PTT Capture

**Test:** Launch the app with a ready STT provider, grant microphone permission, hold PTT, speak, release.  
**Expected:** Chat shows recording/preview/finalizing states, preview stays outside chat bubbles, and one final user turn is submitted.  
**Why human:** Requires microphone hardware, OS permission UI, live renderer app, and real STT provider behavior.

#### 2. Live Microphone VAD Auto-Submit

**Test:** Enable VAD in Settings with low sensitivity and 1800 ms timeout, speak, then stop.  
**Expected:** VAD listens, records on speech, finalizes after silence timeout, and submits only the final transcript.  
**Why human:** Requires real-time audio level and timing behavior not observable in this headless run.

#### 3. Live Active-Turn Playback Queue

**Test:** Start a Teto response with audible playback, then capture speech via PTT or VAD while playback is active.  
**Expected:** The voice final transcript queues until the active turn/speaking state clears; active playback is not canceled or interrupted.  
**Why human:** Requires live playback and user-observable interruption check.

### Gaps Summary

No code gaps were found. Automated verification passes for all Phase 20 must-haves. Overall status is `human_needed` because the live microphone and live playback UAT remains pending in `20-UAT.md`.

### Boundary Checks

- VAD is explicit opt-in and conservative by default: disabled, low sensitivity, 1800 ms silence timeout.
- No wake-word implementation was found.
- No barge-in or active TTS/playback cancellation was added.
- No no-headphones/AEC success claim was added; copy states no-headphones echo handling is deferred to Phase 22.
- Phase 21 code-switch evaluation and Phase 22 AEC/no-headphones evidence remain correctly outside Phase 20 scope.

---

_Verified: 2026-05-11T05:47:35Z_  
_Verifier: the agent (gsd-verifier)_
