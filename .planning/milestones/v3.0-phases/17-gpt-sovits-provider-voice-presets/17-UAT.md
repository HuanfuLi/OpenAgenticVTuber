---
status: complete
phase: 17-gpt-sovits-provider-voice-presets
source:
  - 17-01-SUMMARY.md
  - 17-02-SUMMARY.md
  - 17-03-SUMMARY.md
  - 17-04-SUMMARY.md
  - 17-05-SUMMARY.md
  - 17-06-SUMMARY.md
  - 17-07-SUMMARY.md
  - 17-08-SUMMARY.md
  - 17-09-SUMMARY.md
  - 17-10-SUMMARY.md
  - 17-11-SUMMARY.md
  - 17-12-SUMMARY.md
updated: 2026-05-14
---

# Phase 17 UAT - GPT-SoVITS Provider + Voice Presets

## Current Status

Phase 17 is closed. The earlier partial UAT state was superseded by gap-closure plans 17-08 through 17-12 and later milestone acceptance.

The authoritative status is:

- GPT-SoVITS provider selection, health, test synthesis, activation, and explicit Piper fallback behavior passed.
- Voice preset CRUD, reference audio import, validation, duplicate-name handling, and active-preset reassignment passed.
- Active GPT-SoVITS chat no longer duplicates visible text after the 17-09 websocket subscription fix.
- GPT/SoVITS weight paths and synthesized text language are part of candidate validation after 17-11.
- Sentence delivery latency, renderer playback ordering, and lipsync/mouth velocity were addressed by 17-10 and 17-12.

## Live UAT Matrix

| ID | Scenario | Result | Notes |
|---|---|---|---|
| 17-UAT-01 | Provider selection and health gate | Pass | Piper remains selectable; GPT-SoVITS requires explicit health/test/activation. |
| 17-UAT-02 | App-managed launch controls | Pass | Command/cwd/health URL plus Start/Stop/Restart are available for app-owned process mode. |
| 17-UAT-03 | Reference audio import and validation | Pass | Imports use app-managed storage, validation is visible, and original absolute paths are not surfaced. |
| 17-UAT-04 | Voice preset management | Pass | Create, rename, select, delete, duplicate-name rejection, and active-preset reassignment passed after fixes. |
| 17-UAT-05 | Audible test synthesis | Pass | Test synthesis plays generated audio without sending a chat turn or writing conversation history. |
| 17-UAT-06 | Active GPT-SoVITS chat turn | Pass | User confirmed GPT-SoVITS runtime/chat used the selected voice; duplicate visible text was fixed. |
| 17-UAT-07 | Failed GPT-SoVITS turn and explicit Piper fallback | Pass | Failed audio remains visible as a provider failure and does not silently switch provider mid-turn. |
| 17-UAT-08 | Per-preset validation evidence | Pass | Matching validated presets can activate after current health; changed candidates require health/test again. |
| 17-UAT-09 | Duplicate GPT-SoVITS chat text regression | Pass | Renderer websocket subscription ownership prevents duplicate dispatch after module re-evaluation/HMR. |
| 17-UAT-10 | Sample-rate/lipsync alignment | Pass | Provider payload preparation aligns playback PCM/WAV/RMS behavior and keeps audible speech/lipsync coherent. |
| 17-UAT-11 | GPT/SoVITS weight and text-language selection | Pass | Candidate health/test uses the selected preset and surfaces set-weight failures instead of false health success. |
| 17-UAT-12 | Lipsync velocity and sentence latency | Pass | Websocket delivery no longer waits on sidecar local playback; renderer audio is queued; mouth movement is damped. |

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Regression Evidence

| Area | Evidence |
|---|---|
| Provider, admin, and boot paths | Sidecar GPT-SoVITS provider/admin/gateway/boot tests passed across 17-08 through 17-12 summaries. |
| Renderer settings and chat paths | Settings and ChatStreaming focused tests passed after preset, activation, duplicate-dispatch, and failed-audio fixes. |
| Electron IPC and safe storage | GPT-SoVITS IPC, safe-storage, and reference-audio tests passed after preset/reference association fixes. |
| Contracts | Contract generation/checks were run during the phase; generated contract artifacts are present. |
| Runtime latency/lipsync | 17-12 sidecar TTS manager, speech-driver, renderer audio-player, WS audio, and build/typecheck verification passed. |

## Known Residual Risk

- Full live GPT-SoVITS coverage still depends on the user's external GPT-SoVITS server/model setup being available.
- Invalid weight-path and provider-server failure behavior is covered by route/provider tests; live external-server retesting is environment-dependent.
- Phase 17 intentionally does not install, train, or manage GPT-SoVITS model assets beyond optional app-managed launch.
