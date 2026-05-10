# Phase 21: Code-Switch Evaluation + Hardening - Context

**Gathered:** 2026-05-10T01:01:12.1531993-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 21 makes the Chinese/English voice-input claim evidence-backed and truthful. It owns the locked bilingual/code-switch evaluation corpus, repeatable provider scorecard, no-translation checks, targeted STT hardening when evidence shows a clear fix, and user-facing provider quality badges.

This phase consumes Phase 19's STT providers/readiness and Phase 20's Chat voice-input path. It does not redesign provider architecture, add new STT providers, implement translation, change final transcript submission semantics, add runtime language policing, add AEC/no-headphones behavior, or make cloud STT the default.

</domain>

<decisions>
## Implementation Decisions

### Evaluation Corpus
- **D-01:** The locked corpus should optimize for realistic companion-style utterances rather than benchmark-style coverage.
- **D-02:** Corpus utterances should stay generic. Do not include project-specific names, provider names, app-specific commands, or target-avatar names.
- **D-03:** The first locked corpus should be small and repeatable: about 20-30 utterances.
- **D-04:** Corpus audio should be a user-recorded reference set captured once under real microphone conditions.

### Scoring Rules
- **D-05:** Score semantic correctness first, with key-token retention as a hard concern for important names, numbers, commands, and mixed-language terms.
- **D-06:** Ignore punctuation, capitalization, and spacing unless they change meaning, command boundaries, numbers, or mixed-language token interpretation.
- **D-07:** Accept equivalent Chinese variants such as simplified/traditional differences and harmless ASR normalization when meaning is preserved.
- **D-08:** Translation is a hard fail. Chinese must not become English, English must not become Chinese, and mixed utterances must not collapse into one language.

### Default Recommendation Policy
- **D-09:** Phase 21 may change the local default STT recommendation when scorecard evidence clearly supports it.
- **D-10:** Cloud providers can be evaluated and can score well, but they must never become the default recommendation.
- **D-11:** Switch the local default away from FunASR/SenseVoice only if another local provider beats it on hard gates and overall score by a meaningful margin.
- **D-12:** If no local provider performs well enough for code-switching, keep the best local provider as the default but label code-switch support as limited or experimental.

### Provider Copy Surface
- **D-13:** Settings should show concise provider capability badges only.
- **D-14:** Provider badges should use short labels such as Local, Cloud, Chinese/English, Code-switch tested, Limited code-switch, and Requires API key.
- **D-15:** The detailed scorecard remains a developer/planning artifact, not an in-app scorecard.
- **D-16:** User-facing Settings copy should not promote cloud quality comparisons, even if a cloud provider scores better.

### Hardening Behavior
- **D-17:** If an enabled provider passes Phase 19 readiness but fails Phase 21 code-switch evaluation, keep the provider usable but remove or avoid code-switch recommendation badges and show the limitation clearly.
- **D-18:** Keep no-translation enforcement inside the eval harness, scorecard, and copy. Do not add fragile runtime transcript language policing.
- **D-19:** Phase 21 may make targeted provider config/output hardening when scorecard evidence shows a clear fix, such as language/normalization settings or known tag cleanup. Do not perform a broad ASR provider redesign.
- **D-20:** After corpus evidence passes, Phase 21 should require a short live Chat voice UAT to verify the end-to-end experience.

