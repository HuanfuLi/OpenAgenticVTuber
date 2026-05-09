# Phase 18 Research: Rich Voice Settings + Persistence

**Phase:** 18 - Rich Voice Settings + Persistence
**Milestone:** v3.0 Rich Voice Configuration + Voice Input
**Date:** 2026-05-09
**Status:** Ready for planning

## Scope

Phase 18 makes the audio-provider work from Phases 16 and 17 usable and truthful in Settings. It does not implement new TTS/STT engines. It exposes the provider catalog, persisted voice output/input configuration, cloud-STT consent, secret redaction, and diagnostics surfaces needed before Phase 19 adds real STT providers.

## Inputs

- `.planning/ROADMAP.md` Phase 18 goal and success criteria.
- `.planning/REQUIREMENTS.md` requirements `AUDIO-01`, `PRIV-01`, `PRIV-02`, and `PERF-02`.
- `.planning/research/v3.0/SUMMARY.md` Phase 18 recommendation.
- `.planning/research/v3.0/PITFALLS.md` pitfalls 7, 8, 10, 11, 15, and 18.
- `.planning/research/v3.0/ARCHITECTURE.md` Settings, StoredConfig, IPC, admin endpoint, and provider catalog recommendations.
- Current Settings implementation in `apps/renderer/src/screens/Settings/Settings.tsx`.
- Current encrypted config boundary in `apps/electron-main/src/safe-storage.ts`.

## Current System Facts

- Settings already has real Connection, Avatars, Body motion plugin, VTube Studio, Conversation, Memory, Appearance, Diagnostics, and About sections.
- Settings still has a static `TTS / Voice out` summary and a placeholder `Voice in` section.
- `safe-storage.ts` currently stores `schemaVersion: 1`, LLM provider config, plugin config, setup state, and no audio config.
- Renderer saves config through `window.api.saveStoredConfig`, and Electron main restarts the sidecar after config save.
- Phase 13 conversation history sends restored session history to the sidecar; Phase 18 must not change final transcript/chat semantics.
- Phase 16/17 artifacts are not present in the repository at planning time. The Phase 18 plan is therefore written against expected upstream contracts and includes preconditions to adapt to the actual Phase 16/17 names before execution.

## Key Planning Decisions

1. Settings should use a Basic/Advanced split. Basic controls are provider, preset, health/test status, selected input/output behavior, and cloud consent. Provider-native tuning belongs behind an advanced disclosure.
2. Cloud STT is disabled by default and requires both credentials and explicit consent before any audio test or future transcription can send audio off-device.
3. STT credentials must remain separate from LLM credentials. Reusing the LLM provider API key path would violate `PRIV-01`.
4. Redaction is a shared boundary, not only UI copy. Settings, Electron logs, sidecar diagnostics, admin endpoint payloads, and tests must treat API keys, reference audio paths, transcripts, and provider error details as sensitive.
5. Provider diagnostics should show useful operational values without secrets: selected provider, capability labels, health state, latency, timeout, failure category, cache/model status, and redacted last error.
6. Settings changes that affect provider runtime should use the existing save-and-restart pattern unless upstream Phase 16/17 has already shipped a safe turn-boundary hot-swap API.

## Risks

| Risk | Mitigation |
|------|------------|
| Settings becomes one giant expert panel | Split Voice Output, Voice Input, and Diagnostics into compact sections with advanced disclosures. |
| Cloud STT accidentally rides existing LLM credentials | Add separate `audio.stt.cloud` credential fields and separate consent flags. |
| Logs expose transcripts, reference audio paths, or keys | Add central redaction helper and regression tests for config, diagnostics, and endpoint responses. |
| Phase 18 assumes upstream files that Phase 16/17 name differently | Plans include an upstream contract discovery task before edits. |
| Test synthesis/transcription bypasses the real provider path | Diagnostics must proxy Phase 16/17 admin test endpoints and label whether playback/envelope path was exercised. |

## Recommended Plan Shape

- Plan 18-01: Add persisted audio settings, cloud-STT consent, safe credential storage, IPC/preload types, and shared redaction helpers.
- Plan 18-02: Replace static TTS/Voice-in Settings with Voice Output and Voice Input sections using provider catalog labels and Basic/Advanced layout.
- Plan 18-03: Add diagnostics/status/test surfaces and regression tests proving secrets and sensitive text are redacted.

## Verification Focus

- `AUDIO-01`: provider cards show Local, Cloud, Chinese/English, Requires API key, Requires external service, and other upstream capabilities.
- `PRIV-01`: cloud STT providers are disabled by default and cannot be tested/enabled without explicit credentials and consent.
- `PRIV-02`: STT credentials, reference-audio paths, transcripts, and provider errors are redacted in settings, logs, and diagnostics.
- `PERF-02`: diagnostics expose latency, timeout, provider failure category, and health history without secrets.

## Research Result

No extra external research is needed for Phase 18. This phase is primarily integration and UI/settings work against this repository's existing Electron, React, sidecar admin, and safeStorage patterns. Provider-specific API research belongs to Phases 17 and 19.
