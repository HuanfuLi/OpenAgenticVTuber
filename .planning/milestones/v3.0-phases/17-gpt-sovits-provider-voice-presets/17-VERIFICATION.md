---
phase: 17-gpt-sovits-provider-voice-presets
verified: 2026-05-10T05:25:00Z
status: passed
score: 5/5 roadmap must-haves verified; 7/7 UAT tests passed
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed:
    - "17-08 UAT blocker: already validated matching GPT-SoVITS presets no longer require redundant test synthesis before activation; new/changed candidates still require current health plus successful test synthesis."
    - "17-09 UAT Test 6 duplicate-dispatch gap: renderer WS store registration is idempotent, retains unsubscribe handles, disposes on Vite HMR, and focused ChatStreaming regression tests pass."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "UAT Test 6 live active GPT-SoVITS chat turn retest"
    status: passed
    evidence: "User confirmed live retest passed after Plan 17-09; duplicated visible text chunks are gone."
residual_risk:
  - "Future GPT-SoVITS regressions still depend on live external-server availability for full end-to-end retest; automated mocked/provider coverage covers the renderer duplicate-dispatch root cause."
---

# Phase 17: GPT-SoVITS Provider + Voice Presets Verification Report

**Phase Goal:** Users can choose GPT-SoVITS for character voice output, validate it before use, and organize voice presets without losing Piper fallback safety.
**Verified:** 2026-05-10T05:25:00Z
**Status:** passed
**Re-verification:** Yes — after 17-09 UAT Test 6 gap closure

## Goal Achievement

### 17-09 UAT Test 6 Gap Closure Re-Verification

| Question | Status | Evidence |
|---|---|---|
| Does `store.ts` retain unsubscribe handles from `subscribe` and `subscribeSidecarReconnect`? | ✓ VERIFIED | `unsubscribeMessages` and `unsubscribeSidecarReconnect` are module-level handles (`apps/renderer/src/ws/store.ts:51-52`), assigned from `subscribe(dispatchWSMessage)` and `subscribeSidecarReconnect(dispatchSidecarReconnect)` (`store.ts:134-140`), invoked and nulled during dispose (`store.ts:143-148`). |
| Is WS store registration idempotent when called more than once? | ✓ VERIFIED | `ensureWSStoreSubscriptions()` only subscribes when each handle is null (`store.ts:134-140`). The focused test calls it twice and asserts one message listener and one reconnect listener (`apps/renderer/tests/ChatStreaming.test.tsx:161-170`). |
| Does Vite HMR disposal unsubscribe message/reconnect listeners? | ✓ VERIFIED | `import.meta.hot.dispose(() => disposeWSStoreSubscriptions())` is wired in `store.ts:152-155`; dispose invokes both retained unsubscribe functions (`store.ts:143-145`). |
| Does automatic module-load registration still happen for runtime imports? | ✓ VERIFIED | `ensureWSStoreSubscriptions()` is still called at module load before the HMR dispose hook (`store.ts:150-155`), so importing `@/ws/store` registers the dispatcher once. |
| Does one normal audio payload after Thinking produce visible text once, not `Hello!Hello!`? | ✓ VERIFIED | Audio dispatch still calls `appendAssistantSentence(...)` once per store listener and `playAudioPayload` only for non-empty audio (`store.ts:78-99`). The regression test sends `conversation-chain-start`, dispatches one `Hello!` audio payload through `wsClientMock.dispatch`, and asserts one assistant message with text `Hello!`, not `Hello!Hello!`, plus one playback call (`ChatStreaming.test.tsx:172-184`). |
| Does failed GPT-SoVITS audio visible text stay once with one audio failure marker and no Piper auto-switch? | ✓ VERIFIED | Failed GPT-SoVITS audio passes failure metadata to `appendAssistantSentence`, sets the GPT-SoVITS banner, does not call `playAudioPayload` because `msg.audio` is null, and never saves provider config (`store.ts:78-99`). Tests assert one visible failed sentence, one `audioFailures` entry, no playback, and no `saveStoredConfig` auto-switch (`ChatStreaming.test.tsx:186-200`, `203-242`). |
| Do tests cover duplicate registration/HMR simulation through the real store dispatcher path? | ✓ VERIFIED | The test imports the real `@/ws/store`, calls `ensureWSStoreSubscriptions()` twice, and dispatches via the mocked client listener set rather than calling `appendAssistantSentence` directly (`ChatStreaming.test.tsx:21-43`, `72-74`, `161-200`). |
| Does `17-UAT.md` record Plan 17-09 automated evidence and final live retest outcome accurately? | ✓ VERIFIED | Plan 17-09 evidence is recorded separately, Test 6 was not marked passed until user retest, and it is now `result: pass` after user confirmation (`17-UAT.md:60-64`, `181-192`). |

Focused automated re-verification commands passed in this verifier run:

- `npm --workspace apps/renderer run test -- --run ChatStreaming.test.tsx` — PASS (8 tests)
- `npm --workspace apps/renderer run typecheck` — PASS

**Plan 17-09 score:** 4/4 must-haves verified. The renderer implementation is sound, and the live UAT Test 6 retest is now user-confirmed passed.

### 17-08 UAT Gap Closure Re-Verification

