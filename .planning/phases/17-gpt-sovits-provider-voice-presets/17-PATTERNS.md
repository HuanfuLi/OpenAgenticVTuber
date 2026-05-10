# Phase 17: GPT-SoVITS Provider + Voice Presets - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 18 new/modified files
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/contracts/py/contracts/audio_provider.py` | model/contract | request-response | `packages/contracts/py/contracts/audio_provider.py` | exact |
| `packages/contracts/py/contracts/voice_preset.py` | model/contract | CRUD | `packages/contracts/py/contracts/audio_provider.py` | role-match |
| `packages/contracts/ts/audio-provider.ts` | generated model/contract | transform | `packages/contracts/ts/audio-provider.ts` | exact |
| `sidecar/src/sidecar/tts/gpt_sovits_provider.py` | service/provider | request-response + transform | `sidecar/src/sidecar/tts/piper_provider.py` + `provider.py` | role-match |
| `sidecar/src/sidecar/tts/provider.py` | service interface | request-response | `sidecar/src/sidecar/tts/provider.py` | exact |
| `sidecar/src/sidecar/tts/tts_gateway.py` | service factory/lifecycle | request-response | `sidecar/src/sidecar/tts/tts_gateway.py` | exact |
| `sidecar/src/sidecar/tts/tts_manager.py` | service/orchestrator | event-driven + ordered queue | `sidecar/src/sidecar/tts/tts_manager.py` | exact |
| `sidecar/src/sidecar/admin/audio.py` | route/controller | request-response | `sidecar/src/sidecar/admin/audio.py` | exact |
| `apps/electron-main/src/safe-storage.ts` | config/store | CRUD + file-I/O | `apps/electron-main/src/safe-storage.ts` | exact |
| `apps/electron-main/src/reference-audio.ts` | utility/store | file-I/O + CRUD | `apps/electron-main/src/safe-storage.ts` + `ipc.ts` avatar picker | role-match |
| `apps/electron-main/src/gpt-sovits-process.ts` | service/process manager | event-driven | `apps/electron-main/src/sidecar.ts` (not read; use IPC lifecycle patterns from `ipc.ts`) | partial |
| `apps/electron-main/src/ipc.ts` | controller/IPC bridge | request-response + file-I/O | `apps/electron-main/src/ipc.ts` | exact |
| `apps/electron-main/preload/index.ts` | bridge/provider | request-response | `apps/electron-main/preload/index.ts` | exact |
| `apps/electron-main/preload/index.d.ts` | type declaration | transform | `apps/electron-main/preload/index.d.ts` | exact |
| `apps/renderer/src/screens/Settings/Settings.tsx` | component | request-response + CRUD | `apps/renderer/src/screens/Settings/Settings.tsx` | exact |
| `apps/renderer/src/lib/copy.ts` | config/copy | transform | `apps/renderer/src/lib/copy.ts` | exact |
| `apps/renderer/src/screens/Chat/useStreamingMessages.ts` | store/hook | event-driven | `apps/renderer/src/screens/Chat/useStreamingMessages.ts` | exact |
| `apps/renderer/src/ws/store.ts` | event dispatcher | event-driven | `apps/renderer/src/ws/store.ts` | exact |
| `apps/renderer/src/screens/Chat/Chat.tsx` | component | event-driven UI | `apps/renderer/src/screens/Chat/Chat.tsx` | role-match |
| `sidecar/tests/tts/test_gpt_sovits_provider.py` | test | request-response | `sidecar/tests/test_tts_manager.py` | role-match |
| `sidecar/tests/admin/test_audio_test_tts_endpoint.py` | test | request-response | `sidecar/tests/admin/test_audio_status_endpoint.py` | exact |
| `apps/renderer/tests/Settings.test.tsx` | test | request-response + CRUD | `apps/renderer/tests/Settings.test.tsx` | exact |

## Pattern Assignments

### `packages/contracts/py/contracts/audio_provider.py` / `voice_preset.py` (model/contract, CRUD + request-response)

**Analog:** `packages/contracts/py/contracts/audio_provider.py`

**Imports pattern** (lines 8-10):
```python
from typing import Literal, Optional

from pydantic import BaseModel, Field
```

**Enum / literal ID pattern** (lines 13-29):
```python
AudioProviderKind = Literal["tts", "stt"]
AudioProviderId = Literal[
    "piper",
    "gpt_sovits",
    "funasr",
    "faster_whisper",
    "openai",
    "groq",
]
AudioHealthState = Literal[
    "ok",
    "unavailable",
    "missing_credential",
    "external_service_failure",
    "timeout",
    "misconfigured",
]
```

**Pydantic field/default pattern** (lines 43-61):
```python
class PiperTTSConfig(BaseModel):
    provider_id: Literal["piper"] = "piper"
    voice_model: str = "en_US-amy-medium"
    output_device: Optional[str] = None
    synthesis_timeout_ms: int = Field(default=30_000, ge=1_000)
    execution: Literal["off_event_loop"] = "off_event_loop"
    ordered_playback: bool = True
    rms_lipsync: bool = True


