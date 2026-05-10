---
phase: 17-gpt-sovits-provider-voice-presets
reviewed: 2026-05-10T00:00:00Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - apps/electron-main/src/reference-audio.ts
  - apps/electron-main/src/gpt-sovits-process.ts
  - apps/electron-main/src/ipc.ts
  - apps/electron-main/src/safe-storage.ts
  - apps/electron-main/preload/index.ts
  - apps/renderer/src/screens/Settings/Settings.tsx
  - apps/renderer/src/ws/store.ts
  - apps/renderer/src/screens/Chat/useStreamingMessages.ts
  - apps/renderer/src/screens/Chat/Chat.tsx
  - apps/renderer/src/lib/copy.ts
  - sidecar/src/sidecar/admin/audio.py
  - sidecar/src/sidecar/tts/gpt_sovits_provider.py
  - sidecar/src/sidecar/tts/tts_gateway.py
  - sidecar/src/sidecar/tts/tts_manager.py
  - sidecar/src/sidecar/ws/server.py
  - packages/contracts/py/contracts/audio_provider.py
  - packages/contracts/py/contracts/voice_preset.py
  - packages/contracts/py/contracts/audio_payload.py
  - apps/renderer/tests/Settings.test.tsx
  - apps/renderer/tests/ChatStreaming.test.tsx
  - sidecar/tests/admin/test_audio_test_tts_endpoint.py
findings:
  critical: 4
  warning: 2
  info: 0
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

## Critical Issues

### CR-01: Health and test-synthesis requests cannot reach the sidecar successfully

**File:** `apps/renderer/src/screens/Settings/Settings.tsx:1243-1258`, `packages/contracts/py/contracts/audio_provider.py:78-85`, `sidecar/src/sidecar/admin/audio.py:57-61,129-149`

**Issue:** **BLOCKER** — The renderer and generated contract send only `{ config }` for health and `{ config, preset, text }` for test synthesis, but the FastAPI endpoint validates both routes with `GptSoVitsCandidateRequest`, which requires `preset` and `reference_audio_path`. Normal UI calls through Electron will therefore receive a 422 from the sidecar; the IPC layer redacts that into a failed health/test result, so GPT-SoVITS activation is effectively impossible.

**Fix:** Make the contract and sidecar agree. Prefer a separate health request that only requires config, and make test synthesis carry a managed reference asset id/path resolved by main process:

```python
class GptSoVitsHealthCandidateRequest(BaseModel):
    config: GptSoVitsProviderConfig

@router.post("/gpt-sovits/health")
async def post_gpt_sovits_health(payload: GptSoVitsHealthCandidateRequest): ...
```

Then update generated TS, IPC tests, Settings calls, and sidecar tests to exercise the same payload shape end-to-end instead of mocking incompatible shapes.

### CR-02: Activated GPT-SoVITS config is never wired into sidecar startup

**File:** `sidecar/src/sidecar/ws/server.py:288-292`, `sidecar/src/sidecar/tts/tts_gateway.py:77-107`

**Issue:** **BLOCKER** — `build_tts_gateway()` requires `active_voice_preset` and `reference_audio_path` whenever `audio_config.tts.active_provider == "gpt_sovits"`, but server startup calls it with only `audio_config`, `repo_root`, and `avatar_voice_model`. After the UI saves GPT-SoVITS as active, sidecar boot/restart will raise `ValueError("GPT-SoVITS activation requires an active voice preset and reference audio.")` instead of starting chat.

**Fix:** Load the stored voice preset association and managed reference-audio asset before constructing the gateway, then pass both values:

```python
active_preset = resolve_active_voice_preset(app_config, active_avatar_id, active_session_id)
reference_path = resolve_managed_reference_audio_path(app_config, active_preset.gpt_sovits.reference_audio_id)
tts_gateway = build_tts_gateway(
    audio_config=app.state.audio_config,
    repo_root=repo_root,
    avatar_voice_model=voice_model,
    active_voice_preset=active_preset,
    reference_audio_path=reference_path,
)
```

Add a sidecar startup/regression test where saved config has active GPT-SoVITS plus active preset/reference audio.

### CR-03: The Settings UI cannot attach imported reference audio to a voice preset

**File:** `apps/renderer/src/screens/Settings/Settings.tsx:1085-1109,1252-1258,1274-1300,1348-1356,1499-1514`