| Question | Status | Evidence |
|---|---|---|
| Durable per-preset validation metadata exists on `VoicePreset`. | ✓ VERIFIED | Python source contract defines `GptSoVitsPresetValidation` and `VoicePreset.validation` (`packages/contracts/py/contracts/voice_preset.py:26-42`); generated TS exposes `validation: GptSoVitsPresetValidation \| null` (`packages/contracts/ts/voice-preset.ts:16-48`); JSON schema includes the validation definition and field (`packages/contracts/generated/json-schema/voice-preset.schema.json:172`, `380`). |
| Fingerprint computation is shared between renderer and Electron main from the same module. | ✓ VERIFIED | Shared helper lives in `packages/contracts/ts/gpt-sovits-validation.ts`; Settings imports it via `@contracts/gpt-sovits-validation` (`Settings.tsx:20-24`); Electron main safe-storage re-exports the same helper module (`safe-storage.ts:13-16`). |
| Fingerprint excludes display-only `name` and includes the 17-08 synthesis-affecting fields. | ✓ VERIFIED | Helper payload includes provider `base_url`, `request_timeout_ms`, launch mode/command/cwd, `preset_id`, reference/prompt/language/tuning/media/streaming fields (`gpt-sovits-validation.ts:108-137`) and does not reference `preset.name`; safe-storage tests prove rename stability and invalidation on base URL, launch, reference, prompt, and tuning changes (`safe-storage.test.ts:190-210`). |
| Successful test synthesis persists proof to the selected preset. | ✓ VERIFIED | `runTestSynthesis` writes `validation: { state: 'validated', fingerprint, validated_at, health_checked_at, test_synthesis_at, summary }` through `window.api.saveVoicePreset` only after `result.ok` (`Settings.tsx:1363-1395`); renderer test asserts the saved preset carries matching validation metadata (`Settings.test.tsx:559-580`). |
| Failed test synthesis avoids writing proof/activation. | ✓ VERIFIED | Failed result path clears `testPassed`/`lastTestFingerprint`, sets failure copy, and returns before save/activation (`Settings.tsx:1368-1377`); renderer test verifies failed synthesis does not save active GPT-SoVITS config (`Settings.test.tsx:434-461`). |
| Matching already validated presets activate without another test synthesis after current health is OK. | ✓ VERIFIED | Activation readiness accepts `selectedValidationState === 'validated'` with current `healthPassed` (`Settings.tsx:1295-1301`); test validates activation after health and asserts `testGptSoVitsSynthesis` was not called (`Settings.test.tsx:501-524`). |
| New/changed candidates require health plus successful test synthesis. | ✓ VERIFIED | Missing validation returns `needs_test`, mismatched validated fingerprints return `changed` (`gpt-sovits-validation.ts:140-148`); activation requires current health and either matching durable validation or current-session successful test fingerprint (`Settings.tsx:1299-1301`); tests cover failed gating and changed-prompt blocking (`Settings.test.tsx:434-461`, `541-557`). |
| Rename preserves validation. | ✓ VERIFIED | `createDraftVoicePreset` preserves existing validation on update (`Settings.tsx:1090-1115`), and helper excludes `name`; renderer and safe-storage tests cover renamed validated presets remaining validated (`Settings.test.tsx:526-539`; `safe-storage.test.ts:190-198`). |
| Active validated preset selection restarts/applies sidecar runtime association. | ✓ VERIFIED | Selection and activation call `setActiveVoicePresetForAvatarSession` (`Settings.tsx:1444`, `1546`); IPC saves `activePresetByAvatarSession` and awaits `restartSidecar()` before returning (`ipc.ts:361-374`); Electron main test asserts the restart (`ipc-gpt-sovits-audio.test.ts:309-316`). |
| UAT evidence avoids false live-server manual pass. | ✓ VERIFIED | The original 17-08 evidence avoided a false live-server claim. `17-UAT.md` has since been reconciled to current Phase 17 closure status after plans 17-09 through 17-12. |

Focused automated re-verification commands passed in this verifier run:

- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` — PASS (54 tests)
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts safe-storage.test.ts` — PASS (16 tests)

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

### Human Verification Completed

#### 1. UAT Test 6 live active GPT-SoVITS chat turn retest

**Test:** With Vite dev/HMR conditions and an active GPT-SoVITS voice preset, send a chat turn after renderer module re-evaluation/HMR.
**Expected:** Each assistant sentence chunk appears once and audio plays through the existing renderer audio/RMS/lipsync path; no duplicated visible text such as `Hello!Hello!` appears.
**Result:** Passed. User confirmed the live active GPT-SoVITS chat turn no longer duplicated visible sentence text after Plan 17-09.

#### 2. Later Phase 17 gap closures

Plans 17-10 through 17-12 closed the sample-rate/lipsync, model-weight/text-language, sentence-latency, renderer audio queue, and mouth-velocity regressions. `17-UAT.md` now records Phase 17 as complete with 12/12 UAT checks passed and no pending rows.

### Gaps Summary

No blocking implementation gaps found. The five roadmap success criteria are supported by substantive, wired code across contracts, Electron IPC/preload, sidecar provider/admin endpoints, Settings UI, chat failure surfaces, and regression tests. Review blockers are fixed and focused re-review is clean (`17-REVIEW.md:24-30`). Later gap-closure evidence is summarized in `17-UAT.md`, `17-10-SUMMARY.md`, `17-11-SUMMARY.md`, and `17-12-SUMMARY.md`.

---

_Verified: 2026-05-10T04:10:00Z_
_Verifier: the agent (gsd-verifier)_