class TTSProviderConfig(BaseModel):
    active_provider: Literal["piper", "gpt_sovits"] = "piper"
    piper: PiperTTSConfig = PiperTTSConfig()
    gpt_sovits: Optional[FutureTTSProviderConfig] = None
```

**Schema version pattern** (lines 71-74):
```python
class AudioConfig(BaseModel):
    schema_version: Literal[1] = 1
    tts: TTSProviderConfig = TTSProviderConfig()
    stt: STTProviderConfig = STTProviderConfig()
```

**Apply to:** add GPT-SoVITS config fields, `VoicePreset`, `ReferenceAudioAsset`, active association map, and deletion guard contracts using `Literal`, `Optional`, and `Field` constraints. Keep Python contract as source of truth and regenerate TS mirrors.

---

### `sidecar/src/sidecar/tts/gpt_sovits_provider.py` (service/provider, request-response + transform)

**Analogs:** `sidecar/src/sidecar/tts/provider.py`, `sidecar/src/sidecar/tts/piper_provider.py`

**Provider interface pattern** (`provider.py` lines 9-19, 50-64):
```python
@dataclass(frozen=True)
class TTSSynthesisRequest:
    text: str
    sentence_id: int


@dataclass(frozen=True)
class TTSSynthesisResult:
    pcm_int16: bytes
    sample_rate: int
    provider_id: str = "piper"

class TTSProvider(Protocol):
    provider_id: str
    sample_rate: int

    def boot(self) -> None:
        ...

    def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        ...
```

**Provider implementation pattern** (`piper_provider.py` lines 13-19, 31-43):
```python
class PiperTTSProvider:
    provider_id = "piper"

    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self.voice: PiperVoice | None = None
        self.sample_rate = 0

    def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        if self.voice is None:
            raise RuntimeError("PiperTTSProvider is not booted.")
        pcm_chunks: list[bytes] = []
        sample_rate = self.sample_rate or self.voice.config.sample_rate
        for chunk in self.voice.synthesize(request.text):
            pcm_chunks.append(chunk.audio_int16_bytes)
            sample_rate = chunk.sample_rate
        return TTSSynthesisResult(
            pcm_int16=b"".join(pcm_chunks),
            sample_rate=sample_rate,
            provider_id=self.provider_id,
        )
```

**Health pattern** (`piper_provider.py` lines 45-61):
```python
def health(self) -> AudioProviderHealth:
    if self.voice is None or self.sample_rate <= 0:
        return AudioProviderHealth(
            provider_id="piper",
            kind="tts",
            state="unavailable",
            summary="Piper provider is not booted.",
            retryable=True,
        )
    return AudioProviderHealth(
        provider_id="piper",
        kind="tts",
        state="ok",
        summary="Piper provider ready.",
        detail=f"voice={self.model_path.stem}",
        retryable=False,
    )
```

**Provider error mapping pattern** (`provider.py` lines 22-47):
```python
class TTSProviderError(RuntimeError):
    def __init__(self, *, provider_id: str, state: str, summary: str,
                 retryable: bool = False, detail: str | None = None) -> None:
        super().__init__(summary)
        self.provider_id = provider_id
        self.state = state
        self.summary = summary
        self.retryable = retryable
        self.detail = detail

    def health(self) -> AudioProviderHealth:
        return AudioProviderHealth(
            provider_id=self.provider_id,
            kind="tts",
            state=self.state,
            summary=self.summary,
            detail=self.detail,
            retryable=self.retryable,
        )
```

**Apply to:** implement `provider_id = "gpt_sovits"`, derive `/tts` from base URL, use `httpx` for POST, decode WAV bytes to PCM/sample-rate, return `TTSSynthesisResult(provider_id="gpt_sovits")`, and map non-200/timeout/reference-path failures to `TTSProviderError`.

---

### `sidecar/src/sidecar/tts/tts_gateway.py` (service factory/lifecycle, request-response)

**Analog:** `sidecar/src/sidecar/tts/tts_gateway.py`

**Gateway ownership pattern** (lines 22-36):
```python
class TTSGateway:
    """Owns PiperVoice + global OutputStream. Constructed once at sidecar
    boot (FastAPI lifespan startup) BEFORE [READY] emits. Stream stays open
    for sidecar lifetime; closed in lifespan shutdown.
    """

    def __init__(self, model_path: Path, provider: TTSProvider | None = None) -> None:
        self.model_path = model_path
        self.provider = provider or PiperTTSProvider(model_path)
        self.stream: sd.OutputStream | None = None
        self.sample_rate: int = 0  # populated after voice load
