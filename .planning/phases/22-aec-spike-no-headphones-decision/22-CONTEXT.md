# Phase 22: AEC Spike + No-Headphones Decision - Context

**Gathered:** 2026-05-10T02:03:27.0123488-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 22 empirically tests whether no-headphones voice input is safe enough to claim support. It prototypes browser/WebRTC echo cancellation with renderer microphone capture, verifies that assistant TTS does not become user input through VAD or STT, records a manual UAT verdict, and updates user-facing no-headphones status truthfully.

This phase consumes Phase 19 STT provider readiness, Phase 20 Chat voice capture/PTT/VAD behavior, and Phase 21 code-switch evidence. It does not add new STT providers, redesign voice input, add wake words, implement barge-in cancellation, translate transcripts, silently fall back to cloud STT, or promise perfect no-headphones behavior without evidence.

</domain>

<decisions>
## Implementation Decisions

### Pass/Fail Evidence Threshold
- **D-01:** No-headphones status can be labeled `Ready` only after strict repeatable evidence. Repeated tests must pass across active-TTS, VAD, and STT paths with no assistant self-submit.
- **D-02:** Minor or edge-case AEC issues should classify no-headphones as `Limited`, with conservative VAD defaults preserved.
- **D-03:** `Unsafe` is not triggered by a single rigid automatic rule. The final fallback-only judgment comes from explicit UAT judgment when the tested behavior is unusable.
- **D-04:** Phase 22 must record an explicit manual UAT verdict: `Ready`, `Limited`, or `Unsafe`, with notes explaining the reason.

### TTS Self-Speech Guard
- **D-05:** During avatar speech, capture and STT may continue, but final transcripts that appear to be assistant speech must be discarded before they can enter Chat.
- **D-06:** The discard policy should be conservative during active TTS: discard when transcript meaning overlaps with recent assistant output, accepting that some real overlap speech may be dropped to prevent self-submit.
- **D-07:** If the user intentionally speaks over Teto while TTS is playing, the transcript may submit immediately if it passes the self-speech discard check. This must not add barge-in cancellation.
- **D-08:** The self-speech guard applies before final Chat submission for all STT providers, local and cloud.
- **D-09:** Discarded assistant-like transcripts should not be shown to the user. Record redacted developer diagnostics only.

### User-Facing Status Surface
- **D-10:** No-headphones support status belongs in Settings only. Chat should only disable unsafe controls or avoid unsafe claims.
- **D-11:** Settings should use direct status labels: `Ready`, `Limited`, and `Unsafe`.
- **D-12:** When status is `Limited` or `Unsafe`, Settings should recommend PTT + headphones as the reliable baseline.
- **D-13:** Users may explicitly override `Unsafe` and enable VAD anyway, but the app must show warning copy and keep defaults conservative.
- **D-14:** Settings should show concise status and recommendation copy, with details or diagnostics available separately. Do not show full UAT notes inline.

### VAD Defaults After AEC Results
- **D-15:** VAD remains explicit opt-in even if AEC earns `Ready`. `Ready` only removes scary warning copy; it must not auto-enable VAD.
- **D-16:** Initial VAD sensitivity and silence-timeout defaults remain conservative. The app may remember user tuning after successful use.
- **D-17:** When status is `Limited`, VAD stays off by default and Settings warns that headphones/PTT are safer.
- **D-18:** When status is `Unsafe`, VAD stays off and requires an explicit override to enable in no-headphones mode.
- **D-19:** PTT remains available whenever STT is ready. AEC status affects no-headphones/VAD guidance, not baseline PTT availability.

### Test Artifact Expectations
- **D-20:** Phase 22 should save a structured UAT document with test matrix, environment/device notes, results, final verdict, and limitations.
- **D-21:** Phase 22 must not retain raw microphone or TTS audio as normal evidence. Store metadata, results, verdicts, and notes only.
- **D-22:** UAT environment notes should include OS, microphone/speaker/headphone state, output volume, room noise, STT provider, VAD settings, and AEC constraints.
- **D-23:** Manual UAT steps plus app diagnostics are sufficient. Phase 22 does not need a dedicated in-app AEC test wizard.
- **D-24:** User-facing no-headphones status should ship from the recorded Phase 22 UAT verdict, not from a runtime auto-decision engine.

