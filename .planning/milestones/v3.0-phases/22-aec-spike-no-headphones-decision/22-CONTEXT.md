# Phase 22: AEC Spike + No-Headphones Decision - Context

**Gathered:** 2026-05-10T02:03:27.0123488-04:00  
**Updated:** 2026-05-13 after Phases 20, 20.1, 20.2, and 21 closure  
**Status:** Context refreshed; Phase 22 plans regenerated

<domain>
## Phase Boundary

Phase 22 empirically decides whether no-headphones voice input can be described as `Ready`, `Limited`, or `Unsafe`. It prototypes and records browser/WebRTC echo-cancellation behavior on the shipped renderer microphone path, tests whether assistant TTS can become user input, and updates Settings with truthful no-headphones status.

This phase consumes the current shipped behavior from Phases 19 through 21:

- Phase 19: STT provider abstraction, local/cloud provider readiness, local model cache controls, explicit cloud consent, and no silent fallback.
- Phase 20: renderer microphone capture, PTT, conservative opt-in VAD, VAD observability, active-turn queueing, and final-text submission through the existing Chat path.
- Phase 20.1: Settings refactor, optional standalone tests, simplified enablement, normalized provider activation, and faster-whisper CUDA runtime validation.
- Phase 20.2: final-only STT, faster-whisper CPU warm reuse/tuning, Stop button during active turns, and sent-message edit/regenerate for STT typo recovery.
- Phase 21: final-transcript code-switch evaluation, provider recommendation evidence, and microphone source isolation so STT captures the selected physical input instead of system/loopback audio.

Phase 22 does not add new STT providers, reintroduce live preview transcription, redesign Chat voice input, add wake words, add barge-in cancellation, translate transcripts, silently fall back to cloud STT, or promise perfect no-headphones behavior without evidence.

</domain>

<current_baseline>
## Current Shipped Baseline To Test

Phase 22 planning and execution must read the current code before implementation. The important current integration points are:

- `apps/renderer/src/state/audio-settings.ts`
  - Stores renderer-local voice input settings in local storage.
  - Tracks selected microphone device and flags likely system/loopback inputs.
  - `voiceInputAudioConstraints()` already requests `{ echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, channelCount: { ideal: 1 } }`.
- `apps/renderer/src/audio/voice-capture.ts`
  - Owns PTT/final capture and final STT transcription.
  - Applies the selected microphone constraints.
  - Calls `applyFinalResult()` after final STT result.