```

**Boot/stream pattern** (lines 42-60):
```python
def boot(self) -> None:
    """Synchronous; called from FastAPI lifespan startup BEFORE [READY]."""
    self.provider.boot()
    self.sample_rate = self.provider.sample_rate

    self.stream = sd.OutputStream(
        samplerate=self.sample_rate,
        channels=1,
        dtype="int16",
    )
    self.stream.start()
    logger.info(
        f"[TTS-INIT] OutputStream open: latency={self.stream.latency:.3f}s"
    )
```

**Factory selection pattern** (lines 74-86):
```python
def build_tts_gateway(*, audio_config, repo_root: Path, avatar_voice_model: str) -> TTSGateway:
    provider_id = audio_config.tts.active_provider
    if provider_id != "piper":
        raise ValueError(f"Unsupported TTS provider for Phase 16: {provider_id}")
    configured_voice = audio_config.tts.piper.voice_model
    voice_model = configured_voice if configured_voice != "en_US-amy-medium" else avatar_voice_model
    model_path = repo_root / "sidecar" / "models" / "piper" / f"{voice_model}.onnx"
    return TTSGateway(model_path)
```

**Apply to:** extend factory to construct `GptSoVitsProvider` when active config is `gpt_sovits`, but keep stream ownership in `TTSGateway`; do not let provider write audio directly.

---

### `sidecar/src/sidecar/tts/tts_manager.py` (service/orchestrator, event-driven ordered queue)

**Analog:** `sidecar/src/sidecar/tts/tts_manager.py`

**Provider boundary pattern** (lines 210-221):
```python
if self._provider is not None:
    result = await asyncio.to_thread(
        self._provider.synthesize,
        TTSSynthesisRequest(text=tts_text, sentence_id=sentence_id),
    )
    return prepare_payload_from_pcm(
        result.pcm_int16,
        result.sample_rate,
        display_text,
        dispatches,
        sentence_id,
    )
```

**Failure preserves sentence display/order** (lines 130-151):
```python
except TTSProviderError as exc:
    logger.error(
        "[TTS-PROVIDER-ERROR] provider={} sentence_id={} state={} retryable={} summary={}",
        exc.provider_id,
        sentence_id,
        exc.state,
        exc.retryable,
        exc.summary,
    )
    payload, pcm_bytes, _sample_rate = (
        AudioPayloadMessage(
            audio=None,
            volumes=[],
            slice_length=20,
            display_text=display_text,
            dispatches=dispatches,
            sentence_id=sentence_id,
            forwarded=False,
        ),
        b"",
        0,
    )
```

**Ordered send/playback pattern** (lines 245-289):
```python
while self._next_sequence_to_send in buffered_payloads:
    next_payload = buffered_payloads.pop(self._next_sequence_to_send)
    payload = next_payload.payload

    if payload.audio is not None and next_payload.pcm_bytes:
        pcm_int16 = np.frombuffer(next_payload.pcm_bytes, dtype=np.int16)
        started_at = float(self._stream.time) + float(self._stream.latency)
        speech_envelope = SpeechEnvelopePayload(
            sentence_id=next_payload.sentence_id,
            volumes=payload.volumes,
            slice_length=payload.slice_length,
            started_at=started_at,
        )
        await self.compositor_speech_queue.put(speech_envelope)
        for speech_queue in self.extra_speech_queues:
            await speech_queue.put(speech_envelope)
        await ws.send_json(payload.model_dump())
        xrun = await loop.run_in_executor(None, self._stream.write, pcm_int16)
    else:
        await ws.send_json(payload.model_dump())

    self._next_sequence_to_send += 1
