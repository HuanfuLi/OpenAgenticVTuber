# Phase 17: GPT-SoVITS Provider + Voice Presets - Context

**Gathered:** 2026-05-09T18:19:52-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 17 adds GPT-SoVITS as a selectable TTS provider and introduces named voice presets plus GPT-SoVITS reference-audio management. It must preserve the Phase 16 audio-provider shell expectations, Piper fallback safety, ordered playback, renderer audio payloads, RMS/lipsync, and no-silent-provider-switch behavior.

This phase does not add GPT-SoVITS installation, dependency management, model training, voice cloning UI, STT provider work, microphone capture, VAD/PTT, code-switch eval, or AEC/no-headphones behavior.

</domain>

<decisions>
## Implementation Decisions

### Connection Modes
- **D-01:** GPT-SoVITS external-server mode should ask the user for a service base URL, not multiple endpoint URLs. Research/planning should determine endpoint probing against the current GPT-SoVITS API layout.
- **D-02:** App-managed launch is user-command-only: the user supplies command and working directory. The app may start/stop/restart the command but must not install dependencies, mutate environments, or provide bundled command templates in this phase.
- **D-03:** GPT-SoVITS should not become selectable for chat output until both health check and user-triggered test synthesis pass.
- **D-04:** Stop/restart controls must affect only the process this app launched. External servers must never be killed by the app.

### Preset Model
- **D-05:** Voice presets should be a global reusable library, not stored only per avatar or per session.
- **D-06:** The active voice preset association should live in app audio settings keyed by current avatar/session as an override. Do not modify avatar import catalogs or `AvatarOverrides` import artifacts for preset selection.
- **D-07:** A preset owns provider-specific voice knobs, GPT-SoVITS reference text/language, and reference-audio selection. Connection credentials, base URL, and launch command remain provider-level settings rather than duplicated per preset.
- **D-08:** If an active preset is deleted, require reassignment before deletion completes. Do not silently fall back to Piper and do not leave broken active preset references.

### Failure UX
- **D-09:** If GPT-SoVITS fails during a chat turn, the sentence display should still surface, but the audio for that sentence should be visibly marked failed. The app must not silently switch to Piper mid-turn.
- **D-10:** Piper fallback may be used on the next turn only after a visible notice and explicit user action/selection. No silent fallback after a GPT-SoVITS failure.
- **D-11:** Failure detail should reuse the existing log panel for diagnostics. Main voice/settings/chat surfaces should show concise status and point users to logs rather than dumping raw provider output inline.
- **D-12:** Test synthesis failures must not activate the candidate provider/preset. Leave the previous active provider/preset intact.

### Reference Audio
- **D-13:** Imported GPT-SoVITS reference audio should be copied into sanitized app-managed storage. Do not reference original user file paths as the primary preset asset.
- **D-14:** Phase 17 validation should perform basic usable checks: file exists, allowed audio format, duration bounds, and readable metadata. Defer subjective quality scoring or strict noise/loudness gates unless research finds a cheap standard check.
- **D-15:** Reference audio metadata must include reference transcript text and language.
- **D-16:** Deleting reference audio that is used by one or more presets should be blocked until presets are reassigned or deleted. Do not cascade-delete presets and do not leave broken references.