- `apps/renderer/src/audio/vad-controller.ts`
  - Owns VAD monitoring and RMS threshold detection.
  - Uses `shouldIgnoreSpeech()` to avoid starting capture while a turn is active.
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx`
  - Passes selected microphone into both PTT and VAD.
  - Treats active turns as `VAD paused`, with live diagnostics.
- `apps/renderer/src/state/voice-input-store.ts`
  - Stores final candidates, one queued final candidate, VAD diagnostics, readiness, and voice input settings.
- `apps/renderer/src/screens/Chat/Chat.tsx`
  - Submits final transcripts through the same `text-input` path as typed messages.
  - Queues final voice candidates while input is disabled or Teto is speaking.
  - Promotes queued candidates only after the previous turn is no longer active/settling.
  - Provides Stop during active turns and edit/regenerate for sent user messages.
- `apps/renderer/src/ws/audio-player.ts` and `apps/renderer/src/ws/store.ts`
  - Play renderer-side TTS audio payloads and expose coarse speaking state.
  - Current speaking state is based on audio/control envelopes and may need more precise playback lifecycle evidence before no-headphones conclusions.

Current behavior already prevents VAD auto-start during active turns. Phase 22 should test that shipped mitigation first. A new content-based self-speech guard is optional gap-closure work only if UAT or diagnostics show assistant speech can still enter Chat through PTT, queued final transcripts, provider latency, or imprecise speaking/playback state.

</current_baseline>

<decisions>
## Implementation Decisions

### Evidence Threshold And Verdict

- **D-01:** No-headphones status can be `Ready` only after strict repeatable evidence. Tests must pass across active-TTS, VAD, PTT, local STT, and configured cloud STT paths with no assistant self-submit.
- **D-02:** Minor or edge-case AEC issues should classify no-headphones as `Limited`, with conservative VAD defaults preserved.
- **D-03:** `Unsafe` is a manual UAT judgment when the behavior is unusable or too risky, not an automatic result of one isolated failure.
- **D-04:** Phase 22 must record an explicit manual UAT verdict: `Ready`, `Limited`, or `Unsafe`, with notes explaining the reason.

### Self-Speech And Active-Turn Guarding

- **D-05:** The shipped baseline is VAD pause/ignore while a turn is active, plus PTT/final transcript queueing during active turns. Phase 22 must verify this behavior rather than assuming a new guard is required.
- **D-06:** Assistant speech must not become a submitted user message. If the current pause/queue/stop/edit mitigations are insufficient, add the smallest provider-independent guard before final Chat submission.
- **D-07:** No barge-in cancellation is allowed in Phase 22. Stop remains explicit user action.
- **D-08:** Any final-transcript guard added by Phase 22 must apply before the shared Chat `text-input` submission path so local and cloud STT providers are covered together.
- **D-09:** Discarded assistant-like transcripts, if any guard is added, should not be shown to the user. Record redacted diagnostics only.
- **D-10:** VAD paused during Teto speech is expected safety behavior, not a failure state. The phase should test whether that safety behavior is enough for no-headphones use.

### User-Facing Status Surface

- **D-11:** No-headphones support status belongs in Settings only. Chat should avoid support claims and only reflect availability/safety states needed for operation.
- **D-12:** Settings should use direct status labels: `Ready`, `Limited`, and `Unsafe`.
- **D-13:** When status is `Limited` or `Unsafe`, Settings should recommend PTT + headphones as the reliable baseline.
- **D-14:** Users may explicitly override `Unsafe` and enable VAD anyway, but the app must show warning copy and keep defaults conservative.
- **D-15:** Settings should show concise status and recommendation copy, with details or diagnostics available separately. Do not show full UAT notes inline.

### VAD Defaults After AEC Results

- **D-16:** VAD remains explicit opt-in even if AEC earns `Ready`. `Ready` only reduces warning severity; it must not auto-enable VAD.
- **D-17:** Initial VAD sensitivity and silence-timeout defaults remain conservative. The app may remember user tuning after successful use.
- **D-18:** When status is `Limited`, VAD stays off by default and Settings warns that headphones/PTT are safer.
- **D-19:** When status is `Unsafe`, VAD stays off and requires an explicit override to enable in no-headphones mode.
- **D-20:** PTT remains available whenever STT is ready. AEC status affects no-headphones/VAD guidance, not baseline PTT availability.

### Test Artifact Expectations

- **D-21:** Phase 22 should save a structured UAT document with test matrix, environment/device notes, results, final verdict, and limitations.
- **D-22:** Phase 22 must not retain raw microphone or TTS audio as normal evidence. Store metadata, results, verdicts, and notes only.
- **D-23:** UAT environment notes should include OS, microphone/speaker/headphone state, output volume, room noise, STT provider, VAD settings, selected input device, and AEC constraints/settings.
- **D-24:** Manual UAT steps plus app diagnostics are sufficient. Phase 22 does not need a dedicated in-app AEC test wizard.
- **D-25:** User-facing no-headphones status should ship from the recorded Phase 22 UAT verdict, not from a runtime auto-decision engine.

### Planning Reset

- **D-26:** Existing `22-01-PLAN.md` through `22-04-PLAN.md` were generated before Phase 20.2/21 gap closures and should be deleted/regenerated.
- **D-27:** New plans must not assume exact old filenames such as `voice-input-store.ts` as the only settings source; current implementation splits voice preferences across `audio-settings.ts`, `voice-input-store.ts`, `VoiceInputSection.tsx`, `Settings.tsx`, and Chat voice controls.
- **D-28:** AEC diagnostics should extend the existing capture path. Do not create a second microphone capture stack.

</decisions>

<canonical_refs>
## Canonical References

**Downstream planners and executors must read these before implementing.**

### Milestone Scope

- `.planning/ROADMAP.md` - Phase 22 goal, requirements, success criteria, and v3.0 exclusions.
- `.planning/REQUIREMENTS.md` - `AEC-01` through `AEC-04`, plus VIN/STT/CODE boundaries and no-headphones risk framing.
- `.planning/PROJECT.md` - v3.0 voice input goals, local-first posture, AEC decision requirement, and Open-LLM-VTuber reference boundary.
- `.planning/STATE.md` - current project state, Phase 21 completion, and Phase 22 empirical decision notes.
- `CLAUDE.md` - project-level instruction snapshot and local-first/tech-stack constraints.
- `PROJECT_DESIGN.md` - original voice-input decisions: PTT and VAD, raw VAD/no wake word, medium sensitivity baseline, and interruption ideas now constrained by v3.0 decisions.

### Prior Phase Context And Evidence

- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md`
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-UAT.md`
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md`
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-RESEARCH.md`
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-UAT.md`
- `.planning/phases/20.1-settings-ux-refactor-enablement-simplification/`
- `.planning/phases/20.2-cpu-local-stt-enhancement/`
- `.planning/phases/21-code-switch-evaluation-hardening/21-CONTEXT.md`
- `.planning/phases/21-code-switch-evaluation-hardening/21-UAT.md`
- `.planning/phases/21-code-switch-evaluation-hardening/21-VERIFICATION.md`