### the agent's Discretion
Downstream agents may choose exact test-case names, diagnostics schema, redacted log fields, wording details, implementation boundaries for semantic overlap checks, and Settings layout consistent with the decisions above. Do not re-open PTT-first, VAD opt-in, no wake word, no barge-in, no translation, or cloud-never-fallback decisions unless the roadmap changes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/ROADMAP.md` - Phase 22 goal, dependency on Phase 21, success criteria, and v3.0 exclusions.
- `.planning/REQUIREMENTS.md` - AEC-01 through AEC-04, plus VIN/STT/CODE boundaries and no-headphones risk framing.
- `.planning/PROJECT.md` - v3.0 voice input goals, local-first posture, AEC decision requirement, and Open-LLM-VTuber reference boundary.
- `.planning/STATE.md` - current v3.0 state and accumulated decision that AEC/no-headphones support is empirical and must not be promised before Phase 22.
- `CLAUDE.md` - project-level instruction snapshot and local-first/tech-stack constraints.
- `PROJECT_DESIGN.md` - original voice-input decisions: PTT and VAD, raw VAD/no wake word, medium sensitivity baseline, and prior interruption ideas now constrained by the v3.0 roadmap.

### Prior Phase Context
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` - STT readiness, provider enablement, cloud guardrails, and no silent fallback policy.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md` - renderer mic capture, PTT-first behavior, VAD as explicit secondary mode, final transcript submission through existing Chat path, and AEC deferral.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-RESEARCH.md` - WebRTC capture notes, echo-cancellation caveat, AudioWorklet guidance, and VAD self-capture risk.
- `.planning/phases/21-code-switch-evaluation-hardening/21-CONTEXT.md` - code-switch scorecard, no-translation policy, provider badges, and live Chat voice UAT expectation before Phase 22.

### Existing Code
- `apps/renderer/src/screens/Chat/Chat.tsx` - current Chat input, disabled-turn behavior, speaking indicator, and final text submission pattern.
- `apps/renderer/src/ws/store.ts` - renderer WebSocket dispatcher, `setSpeaking`, turn-in-flight handling, audio payload handling, and conversation-chain end behavior.
- `apps/renderer/src/ws/audio-player.ts` - renderer audio playback path that Phase 22 diagnostics may need to correlate with active TTS.
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` - streaming state, speaking/input-disabled state helpers, and Chat turn lifecycle.
- `apps/renderer/src/screens/Settings/Settings.tsx` - existing Settings surface for status labels, warnings, overrides, and diagnostics links.
- `apps/renderer/src/lib/copy.ts` - centralized renderer copy for Settings status labels and warnings.
- `apps/electron-main/preload/index.ts` - renderer-safe API bridge if Phase 22 needs status or diagnostics IPC.
- `apps/electron-main/src/ipc.ts` - existing IPC/admin proxy pattern for audio-provider actions.
- `packages/contracts/py/contracts/audio_provider.py` - source-of-truth audio/STT provider config shape and health status pattern.
- `packages/contracts/ts/audio-provider.ts` - generated TypeScript mirror consumed by renderer/Electron code.
- `sidecar/src/sidecar/admin/audio.py` - current audio admin endpoint and redacted diagnostics patterns.
- `sidecar/src/sidecar/tts/tts_manager.py` - TTS lifecycle and speech queue path that informs active-TTS windows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Chat.tsx`: provides the final typed-chat submission path, disabled state handling, and speaking display that Phase 22 must respect.
- `ws/store.ts`: already tracks active speech and input-disabled state from audio payloads and conversation control events.
- `Settings.tsx`: existing long-scroll Settings sections and provider/status patterns are the right home for `Ready` / `Limited` / `Unsafe` status.
- `copy.ts`: status labels, warning copy, and override text should be centralized here rather than scattered through components.
- `AudioProviderHealth` and `AudioConfig`: existing contracts provide a pattern for redacted diagnostics and status reporting.

### Established Patterns
- Final user text enters Chat through the existing `text-input` path. Phase 22 guards must sit before final Chat submission rather than creating a separate conversation path.
- Provider and audio diagnostics should be redacted. Do not persist raw audio or sensitive transcript content in normal evidence.
- Settings exposes durable configuration/status, while Chat stays focused on interaction. Phase 22 no-headphones status should follow that split.
- PTT remains the reliable baseline, and VAD remains explicit opt-in. AEC success can improve copy but should not flip the product into always-listening behavior.

### Integration Points
- Add no-headphones status and override state to the audio/voice settings model if existing Phase 20 structures do not already provide it.
- Add a self-speech suppression guard between finalized STT output and the existing final Chat submission path.
- Correlate finalized STT candidates with active TTS windows and recent assistant output before accepting VAD or PTT transcripts.
- Add UAT artifacts under the Phase 22 planning directory and keep any raw local debugging audio outside normal evidence and out of git.

</code_context>

<specifics>
## Specific Ideas

- The status vocabulary should be direct: `Ready`, `Limited`, `Unsafe`.
- `Limited` and `Unsafe` both point users back to PTT + headphones as the reliable baseline.
- The product should favor preventing assistant self-submit over preserving every possible user overlap utterance.
- Phase 22 should make a recorded human verdict based on evidence, not build a runtime no-headphones classifier.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 22-AEC Spike + No-Headphones Decision*
*Context gathered: 2026-05-10T02:03:27.0123488-04:00*