### the agent's Discretion
No explicit “you decide” areas were delegated. Downstream agents may choose exact schema names, endpoint paths, UI layout, timeout values, and validation thresholds consistent with the decisions above and Phase 17 requirements.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/ROADMAP.md` — Phase 17 goal, dependencies, success criteria, and execution order.
- `.planning/REQUIREMENTS.md` — TTS-01 through TTS-06 and PRESET-01 through PRESET-04 requirements, plus out-of-scope exclusions.
- `.planning/PROJECT.md` — v3.0 milestone constraints, local-first posture, Piper baseline, GPT-SoVITS scope exclusions, and key decisions.
- `.planning/STATE.md` — current milestone state and accumulated decisions affecting v3.0.

### v3.0 Research
- `.planning/research/v3.0/SUMMARY.md` — GPT-SoVITS provider recommendations, phase ordering rationale, architecture watch-outs, and reference-audio path risk.
- `.planning/research/v3.0/STACK.md` — current provider/library version guidance and GPT-SoVITS API/package notes.
- `.planning/research/v3.0/ARCHITECTURE.md` — sidecar provider abstraction, admin endpoints, and audio output invariant recommendations.
- `.planning/research/v3.0/PITFALLS.md` — TTS provider failure, reference-audio, local-first, and blocking-risk mitigations.
- `.planning/research/v3.0/FEATURES.md` — voice preset and reference-audio feature expectations.

### Existing Code
- `sidecar/src/sidecar/tts/tts_manager.py` — owns ordered TTS queue, sidecar playback, renderer audio payload send, RMS speech envelope publication, and sentence completion.
- `sidecar/src/sidecar/tts/tts_gateway.py` — current Piper boot/warmup/output-stream ownership.
- `packages/contracts/py/contracts/audio_payload.py` — current audio payload contract that GPT-SoVITS output must continue to feed.
- `packages/contracts/py/contracts/avatar_overrides.py` — current `Voice` field exists in avatar import artifacts; Phase 17 must not use this as the active preset association store.
- `apps/renderer/src/screens/Settings/Settings.tsx` — current Settings TTS section and log/settings patterns that Phase 17/18 will evolve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TTSTaskManager` in `sidecar/src/sidecar/tts/tts_manager.py`: keep as owner of sequence ordering, queueing, playback writes, WebSocket audio payloads, RMS/speech envelope publication, and completion signaling. GPT-SoVITS providers should synthesize artifacts only.
- `TTSGateway` in `sidecar/src/sidecar/tts/tts_gateway.py`: current Piper-specific boot/warmup/output-stream lifecycle is the baseline for provider health and safe fallback behavior.
- `AudioPayloadMessage` in `packages/contracts/py/contracts/audio_payload.py`: preserves OLVT-shaped `type: "audio"`, base64 audio, `volumes`, `slice_length`, display text, dispatches, and sentence IDs.
- Settings page section pattern in `apps/renderer/src/screens/Settings/Settings.tsx`: existing long-scroll settings UI, key/value rows, dialogs, and diagnostics/log actions should be reused rather than inventing a separate voice-settings shell.

### Established Patterns
- Python Pydantic contracts are the source of truth, with generated TS mirrors and schema drift tests. New provider/preset contracts should follow this pattern if they cross the Python/TS boundary.
- Renderer user-facing copy is centralized through `apps/renderer/src/lib/copy.ts`; failure/status copy should avoid hardcoded component strings where existing patterns apply.
- Existing diagnostics/log panel is already part of the user-facing debug flow. GPT-SoVITS technical failures should feed that surface rather than raw inline UI.
- Avatar import artifacts currently include a simple `Voice` block, but Phase 17 active preset selection should be app settings, not catalog mutation.

### Integration Points
- Sidecar TTS provider code connects below `TTSTaskManager._synthesize_payload()` or the Phase 16 provider shell, while leaving queue/playback/envelope ownership intact.
- Electron main/stored config and preload APIs will likely need provider settings, launch command fields, preset CRUD, reference-audio import, and test synthesis actions.
- Renderer Settings TTS section will need to evolve from truthful Piper status into provider/preset/test controls, with richer full settings polish continuing in Phase 18.

</code_context>

<specifics>
## Specific Ideas

- Reuse the existing log panel for GPT-SoVITS diagnostic details.
- Keep GPT-SoVITS setup as client/config only: base URL, optional user-provided launch command, health check, test synthesis, and reference-audio metadata/storage.
- Treat reference transcript text and language as required preset data because GPT-SoVITS prompt conditioning depends on them.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-GPT-SoVITS Provider + Voice Presets*
*Context gathered: 2026-05-09T18:19:52-04:00*