### Existing Code

- `apps/renderer/src/state/audio-settings.ts` - voice input settings, selected microphone, likely system-audio detection, and current AEC-related constraints.
- `apps/renderer/src/audio/voice-capture.ts` - final PTT/final capture, MediaRecorder, final STT request, and final result handoff.
- `apps/renderer/src/audio/vad-controller.ts` - VAD RMS loop, thresholds, silence timeout, and active-turn ignore hook.
- `apps/renderer/src/state/voice-input-store.ts` - final/queued candidate state, VAD diagnostics, readiness, and store hooks.
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx` - Chat microphone UI, PTT keyboard/pointer handling, VAD pause diagnostics, selected microphone wiring.
- `apps/renderer/src/screens/Chat/Chat.tsx` - final transcript submission, queue promotion, Stop, edit/regenerate, and turn activity state.
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` - streaming turn lifecycle, speaking/input disabled state, stopped-turn restart metadata, and settlement.
- `apps/renderer/src/ws/store.ts` - WebSocket dispatcher, `setSpeaking`, audio payload handling, and conversation-chain end behavior.
- `apps/renderer/src/ws/audio-player.ts` - renderer TTS audio playback queue; may need lifecycle diagnostics.
- `apps/renderer/src/screens/Settings/Settings.tsx` - current Settings screen and Voice Input section integration.
- `apps/renderer/src/screens/Settings/VoiceInputSection.tsx` - reusable voice input preference fields.
- `apps/renderer/src/lib/copy.ts` - centralized copy for Settings and Chat status labels.
- `apps/electron-main/src/ipc.ts` - microphone permission and voice-input readiness IPC.
- `apps/electron-main/src/safe-storage.ts` - generated audio provider config persistence. Do not move renderer-local voice UI preferences here unless there is a concrete cross-process need.
- `packages/contracts/py/contracts/audio_provider.py` and `packages/contracts/ts/audio-provider.ts` - generated audio/STT provider config, readiness, and test-result contracts.

</canonical_refs>

<specifics>
## Specific Ideas

- Keep the status vocabulary direct: `Ready`, `Limited`, `Unsafe`.
- Treat `Limited` and `Unsafe` as recommendations back to PTT + headphones.
- Treat VAD paused during Teto speech as expected safety behavior.
- Treat selected physical microphone as a prerequisite for meaningful no-headphones testing; loopback/system-audio inputs invalidate the test.
- Prefer renderer-local AEC diagnostics unless generated contracts are needed for sidecar/admin reporting.
- Add precise TTS playback lifecycle diagnostics only if coarse `isSpeaking` cannot prove active-TTS windows accurately.
- If a self-speech guard is needed, make it deterministic and provider-independent; do not call an LLM for semantic matching.

</specifics>

<deferred>
## Deferred Ideas

- Wake word.
- Barge-in cancellation.
- Runtime automatic no-headphones classifier.
- Translation before LLM submission.
- New STT providers.
- Any claim that no-headphones use is solved before Phase 22 evidence.

</deferred>

---

*Phase: 22-AEC Spike + No-Headphones Decision*  
*Context updated: 2026-05-13*
