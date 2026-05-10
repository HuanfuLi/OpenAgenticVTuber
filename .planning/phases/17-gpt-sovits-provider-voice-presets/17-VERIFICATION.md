---
phase: 17-gpt-sovits-provider-voice-presets
verified: 2026-05-09T20:40:13Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
residual_risk:
  - "Live GPT-SoVITS server UAT remains environment-blocked; 17-UAT.md records the blocked probe and checklist. Code-level mocked/provider coverage and static wiring checks pass the goal-backward criteria."
---

# Phase 17: GPT-SoVITS Provider + Voice Presets Verification Report

**Phase Goal:** Users can choose GPT-SoVITS for character voice output, validate it before use, and organize voice presets without losing Piper fallback safety.
**Verified:** 2026-05-09T20:40:13Z
**Status:** passed
**Re-verification:** No — initial verification after review fixes

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can select Piper or GPT-SoVITS as the active TTS provider and run test synthesis without sending a chat turn. | ✓ VERIFIED | Settings exposes Piper/GPT-SoVITS radio rows (`Settings.tsx:1424-1437`). Piper selection saves `active_provider: 'piper'` immediately (`Settings.tsx:1217-1236`). GPT-SoVITS activation is gated by health + test + reference preset (`Settings.tsx:1210`, `1286-1321`). Test synthesis calls preload `testGptSoVitsSynthesis`, decodes returned base64 into Blob/Audio preview, and never touches chat/history (`Settings.tsx:1112-1121`, `1260-1284`). Renderer tests assert no `commitConversationTurn` side effect (`Settings.test.tsx:455-470`). |
| 2 | User can configure GPT-SoVITS external-server settings or optional app-managed launch command with health, stop, restart controls. | ✓ VERIFIED | External mode uses one base URL (`Settings.tsx:1446-1455`) and shows external-stop copy (`Settings.tsx:1490-1492`). App-managed mode shows command, working directory, health URL, start/stop/restart controls (`Settings.tsx:1470-1488`). Process manager spawns only the user command/cwd and tracks/kills only the app-owned child tree (`gpt-sovits-process.ts:133-155`, `170-184`); stop with no tracked process returns `not_app_managed` (`gpt-sovits-process.ts:96-105`, `157-158`). IPC/preload expose health/test/process controls (`ipc.ts:281-322`, `preload/index.ts:120-134`). |
| 3 | User can create, rename, select, and delete named voice presets with backend-specific tuning controls. | ✓ VERIFIED | Preset contract owns GPT-SoVITS tuning/reference fields and excludes provider connection fields (`voice_preset.py:10-31`; `base_url` absent). Stored config persists `voicePresets` and `activePresetByAvatarSession` (`safe-storage.ts:40-49`, `94-119`). Settings can save/create/rename presets (`Settings.tsx:1324-1349`), select association by avatar/session (`1351-1361`), and delete with active-preset guard (`1363-1380`, `1612-1634`). Renderer tests cover create/rename/select/delete and no avatar catalog mutation (`Settings.test.tsx:510-544`). |
| 4 | User can import GPT-SoVITS reference audio into sanitized app-managed storage and see validation failures before using it. | ✓ VERIFIED | Electron copies imports under `userData/reference-audio` with sanitized basename and stores only managed token (`reference-audio.ts:51-59`, `77-85`, `109-145`). Sidecar validates managed path, allowed formats, soundfile-readable metadata, and 1–30s duration (`audio.py:237-321`). IPC validates before saving (`ipc.ts:390-412`). Settings requires transcript/language before import and displays managed asset validation summary without original absolute path (`Settings.tsx:1527-1580`). Tests cover sanitized copy and invalid validation proxy (`reference-audio.test.ts:54-131`) and UI no absolute path (`Settings.test.tsx:567-601`). |
| 5 | When GPT-SoVITS fails, user sees visible failure/fallback state and app never silently changes provider mid-turn. | ✓ VERIFIED | Provider failures become typed `TTSProviderError` (`gpt_sovits_provider.py:51-93`, `149-170`). `TTSTaskManager` converts failures to ordered `AudioPayloadMessage(audio=None, failed_audio=...)` and does not call Piper fallback (`tts_manager.py:130-158`, `299-300`). Renderer store only marks failures when `audio === null` plus `failed_audio.provider_id === 'gpt_sovits'`, does not save config, and sets visible fallback banner (`store.ts:75-97`). Chat renders sentence text plus concise failure/log copy (`Chat.tsx:146-150`, `160-164`). Tests assert no audio playback, no config save, and explicit next-turn Piper path only (`ChatStreaming.test.tsx:116-189`; Settings Piper path at `Settings.test.tsx:342-364`). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/contracts/py/contracts/audio_provider.py` | Provider config, health, test-synthesis, activation gates | ✓ VERIFIED | Defines `AudioConfig`, `TTSProviderConfig`, `GptSoVitsProviderConfig`, `GptSoVitsHealthRequest`, and `GptSoVitsTestSynthesisResult` (`audio_provider.py:33-123`). |
| `packages/contracts/py/contracts/voice_preset.py` | Voice presets, reference assets, active associations | ✓ VERIFIED | Defines `VoicePreset`, GPT tuning, `ReferenceAudioAsset` with managed-token validator, and library/association contracts (`voice_preset.py:10-65`). |
| `apps/electron-main/src/reference-audio.ts` | Sanitized import/delete guard helpers | ✓ VERIFIED | Uses app-managed directory, path containment, sanitized basenames, sidecar validation, in-use delete guard (`reference-audio.ts:51-160`). |
| `sidecar/src/sidecar/tts/gpt_sovits_provider.py` | GPT-SoVITS HTTP adapter | ✓ VERIFIED | Synth-only `/tts` adapter with typed timeout/service/reference failures; no playback/fallback ownership (`gpt_sovits_provider.py:18-194`). |
| `sidecar/src/sidecar/admin/audio.py` | Health, test-synthesis, reference validation endpoints | ✓ VERIFIED | `/admin/audio/gpt-sovits/health`, `/test-synthesis`, and `/reference-audio/validate` implemented (`audio.py:168-321`). |
| `apps/electron-main/src/gpt-sovits-process.ts` | App-owned process lifecycle | ✓ VERIFIED | Tracks one child handle, stops only tracked app-owned process/tree, returns external/not-app-managed state otherwise (`gpt-sovits-process.ts:56-80`, `133-190`). |
| `apps/renderer/src/screens/Settings/Settings.tsx` | Provider/preset/reference/test UI | ✓ VERIFIED | Contains provider selection, activation gate, preview playback, preset CRUD, reference import/delete guards, app-managed controls (`Settings.tsx:1045-1658`). |
| `apps/renderer/src/ws/store.ts` and `apps/renderer/src/screens/Chat/Chat.tsx` | Failed-audio chat surface | ✓ VERIFIED | Routes failed GPT-SoVITS audio metadata to streaming state/banner and renders concise sentence failure copy (`store.ts:75-97`, `Chat.tsx:146-164`). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Settings UI | Electron preload | `window.api.checkGptSoVitsHealth`, `testGptSoVitsSynthesis`, preset/reference/process methods | ✓ WIRED | Calls in `Settings.tsx:1251-1284`, `1324-1419`; preload methods in `preload/index.ts:120-155`. |
| Electron IPC | Sidecar admin | `/admin/audio/gpt-sovits/health`, `/admin/audio/test-synthesis`, `/admin/audio/reference-audio/validate` | ✓ WIRED | IPC proxy in `ipc.ts:281-309`, reference validation/import in `ipc.ts:375-412`; sidecar endpoints in `audio.py:168-321`. |
| Stored config active preset | Sidecar boot | `AGENTICLLMVTUBER_VOICE_PRESET_CONFIG_JSON` active map → `build_tts_gateway()` | ✓ WIRED | Sidecar resolves active preset/reference (`server.py:136-173`) before constructing GPT provider (`server.py:335-342`, `tts_gateway.py:77-108`). Review fix confirmed same-save activation ordering (`17-REVIEW.md:24-30`). |
| GPT-SoVITS provider | Ordered playback path | `TTSTaskManager` provider synthesis, payload preparation, failure payload | ✓ WIRED | Provider synth result feeds existing `prepare_payload_from_pcm` path (`tts_manager.py:223-234`); failures emit failed-audio payload without Piper fallback (`tts_manager.py:130-158`). |
| Failed audio payload | Chat UI | `AudioPayloadMessage(audio=null, failed_audio.provider_id='gpt_sovits')` | ✓ WIRED | Store routes failed metadata to streaming state/banner (`store.ts:75-97`); Chat renders sentence-level failure/log copy (`Chat.tsx:146-150`). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Settings TTS UI | `storedCfg`, `voicePresets`, `referenceAudioAssets`, `audioStatus` | Preload calls to safe storage and audio status (`Settings.tsx:1165-1195`) | Yes — IPC loads stored config/presets/status (`ipc.ts:237-280`, `339-374`) | ✓ FLOWING |
| Test synthesis preview | `result.audio_base64` | Sidecar `/admin/audio/test-synthesis` returns base64 WAV (`audio.py:181-234`) through IPC (`ipc.ts:293-309`) | Yes — provider synth output converted to WAV base64 (`audio.py:111-119`, `211-222`) | ✓ FLOWING |
| Reference audio library | `referenceAudioAssets` | Native file picker/import, app-managed copy, sidecar validation (`ipc.ts:390-412`) | Yes — persisted after validation, displayed by managed token (`Settings.tsx:1552-1580`) | ✓ FLOWING |
| Chat failed-audio UI | `audioFailures`, `banner` | WebSocket audio payload with `failed_audio` (`store.ts:75-97`) | Yes — sidecar failure path creates metadata (`tts_manager.py:140-155`) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Sidecar GPT-SoVITS/provider/reference/boot tests | `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py sidecar/tests/test_sidecar_boot.py -q` | 41 passed in 10.46s | ✓ PASS |
| Contract drift check | `npm run check:contracts` | Could not complete in this verifier environment: `json-schema-to-typescript` subprocess via `npx` exited nonzero during codegen. Prior phase evidence records pass; codegen outputs are present. | ? ENV BLOCKED |
| Renderer/Electron Vitest suites | `npm --workspace apps/renderer run test ...`; `npm --workspace apps/electron-main run test ...` | Could not run in this verifier environment because `vitest` is not on PATH / dependencies unavailable. Prior `17-REVIEW-FIX.md` records pass after fixes. | ? ENV BLOCKED |
| Live GPT-SoVITS server UAT | `Invoke-WebRequest http://127.0.0.1:9880/docs` per `17-UAT.md` | Blocked: no live GPT-SoVITS server available in environment. | ? ENV BLOCKED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TTS-01 | 17-01, 17-02, 17-04, 17-06, 17-07 | Select Piper or GPT-SoVITS active TTS provider | ✓ SATISFIED | Settings provider selection and activation save paths (`Settings.tsx:1217-1236`, `1286-1321`). |
| TTS-02 | 17-01..17-06 | Configure external-server settings and health check | ✓ SATISFIED | One base URL UI, health IPC and sidecar endpoint (`Settings.tsx:1446-1455`, `ipc.ts:281-292`, `audio.py:168-178`). |
| TTS-03 | 17-01, 17-05, 17-06 | Optional app-managed launch command/cwd/health URL and stop/restart | ✓ SATISFIED | App-managed UI and process manager (`Settings.tsx:1470-1488`, `gpt-sovits-process.ts:133-190`). |
| TTS-04 | 17-01, 17-03, 17-04, 17-06, 17-07 | Test synthesis without chat turn | ✓ SATISFIED | Test endpoint + preview playback; tests assert no conversation commit (`audio.py:181-234`, `Settings.tsx:1260-1284`, `Settings.test.tsx:455-470`). |
| TTS-06 | 17-01..17-07 | Visible fallback/error state; no silent mid-turn provider change | ✓ SATISFIED | Failed-audio payload and chat banner; no config save in failure reducer (`tts_manager.py:130-158`, `store.ts:75-97`, `ChatStreaming.test.tsx:146-189`). |
| PRESET-01 | 17-01, 17-02, 17-06, 17-07 | Create/rename/select/delete presets | ✓ SATISFIED | Preset CRUD UI/IPCs (`Settings.tsx:1324-1380`, `ipc.ts:339-374`). |
| PRESET-02 | 17-01, 17-02, 17-03, 17-06, 17-07 | Backend-specific tuning controls | ✓ SATISFIED | Contract and draft preset include GPT-SoVITS knobs (`voice_preset.py:10-24`, `Settings.tsx:1085-1109`). |
| PRESET-03 | 17-01, 17-02, 17-03, 17-06, 17-07 | Import/manage reference audio with validation and sanitized storage | ✓ SATISFIED | App-managed import + sidecar validation (`reference-audio.ts:109-145`, `audio.py:237-321`). |
| PRESET-04 | 17-01, 17-02, 17-06, 17-07 | Associate active avatar/session with preset without avatar catalog mutation | ✓ SATISFIED | Active map key and IPC association (`safe-storage.ts:102-119`, `Settings.tsx:1300-1319`, `ipc.ts:361-374`); no `AvatarOverrides` use in Settings TTS path. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `apps/renderer/src/screens/Settings/Settings.tsx` | 1715, 1749 | `return null` in dialog guards | ℹ️ Info | Normal React conditional render, not a stub. |
| `apps/renderer/src/screens/Settings/Settings.tsx` | 1844, 1855 | `PLACEHOLDERS` for unrelated future sections | ℹ️ Info | Existing placeholder sections outside TTS scope; Phase 17 TTS section is implemented. |
| `apps/renderer/src/ws/store.ts` | 35, 60 | `commitConversationTurnFromDispatcher` | ℹ️ Info | Existing chain-end persistence path; failed GPT-SoVITS banner marks pending turn failed so no failed turn is committed (`useStreamingMessages.ts:239-252`). |

### Human Verification Required

None blocking for this verification per user instruction: live GPT-SoVITS server UAT is environment-blocked and documented in `17-UAT.md`. Residual risk remains until a real server/model/reference-audio setup is available.

### Gaps Summary

No blocking implementation gaps found. The five roadmap success criteria are supported by substantive, wired code across contracts, Electron IPC/preload, sidecar provider/admin endpoints, Settings UI, chat failure surfaces, and regression tests. Review blockers are fixed and focused re-review is clean (`17-REVIEW.md:24-30`).

---

_Verified: 2026-05-09T20:40:13Z_
_Verifier: the agent (gsd-verifier)_
