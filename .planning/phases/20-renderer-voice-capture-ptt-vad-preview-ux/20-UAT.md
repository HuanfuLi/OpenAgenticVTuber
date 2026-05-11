# Phase 20 UAT: Renderer Voice Capture + PTT/VAD Preview UX

**Date:** 2026-05-11  
**Environment:** Headless automated executor on Windows; renderer/electron/sidecar regression commands run locally.  
**Provider:** Automated tests use mocked renderer readiness/transcription. Sidecar regressions use the existing Phase 19 STT test fixtures.  
**Manual live microphone status:** Not run in this headless executor. Items below include automated evidence and the exact live checks still expected before user acceptance.

## Automated Evidence

| Check | Evidence | Status |
|-------|----------|--------|
| VIN-01 microphone readiness/state surfaces | `npm --workspace apps/renderer run test -- --run ChatVoiceInput` | PASS |
| VIN-02 PTT preview/final path | `npm --workspace apps/renderer run test -- --run voice-capture`; `npm --workspace apps/renderer run test -- --run ChatVoiceInput` | PASS |
| VIN-03 VAD opt-in, sensitivity, silence timeout, auto-finalize | `npm --workspace apps/renderer run test -- --run vad-controller`; `npm --workspace apps/renderer run test -- --run Settings` | PASS |
| VIN-04 preview/finalizing/error distinct from submitted chat text | `npm --workspace apps/renderer run test -- --run ChatVoiceInput` | PASS |
| VIN-05 final transcript submitted unchanged through `text-input` | `npm --workspace apps/renderer run test -- --run ChatVoiceInput` | PASS |
| VIN-06 active turn queueing without playback interruption | `npm --workspace apps/renderer run test -- --run ChatVoiceInput`; `npm --workspace apps/renderer run test -- --run ChatStreaming` | PASS |
| No wake word, no barge-in cancellation, no no-headphones/AEC claim | VAD tests assert no wake-word surface; copy scan shows only Phase 22 deferral/no-headphones warning | PASS |
| GAP-20-01/03 readiness recovery and stale Chat error clearing | `npm --workspace apps/renderer run test -- --run voice-input-store`; `npm --workspace apps/renderer run test -- --run ChatVoiceInput` | PASS |
| GAP-20-02 successful STT test readiness persists on save | `npm --workspace apps/renderer run test -- --run Settings` | PASS |
| GAP-20-04 fake model download removed | `cd sidecar; uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt -q`; `npm --workspace apps/renderer run test -- --run Settings` | PASS |
| GAP-20-05 VAD copy separated from STT model cache | `npm --workspace apps/renderer run test -- --run Settings`; renderer copy inspection | PASS |

## Required Regression Results

- `npm --workspace apps/renderer run test -- --run voice-capture` - PASS, 5 tests.
- `npm --workspace apps/renderer run test -- --run vad-controller` - PASS, 7 tests.
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput` - PASS, 14 tests.
- `npm --workspace apps/renderer run test -- --run ChatStreaming` - PASS, 8 tests.
- `npm --workspace apps/renderer run test -- --run Settings` - PASS, 63 tests.
- `npm --workspace apps/renderer run typecheck` - PASS.
- `npm --workspace apps/electron-main run build` - PASS.
- `cd sidecar; uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt -q` - PASS, 20 tests.

## Manual Checks

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| UAT-20-01 | Microphone permission grant | Launch app, enable a ready STT provider, press the Chat mic button, grant mic permission. | Chat voice control shows ready/listening/recording states and records only after permission. | PENDING - requires live app and microphone |
| UAT-20-02 | Microphone permission deny | Deny the mic permission prompt, then press the Chat mic button again. | Visible permission-needed/error state; no recording starts. | PENDING - requires live app and OS permission prompt |
| UAT-20-03 | PTT preview and final submission | Hold PTT, speak an utterance, release. | Preview is shown outside chat bubbles; final transcript appears as a submitted user turn only after finalization. | PENDING - requires live microphone/STT |
| UAT-20-04 | VAD enable and auto-submit | In Settings, enable VAD, keep low sensitivity and 1800 ms timeout, then speak and stop. | VAD shows listening/recording/finalizing states and submits only after silence timeout. | PENDING - requires live microphone/STT |
| UAT-20-05 | VAD sensitivity and timeout | Change sensitivity and silence timeout in Settings, repeat VAD speech/silence. | Higher sensitivity reacts to quieter speech; timeout changes finalization delay. | PENDING - requires live microphone/STT |
| UAT-20-06 | Preview isolation | Speak with PTT or VAD and inspect chat history before finalization. | Preview text is absent from conversation history and chat bubbles. | PENDING - requires live microphone/STT |
| UAT-20-07 | Final text unchanged | Submit Chinese, English, and mixed Chinese/English utterances. | Final text enters chat unchanged; no translation or language normalization is applied. | PENDING - requires live microphone/STT |
| UAT-20-08 | Active-turn queueing | Start a Teto reply/speaking state, then capture speech with PTT or VAD. | Voice final transcript queues until active turn/speaking clears; playback is not canceled or interrupted. | PENDING - requires live app playback |
| UAT-20-09 | No AEC/no-headphones claim | Inspect Chat and Settings copy. | Copy states no-headphones echo handling is deferred to Phase 22; no AEC success claim appears. | PASS automated copy inspection; live visual confirmation pending |
| UAT-20-10 | Startup sidecar readiness recovery | Launch app before sidecar is ready, wait for sidecar-ready/reconnect. | Any startup `Sidecar is not ready.` message clears after fresh ready response; PTT enables if STT readiness and permission are valid. | PASS automated regression; live confirmation pending |
| UAT-20-11 | STT test + save enables Chat PTT | In Settings, run a successful STT test, save Voice settings, then return to Chat. | Chat refreshes readiness and does not keep stale `Voice input is disabled in Voice settings.` text. | PASS automated regression; live confirmation pending |
| UAT-20-12 | Truthful STT model cache action | In Settings, inspect local STT model cache and click the model action. | UI does not claim instant model download; it reports automatic download unavailable/manual setup until real model files exist. | PASS automated regression; live confirmation pending |
| UAT-20-13 | VAD/model copy separation | Inspect Voice settings VAD and STT model cache areas. | VAD copy says browser volume/silence detection with no VAD model; STT cache is labeled separately. | PASS automated regression; live visual confirmation pending |

## Notes

- VAD remains explicit opt-in and disabled by default.
- VAD monitoring is conservative: default sensitivity is `low`, default silence timeout is `1800 ms`, and speech detected while Teto is speaking is ignored rather than treated as a user turn.
- Phase 20 does not implement wake word, barge-in cancellation, or an evidence-backed no-headphones mode. Those remain future/Phase 22 scope.