**Issue:** **BLOCKER** — Reference audio import only appends an asset to `referenceAudioAssets`; there is no UI path that sets `selectedPreset.gpt_sovits.reference_audio_id`, no prompt/reference transcript is copied into the preset, and activation only checks `healthPassed && testPassed && selectedPreset !== null`. A saved preset can remain with `reference_audio_id: null` and `prompt_text: ''`, which violates the phase requirement that reference audio/transcript are required for GPT-SoVITS and leaves the sidecar without a usable reference path.

**Fix:** Add an explicit selected reference-audio control and persist the association into the preset before test/activation:

```ts
const updatedPreset = {
  ...selectedPreset,
  gpt_sovits: {
    ...selectedPreset.gpt_sovits,
    reference_audio_id: selectedReferenceAsset.asset_id,
    prompt_text: selectedReferenceAsset.transcript_text,
    prompt_lang: selectedReferenceAsset.language
  }
}
await window.api.saveVoicePreset(updatedPreset)
```

Also include `selectedPreset.gpt_sovits.reference_audio_id` in `activationReady` and test coverage for “cannot test/activate without a reference audio association.”

### CR-04: Sidecar admin endpoints allow arbitrary local path probing and forwarding

**File:** `apps/electron-main/src/ipc.ts:281-289,355-358`, `apps/electron-main/preload/index.ts:120-153`, `sidecar/src/sidecar/admin/audio.py:57-61,142-149,179-213`

**Issue:** **BLOCKER** — The renderer-facing preload exposes validation and synthesis requests whose bodies are forwarded to fixed sidecar admin endpoints without runtime narrowing. The sidecar accepts a raw `managed_path` / `reference_audio_path` and calls `Path(...).exists()`, `is_file()`, and `soundfile.info()` or forwards the path to GPT-SoVITS. A compromised renderer or future XSS can probe arbitrary local files for existence/audio metadata, and can send arbitrary local paths to a configured GPT-SoVITS service, violating the managed-reference-audio storage boundary.

**Fix:** Never accept raw renderer paths for these endpoints. Have Electron main accept only an `asset_id`, resolve it from `StoredConfig.referenceAudioAssets`, and pass an absolute managed path that is verified to stay under `app.getPath('userData')/reference-audio`. Add a sidecar defense-in-depth root/token check as well:

```ts
const asset = cfg.referenceAudioAssets.find((item) => item.asset_id === input.assetId)
if (!asset) throw new Error('Unknown reference audio asset.')
const managedPath = getManagedReferenceAudioPath(asset)
if (!managedPath.startsWith(referenceAudioDirectory() + path.sep)) throw new Error('Invalid managed path token.')
```

Reject any direct absolute path from renderer/admin requests and add IPC tests for path traversal / arbitrary path rejection.

## Warnings

### WR-01: Tests mock over the exact cross-tier contract that is broken

**File:** `apps/renderer/tests/Settings.test.tsx:170-189,383-426`, `sidecar/tests/admin/test_audio_test_tts_endpoint.py:19-41,50-87`

**Issue:** **WARNING** — Renderer tests mock `window.api.checkGptSoVitsHealth()` and `testGptSoVitsSynthesis()` as if the bridge succeeds, while sidecar tests post a different request body that includes `reference_audio_path`. No test exercises the real Settings → preload → IPC → sidecar request shape, so CR-01 shipped despite both tiers having tests.

**Fix:** Add an integration-style test around the actual IPC handler payloads or a contract fixture shared by renderer, Electron main, and sidecar. The same serialized request used by Settings should be accepted by FastAPI tests.

### WR-02: Stop GPT-SoVITS has no confirmation despite destructive-process copy/spec

**File:** `apps/renderer/src/screens/Settings/Settings.tsx:1431-1434`, `apps/renderer/src/lib/copy.ts:269-273`

**Issue:** **WARNING** — `Stop app-launched GPT-SoVITS` directly calls `window.api.stopGptSoVits` even though the UI spec and copy include a stop confirmation. The process manager is app-owned-only, so this is not an external-process kill, but an accidental click can still terminate a user-provided long-running GPT-SoVITS command without confirmation.

**Fix:** Add a `role="alertdialog"` confirmation before invoking `stopGptSoVits`, using `COPY.SETTINGS.GPT_SOVITS_STOP_CONFIRM`, and add a renderer test that stop is not called until confirmation.

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
