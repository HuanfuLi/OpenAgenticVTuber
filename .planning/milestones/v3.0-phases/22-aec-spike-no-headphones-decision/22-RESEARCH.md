# Phase 22 Research: AEC Spike + No-Headphones Decision

**Phase:** 22 - AEC Spike + No-Headphones Decision  
**Milestone:** v3.0 Rich Voice Configuration + Voice Input  
**Original Date:** 2026-05-10  
**Updated:** 2026-05-13 after Phase 20.2 and Phase 21 closure  
**Status:** Used for regenerated Phase 22 plans

## Scope

Phase 22 decides, with evidence, whether no-headphones voice input can be labeled `Ready`, `Limited`, or `Unsafe`. It must inspect and record browser/WebRTC echo-cancellation behavior on the shipped renderer microphone path, test assistant self-speech risk across VAD/PTT/local/cloud STT paths, keep VAD conservative, and produce a structured UAT verdict.

This phase does not add STT providers, redesign Chat voice input, reintroduce live preview transcription, add wake words, add barge-in cancellation, translate transcripts, or build a runtime no-headphones classifier.

## Inputs

- `.planning/ROADMAP.md` Phase 22 goal and success criteria.
- `.planning/REQUIREMENTS.md` requirements `AEC-01` through `AEC-04`.
- `.planning/STATE.md` current project state after Phase 21 completion.
- `.planning/phases/22-aec-spike-no-headphones-decision/22-CONTEXT.md` refreshed Phase 22 decisions.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-UAT.md` local/cloud STT evidence and cloud skip boundaries.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-UAT.md` PTT/VAD live behavior, VAD observability, and queue-ordering fixes.
- `.planning/phases/20.1-settings-ux-refactor-enablement-simplification/` Settings simplification and faster-whisper CUDA runtime closure.
- `.planning/phases/20.2-cpu-local-stt-enhancement/` final-only STT, Stop, and edit/regenerate implementation.
- `.planning/phases/21-code-switch-evaluation-hardening/21-UAT.md` final STT quality and microphone-source isolation evidence.

## WebRTC And Electron Findings

- `getUserMedia({ audio })` remains the renderer microphone entry point. It requires user permission and can fail for permission, missing device, hardware, or constraint reasons. Phase 22 should surface failure categories as diagnostics, not treat every failure as AEC failure.
- `echoCancellation` is a constraint, not a guarantee. The browser may ignore unsupported constraints, and exact required settings can fail. Code should request AEC and inspect `getSupportedConstraints()`, `MediaStreamTrack.getCapabilities()`, `getConstraints()`, and `getSettings()` where available.
- Current media specs define `echoCancellation` values beyond boolean, including `"all"` and `"remote-only"`. `"all"` is intended to remove system-generated audio from the microphone signal, but browser support varies. Phase 22 should use capability-aware fallback rather than assuming `"all"` is honored.
- Chrome/WebRTC AEC performance depends on the signal reaching the echo canceller cleanly. Upstream hardware processing, driver effects, selected input source, speaker volume, and room acoustics can materially change results. This reinforces that final status must come from UAT, not browser support alone.
- Electron media permission handling is already present for microphone readiness. Any Phase 22 permission changes should stay scoped to the app renderer origin and audio media permission.
- Electron `desktopCapturer` is for desktop audio/video capture, not the primary mic path. Phase 22 should not depend on recording system output to prove no-headphones support.

## Current System Facts

