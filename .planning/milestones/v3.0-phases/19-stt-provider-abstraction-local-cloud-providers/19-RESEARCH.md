# Phase 19 Research: STT Provider Abstraction + Local/Cloud Providers

**Phase:** 19 - STT Provider Abstraction + Local/Cloud Providers
**Milestone:** v3.0 Rich Voice Configuration + Voice Input
**Date:** 2026-05-09
**Status:** Ready for planning

## Scope

Phase 19 adds the sidecar STT provider layer and Settings-only validation path for transcription providers. It owns FunASR/SenseVoiceSmall, faster-whisper, OpenAI, Groq, explicit local model download/cache controls, provider health, test transcription, and provider readiness gates.

This phase does not implement chat voice submission, push-to-talk chat UX, VAD preview, streaming transcript preview, code-switch scoring, AEC, wake word, translation, or silent provider fallback. Those remain Phase 20+ work.

## Inputs

- `.planning/ROADMAP.md` Phase 19 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` requirements `STT-01` through `STT-06` and `PERF-01`.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` user decisions `D-01` through `D-20`.
- `.planning/research/v3.0/SUMMARY.md` Phase 19 recommendation and risk flags.
- `.planning/research/v3.0/STACK.md` STT package recommendations and packaging warnings.
- `.planning/research/v3.0/ARCHITECTURE.md` sidecar STT provider boundary and future `/voice/ws` separation.
- `.planning/research/v3.0/PITFALLS.md` local model download, cloud privacy, provider failure, sample-rate, and event-loop risks.
- Current code in `packages/contracts/py/contracts/audio_provider.py`, `sidecar/src/sidecar/audio/config.py`, `sidecar/src/sidecar/admin/audio.py`, `apps/electron-main/src/ipc.ts`, `apps/electron-main/preload/index.ts`, and `apps/renderer/src/screens/Settings/Settings.tsx`.

## Current System Facts

- The Pydantic/TS contract surface already reserves STT provider ids: `funasr`, `faster_whisper`, `openai`, and `groq`.
- `AudioConfig.stt` currently has only `enabled`, `active_provider`, `capture_timeout_ms`, and `execution`.
- The sidecar has a minimal `/admin/audio/status` endpoint and no STT catalog, model cache, readiness, or test-transcription endpoints.
- `safe-storage.ts` already persists `audio` in `StoredConfig` and passes audio config to the sidecar as `AGENTICLLMVTUBER_AUDIO_CONFIG_JSON`.
- Settings currently has a TTS status section and a placeholder `Voice in` section; Phase 19 should extend the existing Settings long-scroll UI rather than creating a setup wizard.
- Sidecar `pyproject.toml` currently has no FunASR, ModelScope, faster-whisper, OpenAI, Groq, soundfile, or torch dependencies.
- Current TTS provider execution uses `asyncio.to_thread` from `TTSTaskManager`; STT should follow the same non-event-loop rule for provider work.
- Phase 17 and 18 artifacts exist as planning files, but execution is still in progress. Phase 19 plans must include upstream-discovery tasks and adapt to the actual Phase 17/18 output names at execution time.

## External Provider Check

Current official docs still support the planned provider choices:

- FunASR documents broad ASR/VAD/punctuation functionality and lists SenseVoiceSmall as a multilingual model supporting ASR, ITN, language identification, emotion recognition, and audio event detection for languages including Chinese and English-family targets. It requires Python, torch, torchaudio, and optional ModelScope/Hugging Face model access.
- faster-whisper remains a CTranslate2-backed local Whisper implementation. Its README shows CPU INT8 and GPU FP16/INT8 usage paths, which fits the Phase 19 "minimal safe defaults, advanced later" decision.
- OpenAI's Speech-to-Text docs expose `/v1/audio/transcriptions` with current transcription models such as `gpt-4o-transcribe`, response-format controls, prompts, timestamps for supported models, and file-size considerations.
- Groq's Speech-to-Text docs expose OpenAI-compatible audio transcription endpoints with `whisper-large-v3` and `whisper-large-v3-turbo`, both multilingual, with explicit speed/quality tradeoffs.

