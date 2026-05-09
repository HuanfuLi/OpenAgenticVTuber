# Phase 19: STT Provider Abstraction + Local/Cloud Providers - Context

**Gathered:** 2026-05-09T19:27:01.2102604-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 19 adds real voice transcription providers behind one lazy-loaded STT provider interface. It must make FunASR/SenseVoiceSmall the recommended local bilingual default, faster-whisper the visible local fallback, and OpenAI/Groq explicit opt-in cloud providers. Users must be able to download/control local model cache state, run a short Settings-only test transcription, and enable a provider only after it is healthy and has produced a successful test transcript.

This phase does not implement chat voice submission, PTT, VAD, streaming preview UX, code-switch quality scoring, AEC/no-headphones behavior, wake word, barge-in, or automatic cloud fallback. Those remain Phase 20+ concerns.

</domain>

<decisions>
## Implementation Decisions

### Local Model Download And Cache Policy
- **D-01:** Local STT models require an explicit user download before use. The app must not surprise-download FunASR, SenseVoice, faster-whisper, or related model files.
- **D-02:** Use a simple app-managed cache for local STT models. Settings should show cache path, model size/status, and download/remove controls.
- **D-03:** Include model removal controls for app-managed local STT models.
- **D-04:** Heavy STT providers must not auto-start, import heavyweight ML stacks, load models, or download models during app boot. Phase 19 may read lightweight config/catalog/cache metadata only. Any local STT model download/load happens after explicit user action such as Download, Test transcription, Enable, or first provider use with prior confirmation. Do not add background idle preload after boot.

### Test Transcription Input
- **D-05:** Phase 19 should include a minimal record-for-test path for STT provider validation.
- **D-06:** The recorder is Settings-only and short/manual. It exists only to test the selected STT provider and must not implement chat submission, preview streaming, VAD, or PTT UX.
- **D-07:** Recorded test audio is discarded immediately after transcription. Do not retain raw test audio or create test-audio history.
- **D-08:** Test transcription results should show transcript plus concise diagnostics: provider, duration, latency, model/cache state, and redacted error if any.

### Provider Readiness Gate
- **D-09:** A provider can be enabled for future voice input only after provider health passes and the Settings test transcription succeeds.
- **D-10:** Successful test transcription means a non-empty transcript with no provider error. Quality scoring, semantic correctness, and mixed-language benchmark scoring belong to Phase 21.
- **D-11:** Provider readiness is invalidated by relevant provider, model, cache path, credential, language-mode, or endpoint changes.
- **D-12:** If an enabled provider later fails at runtime, mark it unhealthy/disabled until it passes another test. Do not automatically fall back to another provider.

### FunASR vs Faster-Whisper Defaults
- **D-13:** Present FunASR/SenseVoice as the recommended local default for Chinese/English/code-switching.
- **D-14:** Use SenseVoiceSmall as the initial FunASR model target.
- **D-15:** Position faster-whisper as a visible local fallback for English/general use or when FunASR packaging, install, or quality is unsuitable.
- **D-16:** Use minimal safe local inference defaults in Phase 19. Do not add a broad advanced CPU/GPU/quantization panel unless required for basic provider operation.

### Cloud Provider Guardrails
- **D-17:** OpenAI and Groq STT require persistent provider consent plus credentials before any cloud transcription can run.
- **D-18:** Cloud STT is never used as automatic fallback. Cloud providers run only when explicitly selected, tested, and enabled.
- **D-19:** Cloud audio handling should be explained in one-time setup/consent copy rather than repeated per-action confirmation.
- **D-20:** Cloud diagnostics retain redacted metadata only: provider, model, latency, status/error category, and optionally audio duration. Do not retain raw audio, transcript text, API keys, or full provider errors.

### the agent's Discretion
No explicit "you decide" areas were delegated. Downstream agents may choose exact schema names, endpoint paths, timeout values, test recording duration, and UI layout consistent with the decisions above and Phase 19 requirements.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/ROADMAP.md` - Phase 19 goal, dependencies, success criteria, and execution order.
- `.planning/REQUIREMENTS.md` - STT-01 through STT-06 and PERF-01 requirements, plus privacy and out-of-scope exclusions.
- `.planning/PROJECT.md` - v3.0 local-first posture, FunASR preference, faster-whisper fallback, cloud opt-in posture, and voice-input milestone boundaries.
- `.planning/STATE.md` - current milestone state, accumulated v3.0 decisions, and known FunASR/packaging/cloud-STT concerns.

### v3.0 Research
- `.planning/research/v3.0/SUMMARY.md` - STT provider recommendations, phase ordering rationale, lazy-load and cache warnings, and Phase 19 research flags.
- `.planning/research/v3.0/STACK.md` - current provider/library version guidance for FunASR, ModelScope, faster-whisper, OpenAI, and Groq.
- `.planning/research/v3.0/ARCHITECTURE.md` - sidecar STT provider abstraction, provider test endpoints, and future voice-session boundaries.
- `.planning/research/v3.0/PITFALLS.md` - local model download, cloud privacy, provider failure, sample-rate, and event-loop blocking risks.
- `.planning/research/v3.0/FEATURES.md` - expected provider catalog, capability labels, health/test behavior, and diagnostics surfaces.

### Prior Phase Context
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-CONTEXT.md` - app-managed GPT-SoVITS launch semantics, health/test gating, and no silent fallback patterns that inform STT provider readiness.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-UI-SPEC.md` - Settings interaction patterns for provider activation, test gating, concise status, and diagnostics routing.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-DISCUSSION-LOG.md` - audit-only source used during discussion to clarify that GPT-SoVITS app-managed launch did not mean auto-start at app boot.