### the agent's Discretion
Downstream agents may choose exact corpus file format, scorecard schema, score weights, report layout, badge implementation details, and test harness structure consistent with the decisions above. Do not re-open the local-first default, cloud-never-default, no-translation, generic-corpus, or Settings-badges-only decisions unless the roadmap changes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/ROADMAP.md` - Phase 21 goal, dependency on Phase 20, success criteria, and v3.0 exclusions.
- `.planning/REQUIREMENTS.md` - CODE-01 through CODE-04 requirements, plus STT/VIN/AEC boundaries and out-of-scope translation/no-headphones items.
- `.planning/PROJECT.md` - v3.0 local-first posture, FunASR preference, faster-whisper fallback, cloud opt-in posture, and code-switch quality target.
- `.planning/STATE.md` - current v3.0 state, accumulated audio/STT decisions, and known FunASR/code-switch concerns.
- `CLAUDE.md` - project-level instruction snapshot and local-first/tech-stack constraints.

### Prior Phase Context
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` - STT provider readiness, FunASR/SenseVoice recommended local default, faster-whisper fallback, cloud guardrails, and quality-scoring deferral to Phase 21.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-RESEARCH.md` - STT provider research, local/cloud provider shape, and risks around code-switch quality and provider recommendations.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md` - final transcript unchanged/no translation, preview-only behavior, queueing, and AEC/no-headphones deferral.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-RESEARCH.md` - Chat voice capture integration, final transcript submission path, and verification expectations.

### Existing Code
- `packages/contracts/py/contracts/audio_provider.py` - source-of-truth audio/STT provider ids and config contracts currently reserving `funasr`, `faster_whisper`, `openai`, and `groq`.
- `packages/contracts/ts/audio-provider.ts` - generated TypeScript mirror consumed by Electron/renderer code.
- `sidecar/src/sidecar/audio/config.py` - sidecar audio config environment loading and default audio config behavior.
- `sidecar/src/sidecar/admin/audio.py` - current audio admin endpoint pattern for status/test-style provider interactions.
- `apps/electron-main/src/safe-storage.ts` - persisted audio settings defaults and migration boundary.
- `apps/electron-main/src/ipc.ts` - Electron IPC/admin proxy pattern for audio provider actions.
- `apps/electron-main/preload/index.ts` - renderer-safe API bridge for future scorecard/provider badge data if needed.
- `apps/renderer/src/screens/Settings/Settings.tsx` - Settings provider/status UI where STT quality badges should eventually appear.
- `apps/renderer/src/lib/copy.ts` - renderer copy constants; provider badge text should stay concise and centralized.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AudioProviderId` / `STTProviderConfig` in `packages/contracts/py/contracts/audio_provider.py`: existing provider ids establish the scorecard provider matrix.
- Generated `packages/contracts/ts/audio-provider.ts`: renderer/provider badge work should consume generated contracts rather than duplicating provider id strings.
- `apps/renderer/src/screens/Settings/Settings.tsx`: existing provider/status rows and diagnostics section provide the right UI pattern for concise STT badges after Phase 19/20 land.
- `apps/renderer/src/lib/copy.ts`: current Settings copy constants should be extended for short badge labels instead of scattering strings.

### Established Patterns
- Python Pydantic contracts are the source of truth for shared cross-process types, with generated TypeScript mirrors and schema drift tests.
- Provider health/status surfaces use explicit, typed states and redacted diagnostics. Phase 21 scorecard/report data should avoid raw audio, sensitive transcript logs, and provider secrets.
- Phase 20 locks final STT text submission through existing Chat `text-input` unchanged. Phase 21 should test and harden provider output, not bypass the Chat path.
- Phase 19 locks cloud STT as explicit opt-in with no silent fallback. Phase 21 may evaluate cloud quality but must not make cloud the default.

### Integration Points
- Add a repeatable eval corpus and scorecard artifact under Phase 21 planning/test assets or a codebase test fixture location chosen during planning.
- Add provider score evaluation against the Phase 19 STT provider surface once implemented.
- Feed provider-quality outcomes into Settings badge copy without exposing the detailed scorecard in the app.
- Add short manual live Chat UAT evidence after corpus evaluation passes.

</code_context>

<specifics>
## Specific Ideas

- Keep the first corpus small enough that the user can realistically record and rerun it: 20-30 generic companion-style utterances.
- Use hard no-translation gates to protect the product claim that final STT text is sent as heard.
- Treat code-switch badges as claims earned by evidence, not static provider marketing labels.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 21-Code-Switch Evaluation + Hardening*
*Context gathered: 2026-05-10T01:01:12.1531993-04:00*
