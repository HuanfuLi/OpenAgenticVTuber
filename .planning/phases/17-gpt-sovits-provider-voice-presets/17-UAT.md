# Phase 17 UAT — GPT-SoVITS Provider + Voice Presets

**Date:** 2026-05-10  
**Plan:** 17-07 Chat failure surface, final regression, and UAT  
**Status:** Automated regression PASS; live GPT-SoVITS server UAT BLOCKED by environment

## Automated Regression Evidence

| Check | Result | Evidence |
|---|---:|---|
| Contracts drift | PASS | `npm run check:contracts` completed and `git diff --exit-code packages/contracts/ts/ packages/contracts/generated/` returned clean. |
| Renderer Settings + Chat failure tests | PASS | `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` passed: 2 files, 43 tests. |
| Renderer typecheck | PASS | `npm --workspace apps/renderer run typecheck` passed. |
| Electron main build | PASS | `npm --workspace apps/electron-main run build` passed for main, preload, and renderer bundles. |
| Sidecar focused tests | PASS | `python -m pytest ...` was unavailable because system Python lacks pytest; fallback `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py -q` passed: 32 tests. |
| No silent fallback grep gate | PASS | Git-tracked `apps`, `sidecar`, and `packages` search for `silent.*fallback\|fallback.*mid-turn`, excluding allowed documentation/negative assertions, found no implementation matches. |
| Chat failed-audio UX | PASS | `ChatStreaming.test.tsx` verifies `audio=null` + `failed_audio.provider_id='gpt_sovits'` appends sentence text once, displays failed-audio copy, shows next-turn Piper fallback notice, does not play audio, and does not save config. |
| Settings explicit Piper fallback path | PASS | `Settings.test.tsx` verifies selecting `Piper local TTS` explicitly saves `active_provider: 'piper'` for subsequent turns without GPT-SoVITS gates. |
| Test synthesis isolation | PASS | `Settings.test.tsx` verifies test synthesis uses Blob/Audio preview and does not call chat/conversation-history APIs. |

## Live GPT-SoVITS Server Availability

**Result:** BLOCKED BY ENVIRONMENT

Probe attempted by automation:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:9880/docs" -UseBasicParsing -TimeoutSec 3
```

Observed result: unable to connect to the remote server. No live GPT-SoVITS API v2 server is available in this execution environment, so manual audible synthesis and mid-turn live server shutdown checks could not be completed here.

## Manual Live-Server Checklist

When a GPT-SoVITS API v2 server is available, run this checklist and record observed pass/fail:

1. Start or provide a GPT-SoVITS API v2 server, normally at `http://127.0.0.1:9880`, with reference audio accessible to that server.
2. Open Settings → TTS. Confirm Piper remains active initially.
3. Enter GPT-SoVITS base URL. Run health check. Expected: health can pass without activation; helper says test synthesis is still required.
4. Import reference audio. Expected: UI shows managed asset metadata, transcript/language fields, and validation summary; it does not show the original absolute path.
5. Create a voice preset and click `Test synthesis`. Expected: audible/previewable result without sending a chat turn or adding conversation history.
6. Click `Activate voice preset`. Expected: `GPT-SoVITS is active for the next turn.`
7. Send a chat turn. Expected: sentence text appears, audio plays through existing renderer payload/RMS/lipsync path.
8. Stop the external server during a later GPT-SoVITS turn. Expected: affected sentence text remains visible, audio is marked failed, logs have detail, and the app does not switch to Piper until the user explicitly selects Piper for a next turn.

## UAT Status Matrix

| Behavior | Status | Notes |
|---|---:|---|
| Provider/preset/reference contracts and storage integrity | PASS (automated) | Covered by contracts, Settings, Electron bridge, and sidecar tests from Phase 17. |
| Health + test synthesis gates before activation | PASS (automated), LIVE BLOCKED | Mocked/admin and Settings tests pass; real server unavailable for audible confirmation. |
| Test synthesis has no chat-turn side effect | PASS (automated) | Verified via Settings test assertions against `commitConversationTurn`. |
| Failed GPT-SoVITS chat sentence remains visible | PASS (automated), LIVE BLOCKED | Renderer failed-audio tests pass; real server shutdown scenario unavailable. |
| No silent mid-turn Piper fallback | PASS (automated), LIVE BLOCKED | Sidecar manager tests, renderer tests, Settings explicit Piper test, and grep gate pass. |
| Explicit Piper fallback for subsequent turns | PASS (automated) | Settings selection path saves `active_provider: 'piper'`; chat reducer does not mutate config. |

## Manual Evidence Slot

Live-server UAT remains blocked until a GPT-SoVITS server and accessible reference audio are available.

- **Live server URL:** not available
- **Reference audio:** not available
- **Tester:** not run
- **Observed result:** environment-blocked
- **Follow-up needed:** run the checklist above during `/gsd-verify-work` or a later live UAT session.