### Existing Code
- `packages/contracts/py/contracts/audio_provider.py` - current Pydantic audio config and provider health contracts with STT provider ids already reserved.
- `packages/contracts/ts/audio-provider.ts` - generated TypeScript mirror consumed by renderer/Electron code.
- `sidecar/src/sidecar/audio/config.py` - sidecar audio config environment loading and default audio config behavior.
- `sidecar/src/sidecar/admin/audio.py` - current audio provider status endpoint pattern.
- `sidecar/src/sidecar/tts/provider.py` - provider-interface pattern that STT should mirror where appropriate.
- `sidecar/src/sidecar/tts/tts_manager.py` - existing off-event-loop provider execution and failure handling baseline.
- `apps/electron-main/preload/index.ts` - current renderer bridge for config/status APIs and future STT test/control IPC surface.
- `apps/renderer/src/state/setup-store.ts` - renderer default audio config shape.
- `apps/renderer/src/screens/Settings/Settings.tsx` - existing Settings long-scroll, provider status, diagnostics, and button patterns to extend.
- `sidecar/pyproject.toml` - current Python dependency boundary; Phase 19 dependency additions must account for Python 3.12 and Windows packaging.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AudioConfig`, `STTProviderConfig`, and `AudioProviderHealth` in `packages/contracts/py/contracts/audio_provider.py`: existing source-of-truth contracts already model STT enabled/active provider state and provider health categories.
- `sidecar/src/sidecar/admin/audio.py`: existing admin status route can guide health/test endpoint shape, but Phase 19 needs STT-specific catalog, cache, and test transcription actions.
- `apps/renderer/src/screens/Settings/Settings.tsx`: Settings already has long-scroll sections, health dots, refresh/test buttons, dialogs, diagnostics copy, and safeStorage-backed config editing patterns.
- `apps/electron-main/preload/index.ts`: bridge already exposes audio status and stored config; Phase 19 should add explicit STT model/cache/test APIs here rather than direct renderer sidecar access.

### Established Patterns
- Pydantic contracts are the source of truth, with generated TS mirrors and schema drift tests. New STT test/cache/provider result contracts should follow that path when crossing Python/TS boundaries.
- Audio config is stored as part of versioned app config and loaded into the sidecar through environment JSON. STT credential/consent fields must preserve the Phase 18 privacy boundary.
- Provider work should run off the event loop. Existing TTS provider execution uses worker-thread style boundaries; STT inference/download/test work needs equivalent non-blocking behavior.
- Existing diagnostics/log surfaces should receive technical detail, while Settings shows concise health/test/cache state.

### Integration Points
- Sidecar STT provider package should sit alongside existing audio/TTS provider modules and expose a narrow provider interface for local/cloud transcription.
- Electron main/preload needs model download/remove/status and test-transcription IPC/admin proxy methods.
- Renderer Settings needs a Voice Input/STT section with local provider recommendation, model cache controls, short manual test recorder, provider readiness state, and cloud consent/credential gating.
- Package dependencies for FunASR/ModelScope/faster-whisper/OpenAI/Groq should be lazy/import-guarded so app boot stays light.

</code_context>

<specifics>
## Specific Ideas

- Treat "app-managed launch" from GPT-SoVITS as explicit user action, not a precedent for STT auto-start. STT should be stricter: no boot-time heavy imports, model load, download, or idle preload.
- Keep the Phase 19 recorder intentionally narrow: Settings-only, short/manual, no chat submission, no preview stream, no VAD/PTT state machine.
- Cloud STT setup can use persistent consent copy rather than per-action confirmations, but no cloud provider can run without both consent and credentials.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 19-STT Provider Abstraction + Local/Cloud Providers*
*Context gathered: 2026-05-09T19:27:01.2102604-04:00*