```

**Apply to:** keep GPT-SoVITS below `_synthesize_payload()` as a provider. If Phase 17 needs explicit failed-audio metadata, extend `AudioPayloadMessage` in contracts and keep this same silent-payload/no-stream-write path.

---

### `sidecar/src/sidecar/admin/audio.py` (route/controller, request-response)

**Analog:** `sidecar/src/sidecar/admin/audio.py`

**Router/import pattern** (lines 1-10):
```python
"""Audio provider status endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from contracts import AudioProviderHealth

router = APIRouter(prefix="/admin/audio")
```

**Status fallback pattern** (lines 13-21):
```python
def _fallback_health(request: Request) -> AudioProviderHealth:
    startup_error = getattr(request.app.state, "startup_error_message", None)
    return AudioProviderHealth(
        provider_id="piper",
        kind="tts",
        state="unavailable" if startup_error else "misconfigured",
        summary=startup_error or "TTS provider is not configured.",
        retryable=True,
    )
```

**Endpoint pattern** (lines 24-33):
```python
@router.get("/status")
async def get_audio_status(request: Request) -> dict[str, object]:
    health = getattr(request.app.state, "audio_provider_health", None)
    if isinstance(health, AudioProviderHealth):
        return health.model_dump()
    gateway = getattr(request.app.state, "tts_gateway", None)
    provider = getattr(gateway, "provider", None)
    if provider is not None and hasattr(provider, "health"):
        return provider.health().model_dump()
    return _fallback_health(request).model_dump()
```

**Apply to:** add `/health`, `/test-synthesis`, and maybe `/gpt-sovits/status` under the same prefix; read candidate config from request body/app state, return model-dumped contracts, and never activate candidate config on failed test.

---

### `apps/electron-main/src/safe-storage.ts` and reference-audio/config stores (config/store, CRUD + file-I/O)

**Analog:** `apps/electron-main/src/safe-storage.ts`

**Imports / userData path pattern** (lines 8-13, 47-49):
```typescript
import { app, safeStorage } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AudioConfig } from '../../../packages/contracts/ts/audio-provider'

const STORE_FILE = 'llm-config.enc'

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
}
```

**Default nested config pattern** (lines 51-74):
```typescript
export function defaultAudioConfig(): AudioConfig {
  return {
    schema_version: 1,
    tts: {
      active_provider: 'piper',
      piper: {
        provider_id: 'piper',
        voice_model: 'en_US-amy-medium',
        output_device: null,
        synthesis_timeout_ms: 30_000,
        execution: 'off_event_loop',
        ordered_playback: true,
        rms_lipsync: true
      },
      gpt_sovits: null
    },
    stt: {
      enabled: false,
      active_provider: null,
      capture_timeout_ms: 30_000,
      execution: 'off_event_loop'
    }
  }
}
```

**Migration pattern** (lines 76-100):
```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function migrateStoredConfig(raw: unknown): StoredConfig | null {
  if (!isRecord(raw)) return null
  if (raw.schemaVersion === 2) {
    if (!isRecord(raw.provider)) return null
    return {
      ...(raw as unknown as StoredConfig),
      audio: isRecord(raw.audio) ? (raw.audio as AudioConfig) : defaultAudioConfig()
    }
  }
  if (raw.schemaVersion === 1) {
    const v1 = raw as unknown as StoredConfigV1
    return {
      provider: v1.provider,
      plugin: v1.plugin,
      hasCompletedSetup: v1.hasCompletedSetup,
      schemaVersion: 2,
      audio: defaultAudioConfig()
    }
  }
  return null
}
```

**Load/save file pattern** (lines 102-128):
```typescript
export function loadConfig(): StoredConfig | null {
  const p = storePath()
  if (!fs.existsSync(p)) return null
  try {
    const buf = fs.readFileSync(p)
    const json = safeStorage.decryptString(buf)
    const parsed = JSON.parse(json) as unknown
    return migrateStoredConfig(parsed)
  } catch {
    return null
  }
}

export function saveConfig(cfg: StoredConfig): void {
  const migrated = migrateStoredConfig(cfg)
  if (migrated === null) throw new Error('Unsupported stored config schemaVersion')
  const json = JSON.stringify({ ...migrated, schemaVersion: 2 })
  const buf = safeStorage.encryptString(json)
  fs.writeFileSync(storePath(), buf, { mode: 0o600 })
}
```

**Apply to:** bump config schema for `voicePresets`, `referenceAudioAssets`, `activePresetByAvatarSession`, and provider settings. For `reference-audio.ts`, use `app.getPath('userData')`, generated IDs/sanitized names, `fs.mkdirSync(..., { recursive: true })`, copy into app storage, and block deletion if any preset references the asset.

---

### `apps/electron-main/src/ipc.ts` and preload bridge (controller/provider, request-response + file-I/O)

**Analogs:** `apps/electron-main/src/ipc.ts`, `apps/electron-main/preload/index.ts`, `index.d.ts`

**IPC imports pattern** (`ipc.ts` lines 5-31):
```typescript
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig, saveConfig, clearConfig, type StoredConfig } from './safe-storage'
import type { AudioProviderHealth } from '../../../packages/contracts/ts/audio-provider-health'
```

**Sidecar admin fetch with safe fallback** (`ipc.ts` lines 142-185):
```typescript
ipcMain.handle('sidecar:getAudioStatus', async (): Promise<AudioProviderHealth> => {
  let baseUrl: string
  try {
    baseUrl = getSidecarHttpUrl()
  } catch {
    return {
      provider_id: 'piper',
      kind: 'tts',
      state: 'unavailable',
      summary: 'Sidecar is not ready.',
      detail: null,
      retryable: true,
      latency_ms: null,
      redacted_diagnostics: null
    }
  }
  try {
    const resp = await fetch(`${baseUrl}/admin/audio/status`)
    if (!resp.ok) {
      return { /* unavailable AudioProviderHealth */ }
    }
    return (await resp.json()) as AudioProviderHealth
  } catch (err) {
    return { /* unavailable AudioProviderHealth with err.message */ }
  }
})
```

**File picker pattern** (`ipc.ts` lines 217-224):
```typescript
ipcMain.handle('avatar:pickFolder', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Choose avatar folder'
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]!
})
```

**POST proxy pattern** (`ipc.ts` lines 225-235):
```typescript
ipcMain.handle('avatar:requestImportPlan', async (_e, folder: string): Promise<AvatarImportPlan> => {
  const resp = await fetch(`${getSidecarHttpUrl()}/admin/avatar/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder })
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Import failed: HTTP ${resp.status} - ${text}`)
  }
  return (await resp.json()) as AvatarImportPlan
})
```

**Preload whitelist pattern** (`preload/index.ts` lines 96-109):
```typescript
getStoredConfig: (): Promise<StoredConfig | null> => ipcRenderer.invoke('config:load'),
saveStoredConfig: (cfg: StoredConfig): Promise<void> =>
  ipcRenderer.invoke('config:save', cfg),
clearStoredConfig: (): Promise<void> => ipcRenderer.invoke('config:clear'),
getVtsStatus: (): Promise<VtsStatus> => ipcRenderer.invoke('sidecar:getVtsStatus'),
getPluginStatus: (): Promise<PluginRuntimeStatus> =>
  ipcRenderer.invoke('sidecar:getPluginStatus'),
getAudioStatus: (): Promise<AudioProviderHealth> =>
  ipcRenderer.invoke('sidecar:getAudioStatus'),
restartSidecar: (): Promise<void> => ipcRenderer.invoke('sidecar:restart'),
```

**Global type pattern** (`preload/index.d.ts` lines 30-34):
```typescript
declare global {
  interface Window {
    api: RendererApi
  }
}
```

**Apply to:** add IPC/preload methods for GPT-SoVITS health/test, preset CRUD, reference-audio picker/import/delete, and app-owned process start/stop/restart. Always unregister handlers in cleanup like `ipc.ts` lines 295-333.

---

### `apps/renderer/src/screens/Settings/Settings.tsx` (component, request-response + CRUD)

**Analog:** `apps/renderer/src/screens/Settings/Settings.tsx`

**Imports pattern** (lines 7-18):
```typescript
import { useEffect, useRef, useState } from 'react'
import { Folder } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import type { AudioProviderHealth, BodyMotionPluginSummary, PluginRuntimeStatus, StoredConfig } from '@preload-types'
```

**Accessible radio row pattern** (lines 40-96):
```tsx
function RadioRow({ id, label, checked, disabled, onChange, tooltip }: RadioRowProps) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={`radio-row${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}${tooltip ? ' tt' : ''}`}
      onClick={() => {
        if (!disabled) onChange(id)
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault()
          onChange(id)
        }
      }}
    >
      <span className="dotwrap"><span className="inner" /></span>
      <span style={{ flex: 1 }}>{label}</span>
    </div>
  )
}
```

**Settings load/save/candidate state pattern** (lines 262-280, 332-359):
```tsx
useEffect(() => {
  if (typeof window === 'undefined' || !window.api) return
  let cancelled = false
  window.api
    .getStoredConfig()
    .then((cfg) => {
      if (cancelled) return
      if (cfg && cfg.hasCompletedSetup) {
        setStoredCfg(cfg)
        setForm(cfg.provider)
      }
    })
    .catch(() => {
      /* leave storedCfg null; render store fallback */
    })
  return () => { cancelled = true }
}, [])

const onSave = async (): Promise<void> => {
  setSaving(true)
  setNotice('')
  try {
    const nextCfg: StoredConfig = { /* merge existing config */ }
    await saveCompletedSetupConfig(nextCfg)
    setStoredCfg(nextCfg)
    setEditing(false)
    await refreshStatus()
    setNotice(C.CONN_SAVED)
  } catch {
    setNotice(C.CONN_ERROR)
  } finally {
    setSaving(false)
  }
}
```

**TTS status section pattern** (lines 1041-1097):
```tsx
function TTSSection() {
  const C = COPY.SETTINGS
  const [audioStatus, setAudioStatus] = useState<AudioProviderHealth | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshAudioStatus = async (): Promise<void> => {
    setLoading(true)
    try {
      const status = await window.api.getAudioStatus()
      setAudioStatus(status)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshAudioStatus() }, [])

  const healthState = audioStatus?.state ?? 'unavailable'
  const healthClass = healthState === 'ok' ? 'green' : healthState === 'unavailable' ? 'amber' : 'red'
  return (
    <section className="section" id="sec-tts">
      <h2>{C.TTS_HEADER}</h2>
      <div className="kv-row">
        <span className="k">Health</span>
        <span className="v"><span className={`dot ${healthClass}`} /> {healthState}</span>
      </div>
      <button className="btn btn-secondary mt-2" onClick={() => void refreshAudioStatus()} disabled={loading}>
        {loading ? COPY.STATUS.REFRESHING : C.CONN_REFRESH}
      </button>
    </section>
  )
}
```

**Destructive dialog pattern** (lines 1190-1209):
```tsx
<div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
  <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="conversation-clear-title">
    <h3 id="conversation-clear-title">{C.CONVERSATION_CLEAR_TITLE}</h3>
    <p>{C.CONVERSATION_CLEAR_BODY}</p>
    <div className="actions">
      <button className="btn btn-secondary" onClick={onCancel}>{COPY.RESET.CANCEL}</button>
      <button className="btn btn-destructive" onClick={onConfirm}>{C.CONVERSATION_CLEAR_CONFIRM}</button>
    </div>
  </div>
</div>
```

**Apply to:** replace compact Piper-only `TTSSection` with progressive provider/setup/preset/reference-audio groups. Use existing `RadioRow`, `.settings-form`, `.kv-row`, `.banner`, `.dialog`, `.btn`, `.input`, `.select`, `.switch`, and `TestLog`/logs patterns. Keep all copy in `COPY.SETTINGS`.

---

### `apps/renderer/src/lib/copy.ts` (config/copy, transform)

**Analog:** `apps/renderer/src/lib/copy.ts`

**Central copy object pattern** (lines 1-4, 114-127):
```typescript
// SPEC §Copywriting Contract — every user-visible string lives here.
export const COPY = {
  SETTINGS: {
    HEADER: 'Settings',
    CONN_HEADER: 'Connection / Models',
    CONN_REFRESH: 'Refresh status',
    CONN_SAVE: 'Save connection',
    CONN_ERROR: 'Could not save connection settings.',
```

**TTS copy location** (lines 212-221):
```typescript
TTS_HEADER: 'TTS / Voice out',
TTS_ENGINE: 'Engine',
TTS_ENGINE_VAL: 'Piper local TTS',
TTS_VOICE: 'Voice',
TTS_VOICE_VAL: 'en_US-amy-medium',
TTS_OUTPUT: 'Output device',
TTS_OUTPUT_VAL: 'System default',
TTS_LIPSYNC: 'Lipsync',
TTS_LIPSYNC_VAL: 'VTube Studio ParamMouthOpenY from RMS volume',
TTS_HELP: 'Phase 3 is active: replies synthesize locally and play through the default audio device. Broader STT/TTS settings continue in v3.0.',
```

**Apply to:** add UI-SPEC copy exactly: `Test synthesis`, `Activate voice preset`, `No voice presets yet.`, candidate failure, reference path failure, delete confirmations, next-turn fallback notice, and mid-turn audio failure. Do not hardcode these in components.

---

### Chat failure UI (`useStreamingMessages.ts`, `ws/store.ts`, `Chat.tsx`) (store/dispatcher/component, event-driven)

**Analogs:** `apps/renderer/src/screens/Chat/useStreamingMessages.ts`, `apps/renderer/src/ws/store.ts`, `apps/renderer/src/screens/Chat/Chat.tsx`

**Streaming state pattern** (`useStreamingMessages.ts` lines 55-81):
```typescript
interface StreamingState {
  messages: StreamingMessage[]
  forceNewMessage: boolean
  inputDisabled: boolean
  banner: BannerState | null
  isSpeaking: boolean
  pendingTurn: PendingTurn | null
}

let state: StreamingState = { /* initial state */ }

const subs = new Set<(s: StreamingState) => void>()
function notify(): void { for (const cb of subs) cb(state) }
function setState(patch: Partial<StreamingState>): void {
  state = { ...state, ...patch }
  notify()
}
```

**Audio envelope routing pattern** (`ws/store.ts` lines 50-78):
```typescript
subscribe((msg: WSMessage) => {
  if (isControl(msg)) {
    if (msg.text === 'conversation-chain-start') {
      setThinking(true)
      setInputDisabled(true)
      setSpeaking(false)
    } else if (msg.text === 'conversation-chain-end') {
      const completedTurn = getCompletedTurnCandidate()
      if (completedTurn) {
        void commitConversationTurnFromDispatcher(completedTurn).then((session) => {
          if (session) markCompletedTurnConsumed()
        })
      }
      setInputDisabled(false)
      setSpeaking(false)
    }
    return
  }
  if (isAudioPayload(msg)) {
    appendAssistantSentence(msg.display_text.text, msg.sentence_id)
    setSpeaking(true)
    return
  }
```

**Banner rendering pattern** (`Chat.tsx` lines 151-157, 203):
```tsx
{streamBanner && (
  <div className="banner" role="alert" data-banner-kind={streamBanner.kind}>
    <span aria-hidden="true">⚠ </span>
    {streamBanner.text}
  </div>
)}

{banners.tts && <div className="banner warn">{COPY.ERRORS.TTS_UNAVAILABLE}</div>}
```

**Apply to:** when `AudioPayloadMessage.audio === null` from a GPT-SoVITS provider failure, still append/display the sentence text, mark that sentence/audio as failed, and show concise next-turn fallback/logs notice. Do not set active provider to Piper in this reducer.

---

### Tests (`test_gpt_sovits_provider.py`, admin endpoint tests, Settings tests)

**Analogs:** `sidecar/tests/test_tts_manager.py`, `sidecar/tests/admin/test_audio_status_endpoint.py`, `apps/renderer/tests/Settings.test.tsx`

**Python fake provider/unit pattern** (`test_tts_manager.py` lines 37-64):
```python
class _BlockingProvider:
    provider_id = "piper"
    sample_rate = 22050

    def __init__(self) -> None:
        self.calls: list[TTSSynthesisRequest] = []

    def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        self.calls.append(request)
        return TTSSynthesisResult(
            pcm_int16=b"\x01\x00\x02\x00",
            sample_rate=22050,
            provider_id="piper",
        )
```

**Failure/order assertion pattern** (`test_tts_manager.py` lines 418-444):
```python
@pytest.mark.asyncio
async def test_provider_failure_sends_silent_payload_and_keeps_order():
    class FailingProvider(_BlockingProvider):
        def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
            self.calls.append(request)
            if request.sentence_id == 1:
                raise RuntimeError("boom")
            return TTSSynthesisResult(pcm_int16=b"\x01\x00\x02\x00", sample_rate=22050, provider_id="piper")

    await manager.speak("first.", _display("first."), _dispatches(), 1, ws)
    await manager.speak("second.", _display("second."), _dispatches(), 2, ws)
    await manager.wait_for_all_audio_complete()

    assert [w["sentence_id"] for w in ws.writes] == [1, 2]
    assert ws.writes[0]["audio"] is None
    assert ws.writes[1]["audio"] is not None
```

**FastAPI TestClient pattern** (`test_audio_status_endpoint.py` lines 25-34):
```python
def _client() -> TestClient:
    app = FastAPI()
    app.include_router(audio_module.router)
    return TestClient(app)

def test_audio_status_ready_provider() -> None:
    with _client() as client:
        client.app.state.tts_gateway = _Gateway()
        body = client.get("/admin/audio/status").json()
```

**Renderer mock API pattern** (`Settings.test.tsx` lines 87-120):
```typescript
beforeEach(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      getStoredConfig: vi.fn().mockResolvedValue(storedConfig),
      saveStoredConfig: vi.fn().mockResolvedValue(undefined),
      getAudioStatus: vi.fn().mockResolvedValue({
        provider_id: 'piper',
        kind: 'tts',
        state: 'ok',
        summary: 'Piper provider ready.',
        detail: 'voice=en_US-amy-medium',
        retryable: false,
        latency_ms: null,
        redacted_diagnostics: null
      }),
```

**Renderer assertion pattern** (`Settings.test.tsx` lines 602-640):
```typescript
fireEvent.click(await screen.findByRole('button', { name: COPY.SETTINGS.CONN_CHANGE }))
fireEvent.change(await screen.findByRole('combobox', { name: 'Provider' }), {
  target: { value: 'custom' }
})
fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.CONN_SAVE }))

await waitFor(() => {
  expect(window.api.saveStoredConfig).toHaveBeenCalledWith({
    ...preservedConfig,
    provider: { /* edited provider */ },
    audio: defaultAudioConfig()
  })
})
```

**Apply to:** mock `httpx`/transport for GPT-SoVITS success, JSON 400, timeout, unreadable reference path; assert no activation after failed health/test; assert Settings disables `Activate voice preset` until both gates pass; assert active/in-use delete guards.

## Shared Patterns

### Provider-neutral TTS boundary
**Source:** `sidecar/src/sidecar/tts/provider.py` lines 9-19 and `tts_manager.py` lines 210-221
**Apply to:** `gpt_sovits_provider.py`, `tts_gateway.py`, `tts_manager.py`
```python
result = await asyncio.to_thread(
    self._provider.synthesize,
    TTSSynthesisRequest(text=tts_text, sentence_id=sentence_id),
)
return prepare_payload_from_pcm(
    result.pcm_int16,
    result.sample_rate,
    display_text,
    dispatches,
    sentence_id,
)
```

### Audio failure without silent provider switch
**Source:** `sidecar/src/sidecar/tts/tts_manager.py` lines 130-151 and 286-287
**Apply to:** GPT-SoVITS provider failures and renderer failed-sentence UI
```python
AudioPayloadMessage(
    audio=None,
    volumes=[],
    slice_length=20,
    display_text=display_text,
    dispatches=dispatches,
    sentence_id=sentence_id,
    forwarded=False,
)
```

### Persisted settings and migration
**Source:** `apps/electron-main/src/safe-storage.ts` lines 80-100, 122-128
**Apply to:** provider config, voice presets, reference assets, active preset association
```typescript
export function migrateStoredConfig(raw: unknown): StoredConfig | null {
  if (!isRecord(raw)) return null
  if (raw.schemaVersion === 2) {
    if (!isRecord(raw.provider)) return null
    return {
      ...(raw as unknown as StoredConfig),
      audio: isRecord(raw.audio) ? (raw.audio as AudioConfig) : defaultAudioConfig()
    }
  }
  return null
}
```

### IPC/preload allowlist
**Source:** `apps/electron-main/src/ipc.ts` lines 187-201 and `apps/electron-main/preload/index.ts` lines 96-105
**Apply to:** all new renderer-to-main calls
```typescript
ipcMain.handle('config:load', () => loadConfig())
ipcMain.handle('config:save', async (_e, cfg: StoredConfig) => {
  saveConfig(cfg)
  await restartSidecar()
})

getStoredConfig: (): Promise<StoredConfig | null> => ipcRenderer.invoke('config:load'),
saveStoredConfig: (cfg: StoredConfig): Promise<void> =>
  ipcRenderer.invoke('config:save', cfg),
```

### Existing Settings visual language
**Source:** `apps/renderer/src/screens/Settings/Settings.tsx` lines 40-96, 1041-1097, 1190-1209
**Apply to:** all Phase 17 Settings UI
```tsx
<section className="section" id="sec-tts">
  <h2>{C.TTS_HEADER}</h2>
  <div className="kv-row">
    <span className="k">Health</span>
    <span className="v"><span className={`dot ${healthClass}`} /> {healthState}</span>
  </div>
  <button className="btn btn-secondary mt-2" onClick={() => void refreshAudioStatus()} disabled={loading}>
    {loading ? COPY.STATUS.REFRESHING : C.CONN_REFRESH}
  </button>
</section>
```

### Centralized copy
**Source:** `apps/renderer/src/lib/copy.ts` lines 1-4 and 114-255
**Apply to:** all new UI status/error/destructive copy
```typescript
export const COPY = {
  SETTINGS: {
    TTS_HEADER: 'TTS / Voice out',
    TTS_ENGINE: 'Engine',
    TTS_HELP: 'Phase 3 is active: replies synthesize locally and play through the default audio device. Broader STT/TTS settings continue in v3.0.',
  }
} as const
```

## No Analog Found

All inferred Phase 17 files have at least a partial in-repo analog. The weakest match is the app-owned GPT-SoVITS process manager because no dedicated `gpt-sovits-process.ts` equivalent exists; use existing sidecar lifecycle IPC patterns plus `sidecar.ts` process ownership if implementation needs to manage a child process.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| _none_ | — | — | — |

## Metadata

**Analog search scope:** `sidecar/src/sidecar/tts`, `sidecar/src/sidecar/admin`, `packages/contracts/{py,ts}`, `apps/electron-main/src`, `apps/electron-main/preload`, `apps/renderer/src`, `sidecar/tests`, `apps/renderer/tests`
**Files scanned:** 21
**Pattern extraction date:** 2026-05-09
