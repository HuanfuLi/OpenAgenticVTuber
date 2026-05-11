# Phase 20 Gap Review: Live Voice Input UI/UX

**Date:** 2026-05-11
**Source:** User live UAT report after Phase 20 automated verification

## Reported Symptoms

1. Chat shows `Sidecar is not ready` on app start, and the error cannot be closed after sidecar becomes ready.
2. The mic button stays disabled, blocking push-to-talk.
3. After switching STT config, Chat still shows `Voice input is disabled in Voice settings.`
4. The local model download appears to complete immediately, which looks like mock behavior.

## Audit Findings

| ID | Finding | Severity | Evidence |
|----|---------|----------|----------|
| GAP-20-01 | Startup sidecar-unavailable readiness is stored as durable voice error and Chat refreshes readiness only once on mount. | blocker | `apps/renderer/src/state/voice-input-store.ts` stores readiness failures in `error`; `apps/renderer/src/screens/Chat/VoiceInputControl.tsx` does not subscribe to sidecar-ready/config-save events. |
| GAP-20-02 | Settings STT test result readiness is not persisted into the saved STT config. | blocker | `runSttTest` stores `testResult` and `statusText`, but `saveVoiceInput` saves the existing `sttConfig` without `result.readiness`. |
| GAP-20-03 | Chat readiness does not refresh after Voice settings save/restart, so stale disabled/config errors remain visible. | blocker | Settings save restarts sidecar via `saveStoredConfig`; Chat voice store has no invalidation/refresh path tied to config saves or sidecar-ready. |
| GAP-20-04 | Local STT model download is a placeholder that creates a marker directory and immediately reports `downloaded`. | blocker | `sidecar/src/sidecar/admin/audio.py` calls `download_placeholder`; `sidecar/src/sidecar/stt/model_cache.py` treats path existence as downloaded. |
| GAP-20-05 | Voice settings copy can read as a VAD model download even though VAD is browser RMS threshold logic and model-free. | warning | VAD settings and local STT model cache controls live in the same Voice Input section without a clear boundary label. |

## Gap Closure Strategy

- `20-05`: Fix live readiness lifecycle and STT enablement persistence so Chat can recover after sidecar/config changes and PTT is not blocked by stale errors.
- `20-06`: Replace placeholder model-cache behavior with truthful unavailable/manual-cache semantics unless a real provider download is implemented, and clarify STT model cache vs VAD controls.

## Verification Focus

- Chat recovers from startup `sidecar_unavailable` after sidecar-ready and clears stale blocking errors.
- A passing Settings STT test persists readiness into stored config before voice input is considered enabled.
- Changing/saving Voice settings triggers Chat readiness invalidation/refresh.
- Local model cache UI no longer claims immediate model download unless real model files are present.
- VAD copy clearly states it is browser volume detection and does not use a downloaded VAD model.
