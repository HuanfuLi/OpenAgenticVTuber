# Phase 22 Research: AEC Spike + No-Headphones Decision

**Phase:** 22 - AEC Spike + No-Headphones Decision
**Milestone:** v3.0 Rich Voice Configuration + Voice Input
**Date:** 2026-05-10
**Status:** Ready for planning

## Scope

Phase 22 decides, with evidence, whether no-headphones voice input can be labeled `Ready`, `Limited`, or `Unsafe`. It must prototype browser/WebRTC echo cancellation with the renderer microphone path, prevent assistant TTS from becoming final user input, keep VAD conservative, and record a structured UAT verdict.

This phase does not add STT providers, redesign Chat voice input, add wake words, add barge-in cancellation, translate transcripts, or build a runtime no-headphones classifier.

## Inputs

- `.planning/ROADMAP.md` Phase 22 goal and success criteria.
- `.planning/REQUIREMENTS.md` requirements `AEC-01` through `AEC-04`.
- `.planning/phases/22-aec-spike-no-headphones-decision/22-CONTEXT.md` user decisions `D-01` through `D-24`.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` STT readiness and no silent fallback policy.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md` PTT-first, VAD opt-in, final transcript submission, and no-AEC-claim boundaries.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-RESEARCH.md` renderer capture, WebRTC, and VAD notes.
- `.planning/phases/21-code-switch-evaluation-hardening/21-CONTEXT.md` no-translation and live Chat voice UAT expectations.

## WebRTC And Electron Findings

- `getUserMedia({ audio })` remains the renderer microphone entry point. It requires user permission and can fail for permission, missing device, hardware, or constraint reasons. Phase 22 should surface failure categories as diagnostics, not treat every failure as AEC failure.
- `echoCancellation` is a constraint, not a guarantee. The browser may ignore unsupported constraints, and exact required settings can fail. Code should request AEC and inspect `getSupportedConstraints()`, `track.getCapabilities()`, `track.getSettings()`, and applied constraints where available.
- Current media specs define `echoCancellation` values beyond boolean, including `"all"` and `"remote-only"`. `"all"` is intended to remove system-generated audio from the microphone signal; `true` lets the user agent decide and should attempt at least remote-only cancellation. Browser support varies, so Phase 22 should prefer capability-aware fallback over assuming `"all"` is always honored.
- Chrome/WebRTC AEC performance depends on the signal reaching the echo canceller cleanly. Chrome's own AEC notes warn that upstream hardware processing can impede cancellation. This reinforces the Phase 22 decision to use empirical UAT rather than static browser-capability claims.
- Electron media permission handling should use both `session.setPermissionRequestHandler` and `session.setPermissionCheckHandler` for complete behavior. For this app, any Phase 22 permission additions should stay scoped to the app renderer origin and audio media permission.
- Electron `desktopCapturer` is for desktop audio/video capture, not the primary mic path. Phase 22 should not depend on system-audio capture to prove no-headphones support, and macOS desktop audio behavior has caveats. The phase can correlate app TTS playback state without recording system output.

## Current System Facts

- `apps/renderer/src/ws/store.ts` sets `isSpeaking` true when audio payload playback starts and false on chain-end/error. This is a useful existing signal, but Phase 22 may need more precise playback-start/playback-end events from `audio-player.ts` if active-TTS windows need to cover queued audio accurately.
- `apps/renderer/src/ws/audio-player.ts` owns browser `Audio` playback and queueing for TTS payloads. It is the best renderer-side place to publish playback lifecycle events for self-speech guard correlation.
- `Chat.tsx` submits typed text through `text-input`; Phase 20 plans route final STT text through the same path. Phase 22 must put the self-speech guard before that final submission path.
- `safe-storage.ts` currently stores `audio.stt` with only basic enabled/provider/capture timeout fields. If Phase 20 has not already added voice-input settings, Phase 22 needs to extend the shared audio config for no-headphones status, override, AEC constraints/diagnostics, and VAD tuning persistence.
- `Settings.tsx` already has long-scroll audio/provider sections, health rows, and diagnostics/open-log patterns. No-headphones status should use that existing Settings style, with concise `Ready` / `Limited` / `Unsafe` copy.

## Planning Decisions

1. Start Phase 22 by discovering actual Phase 19-21 outputs and adapting names. Plans should not assume planned Phase 20 files already exist with exact names.
2. Add a small AEC capture diagnostics layer around the existing renderer mic capture path. It should request echo cancellation, inspect support/settings, and produce redacted metadata only.
3. Add no-headphones status and override configuration to shared audio/voice settings if not already present.
4. Add a provider-independent self-speech guard before final Chat submission. The guard should correlate active TTS windows and recent assistant text, conservatively discard assistant-overlap transcripts, and log redacted diagnostics.
5. Keep Chat UI free of no-headphones status copy. Settings owns status and override; Chat only observes whether controls are enabled/disabled by voice state.
6. Preserve VAD opt-in and conservative initial defaults even when the UAT verdict is `Ready`. Persist user tuning only after successful use.
7. Close Phase 22 with a structured UAT document. It should record environment, test matrix, diagnostics, final `Ready` / `Limited` / `Unsafe` verdict, and limitations without retaining raw audio.

## Risks

| Risk | Mitigation |
|------|------------|
| Browser reports AEC support but real no-headphones behavior fails | Treat browser support as diagnostic metadata only; final status comes from UAT verdict. |
| `"all"` echo cancellation is unsupported or ignored | Try capability-aware constraints, fall back to boolean `true`, and record actual settings/capabilities. |
| Active-TTS signal ends before queued audio playback truly stops | Publish playback lifecycle from `audio-player.ts` if `isSpeaking` is too coarse. |
| Self-speech guard drops a real user overlap utterance | Conservative discard is intentional per D-06; log redacted diagnostics and do not show discarded transcript. |
| Settings status becomes a runtime classifier | Store configured status from UAT verdict; do not continuously auto-decide `Ready` / `Limited` / `Unsafe`. |
| Raw audio accidentally lands in git | UAT docs must store metadata only; if local debugging audio is created outside normal flow, keep it ignored and out of committed artifacts. |

## Recommended Plan Shape

- Plan 22-01: Add AEC diagnostics/status contracts and capture instrumentation.
- Plan 22-02: Add self-speech guard and active-TTS correlation before final Chat submission.
- Plan 22-03: Add Settings no-headphones status, override, and VAD default policy.
- Plan 22-04: Run/document structured UAT and set the shipped no-headphones verdict.

## Verification Focus

- `AEC-01`: browser/WebRTC echo cancellation requested and real diagnostics recorded.
- `AEC-02`: assistant TTS cannot become final user input through VAD or STT.
- `AEC-03`: Settings shows truthful `Ready`, `Limited`, or `Unsafe` no-headphones status.
- `AEC-04`: VAD defaults remain opt-in and conservative unless user tuning is explicitly persisted after successful use.

## Sources

- MDN `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN `echoCancellation`: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation
- W3C Media Capture and Streams `echoCancellation`: https://w3c.github.io/mediacapture-main/
- Electron `session` permission handlers: https://www.electronjs.org/docs/latest/api/session
- Electron `desktopCapturer`: https://www.electronjs.org/docs/latest/api/desktop-capturer
- Chrome Developers, hardware noise suppression and AEC: https://developer.chrome.com/blog/disabling-hardware-noise-suppression/
- Chrome Developers, native echo cancellation notes: https://developer.chrome.com/blog/more-native-echo-cancellation/