- `apps/renderer/src/state/audio-settings.ts` already requests `echoCancellation: { ideal: true }`, `noiseSuppression: { ideal: true }`, and mono channel constraints for voice input. Phase 22 should add diagnostics around what is supported/applied, not blindly duplicate capture logic.
- The same file stores selected microphone state in renderer local storage and flags likely system/loopback audio inputs. Phase 21 closed the background-video/system-audio capture bug by requiring the user to pick a physical microphone input.
- `apps/renderer/src/audio/voice-capture.ts` owns PTT/final recording and calls `applyFinalResult()` with final STT output. It is the correct capture path to instrument for AEC diagnostics.
- `apps/renderer/src/audio/vad-controller.ts` monitors RMS and uses `shouldIgnoreSpeech()` to avoid starting recording during active turns. Current no-headphones testing must treat this as intended safety behavior.
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx` passes `turnInProgressRef.current` into VAD as `shouldIgnoreSpeech()` and shows `VAD paused` when a turn is active. This means VAD does not currently submit user overlap speech while Teto is speaking.
- `apps/renderer/src/screens/Chat/Chat.tsx` queues final voice candidates when input is disabled or speaking is active, then promotes the queued candidate only after input/speaking/settlement clears. This shipped queueing behavior is part of the Phase 22 baseline.
- `apps/renderer/src/screens/Chat/Chat.tsx` also includes Stop during active turns and edit/regenerate for sent messages, including stopped-message restart metadata from Phase 20.2 gap closure. Phase 22 UAT must ensure AEC/no-headphones work does not regress these recovery paths.
- `apps/renderer/src/ws/store.ts` sets speaking true when audio payloads arrive and false on chain-end/error. `apps/renderer/src/ws/audio-player.ts` owns actual queued browser audio playback. If UAT finds speaking windows are imprecise, add playback lifecycle diagnostics/subscriptions in `audio-player.ts`.
- `apps/renderer/src/screens/Settings/VoiceInputSection.tsx` and `Settings.tsx` are the current Settings surfaces for voice input. No-headphones status belongs here, not in Chat.

## Research Conclusions

1. **Planning must be regenerated.** Existing Phase 22 plan files predate Phase 20.2/21 gap closures and over-assume a new self-speech guard as the central implementation. They should be deleted and replaced.
2. **The first implementation slice should be an audit/instrumentation slice.** Add AEC diagnostics to the current renderer capture constraints and record supported/requested/applied settings without storing raw audio.
3. **The second slice should validate existing safety behavior before adding new behavior.** Current VAD pause, final transcript queueing, Stop, and edit/regenerate are deliberate mitigations. Test them before deciding a self-speech guard is required.
4. **A self-speech guard is conditional.** If assistant speech can still enter Chat through PTT, queued final STT, imprecise speaking windows, or provider latency, add a deterministic provider-independent guard before final Chat submission. Do not add an LLM-based semantic matcher.
5. **Settings status should be configured from UAT verdict.** The app should show `Ready`, `Limited`, or `Unsafe` in Settings based on Phase 22 evidence. It should not continuously infer status at runtime.
6. **VAD remains conservative.** VAD stays explicit opt-in. `Ready` can reduce warning severity, but it must not auto-enable VAD.
7. **Selected microphone matters.** No-headphones UAT is only meaningful with a physical microphone selected. Loopback/system-audio input invalidates AEC/no-headphones conclusions and should be recorded as a setup failure, not an AEC result.

## Risks

| Risk | Mitigation |
|------|------------|
| Browser reports AEC support but real no-headphones behavior fails | Treat browser support as diagnostic metadata only; final status comes from UAT verdict. |
| Existing `echoCancellation: true` gives a false sense of support | Add diagnostics for supported/requested/applied constraints and record real no-headphones UAT. |
| Current `isSpeaking` state is coarser than actual queued audio playback | Add `audio-player.ts` lifecycle diagnostics/subscriptions if tests show active-TTS windows are inaccurate. |
| VAD pause is mistaken for broken VAD | Document that VAD paused during active turns is expected safety behavior and include it in UAT expectations. |
| Self-speech guard drops real user speech | Only add the guard if evidence shows it is needed; keep it deterministic, conservative, and redacted. |
| Loopback/system-audio device contaminates results | Require selected physical microphone for UAT and record device/setup notes. |
| Settings status becomes a runtime classifier | Store/display configured status from UAT verdict; do not continuously auto-decide `Ready`/`Limited`/`Unsafe`. |
| Raw audio accidentally lands in git | UAT docs store metadata only. Any temporary debugging audio must stay outside normal evidence and out of git. |

## Recommended Replanned Shape

- Plan 22-01: Current audio-path audit plus AEC diagnostics on existing renderer capture constraints.
- Plan 22-02: Active-TTS/VAD/PTT safety verification using current pause, queue, Stop, and edit/regenerate behavior; add precise playback lifecycle diagnostics if current speaking state is insufficient.
- Plan 22-03: Conditional self-speech guard only if 22-02 evidence shows assistant speech can enter final Chat submission.
- Plan 22-04: Settings no-headphones status/override/default policy based on `Ready`, `Limited`, `Unsafe`.
- Plan 22-05: Structured real-world UAT, final verdict, verification notes, and requirement closure.

The planner may merge or split these slices, but must preserve the ordering: audit current paths, test existing mitigations, add guard only if needed, then set truthful Settings status from evidence.

## Verification Focus

- `AEC-01`: browser/WebRTC echo cancellation is requested through the shipped renderer microphone path, and diagnostics record supported/requested/applied behavior.
- `AEC-02`: assistant TTS does not become submitted user input through VAD, PTT, local STT, or explicitly configured cloud STT.
- `AEC-03`: Settings shows truthful `Ready`, `Limited`, or `Unsafe` no-headphones status from UAT evidence.
- `AEC-04`: VAD defaults remain opt-in and conservative unless user tuning is explicitly persisted after successful use.

## UAT Matrix Updates Needed

The final UAT document should include at least:

- Physical microphone selected; loopback/system-audio input not selected.
- AEC diagnostics captured for the selected input.
- PTT no-headphones while Teto is idle.
- VAD no-headphones while Teto is idle.
- TTS active with no user speech: assistant speech must not submit as user text.
- TTS active with VAD enabled: VAD paused/ignored state is visible and does not submit.
- PTT during active TTS: final transcript queues or submits only according to the current Chat safety rules, with no assistant self-submit.
- Stop during active Thinking/streaming/TTS still cancels and unlocks edit.
- Edit/regenerate still works after normal and stopped voice turns.
- FunASR local path tested.
- faster-whisper local path tested or explicitly scoped as lower-quality fallback.
- Cloud STT tested only if credentials and explicit consent are available; otherwise mark skipped with automated consent/redaction coverage.
- Settings status and override behavior checked after verdict.

## Sources

- MDN `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN `echoCancellation`: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation
- W3C Media Capture and Streams `echoCancellation`: https://w3c.github.io/mediacapture-main/
- Electron `session` permission handlers: https://www.electronjs.org/docs/latest/api/session
- Electron `desktopCapturer`: https://www.electronjs.org/docs/latest/api/desktop-capturer
- Chrome Developers, hardware noise suppression and AEC: https://developer.chrome.com/blog/disabling-hardware-noise-suppression/
- Chrome Developers, native echo cancellation notes: https://developer.chrome.com/blog/more-native-echo-cancellation/