The plan should avoid hard-coding latest cloud model names into irreversible config migrations. Seed defaults can be configurable and provider-catalog driven.

## Key Planning Decisions

1. Add a provider-neutral `STTProvider` contract in the sidecar with `health`, `transcribe`, and lazy initialization. Provider modules must not import heavy ML stacks at sidecar boot.
2. Add contract types for provider catalog, local model catalog/cache state, download/remove operations, test transcription request/result, and readiness gate state.
3. Treat local provider use as two steps: explicit model download/cache availability first, then explicit health plus successful test transcription.
4. Represent readiness as invalidatable state tied to provider id, model id/path, cache path, credentials, endpoint, and language mode.
5. Make FunASR/SenseVoiceSmall the recommended local default and faster-whisper a visible local fallback, but let tests mock providers so CI never depends on global model caches.
6. Keep cloud providers behind persistent consent and provider-specific credentials. Cloud tests are blocked until both are present.
7. Use in-memory WAV wrapping for Settings test audio where possible, and discard raw test audio immediately after the test request completes.
8. Keep the Settings recorder narrow: short/manual, no chat submission, no VAD/PTT UX, no transcript history.
9. Runtime provider failure disables/unreadies the selected provider until another health check and test pass. Do not silently fall back.

## Risks

| Risk | Mitigation |
|------|------------|
| FunASR or faster-whisper import slows app boot | Import inside provider load/test paths only; add boot tests that monkeypatch import failure and verify sidecar status still responds. |
| Model downloads happen implicitly by provider name | Add app-managed model catalog/cache layer; provider adapters accept local paths after explicit download. |
| CI or developer tests rely on cached models | Unit tests use fake providers and fake cache stores; integration tests for real models are manual/optional. |
| Cloud provider error leaks keys, transcript text, paths, or raw exceptions | Normalize to error categories and redacted diagnostics before Electron/renderer sees payloads. |
| Cloud test sends audio without consent | Electron and sidecar both enforce credential plus consent checks before network call. |
| STT enablement becomes a plain toggle | Gate enablement on health plus non-empty test transcript; invalidate on relevant config changes. |
| Settings test recorder grows into Phase 20 voice UX | Keep recorder under Settings provider validation only; no chat submit, preview streaming, VAD, or PTT state machine. |

## Recommended Plan Shape

- Plan 19-01: STT contracts, provider registry, model-cache/readiness state, admin endpoint skeletons, and lazy-load boot guards.
- Plan 19-02: Local provider adapters for FunASR/SenseVoiceSmall and faster-whisper plus explicit model download/remove/status implementation.
- Plan 19-03: OpenAI and Groq cloud adapters with consent/credential gating, in-memory upload handling, and redacted diagnostics.
- Plan 19-04: Electron/preload bridge and Settings Voice Input UI with cache controls, short test recorder, provider readiness gate, and final regression/UAT.

## Verification Focus

- `STT-01`: FunASR/SenseVoiceSmall appears as the recommended local default and can be tested/enabled after explicit model availability.
- `STT-02`: faster-whisper appears as a local fallback and follows the same cache/test/readiness rules.
- `STT-03` and `STT-04`: OpenAI and Groq can only run after explicit cloud consent and provider credentials.
- `STT-05`: selected provider test transcription returns a non-empty transcript with diagnostics before enablement.
- `STT-06`: local model cache path, size/status, download, and remove controls are visible and functional.
- `PERF-01`: sidecar boot and app startup do not import heavy STT stacks, download models, load models, or idle-preload providers.

## Research Result

Phase 19 should be planned as a four-plan implementation with a contract/cache foundation, two provider-adapter tracks, and a Settings readiness/test UI capstone. Current external docs support the chosen provider set, but implementation should keep cloud model ids configurable and keep all local ML dependencies lazy/import-guarded.

## Sources

- FunASR official repository: https://github.com/modelscope/FunASR
- faster-whisper official repository: https://github.com/SYSTRAN/faster-whisper
- OpenAI Speech-to-Text docs: https://developers.openai.com/api/docs/guides/speech-to-text
- Groq Speech-to-Text docs: https://console.groq.com/docs/speech-to-text
