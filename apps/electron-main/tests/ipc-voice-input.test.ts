import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  STTProviderConfig,
  STTTestResult,
  VoiceInputReadiness,
  VoiceInputTranscriptionResult
} from '../../../packages/contracts/ts/audio-provider'
import { isVoiceInputPermissionAllowed, rendererAllowedOrigins } from '../src/voice-input-permissions'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  removedHandlers: [] as string[],
  getSidecarHttpUrl: vi.fn(() => 'http://127.0.0.1:8765'),
  getMediaAccessStatus: vi.fn(() => 'granted'),
  askForMediaAccess: vi.fn().mockResolvedValue(true),
  loadConfig: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn(() => process.cwd()),
    getPath: vi.fn(() => 'C:\\AgenticLLMVTuberTest')
  },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      mocks.removedHandlers.push(channel)
      mocks.handlers.delete(channel)
    })
  },
  safeStorage: {
    decryptString: vi.fn((buf: Buffer) => buf.toString('utf8')),
    encryptString: vi.fn((text: string) => Buffer.from(text)),
    isEncryptionAvailable: vi.fn(() => true)
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(undefined)
  },
  systemPreferences: {
    getMediaAccessStatus: mocks.getMediaAccessStatus,
    askForMediaAccess: mocks.askForMediaAccess
  }
}))

vi.mock('../src/sidecar', () => ({
  getReadyUrl: vi.fn(() => 'ws://127.0.0.1:8765/ws'),
  getSidecarHttpUrl: mocks.getSidecarHttpUrl,
  onReady: vi.fn(() => vi.fn()),
  onCrash: vi.fn(() => vi.fn()),
  onLog: vi.fn(() => vi.fn()),
  listBodyMotionPlugins: vi.fn(() => []),
  restartSidecar: vi.fn().mockResolvedValue(undefined),
  resetVtsAuthToken: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../src/window-store', () => ({
  getChromeState: vi.fn(() => ({ mode: 'normal' })),
  getLogLevel: vi.fn(() => 'info'),
  getThemePreference: vi.fn(() => null),
  resolveCurrentAvatarId: vi.fn(() => 'teto'),
  saveChromeState: vi.fn((patch) => patch),
  saveLogLevel: vi.fn((level) => level),
  saveThemePreference: vi.fn().mockResolvedValue(undefined),
  store: { get: vi.fn(), set: vi.fn() }
}))

vi.mock('../src/safe-storage', () => ({
  loadConfig: mocks.loadConfig,
  saveConfig: vi.fn(),
  clearConfig: vi.fn(),
  canDeletePreset: vi.fn(() => ({ ok: true })),
  getAvatarSessionPresetKey: vi.fn((avatarId: string | null, sessionId: string | null) => `avatar:${avatarId ?? 'global'}|session:${sessionId ?? 'global'}`)
}))

vi.mock('../src/hud-window', () => ({ createHudWindow: vi.fn() }))

vi.mock('../src/conversation-store', () => ({
  clearConversationHistory: vi.fn(),
  commitConversationTurn: vi.fn(),
  createConversationSession: vi.fn(),
  deleteConversationSession: vi.fn(),
  getActiveConversationSession: vi.fn(),
  getConversationStats: vi.fn(),
  listConversationSessions: vi.fn(),
  renameConversationSession: vi.fn(),
  selectConversationSession: vi.fn(),
  truncateConversationBeforeMessage: vi.fn()
}))

import { registerIpc } from '../src/ipc'

function sttConfig(): STTProviderConfig {
  return {
    enabled: true,
    active_provider: 'funasr',
    input_mode: 'push_to_talk',
    language_mode: 'auto',
    local_model_id: 'iic/SenseVoiceSmall',
    local_model_path_override: null,
    cache_root: null,
    runtime_device: 'cpu',
    cuda_compute_type: 'float16',
    readiness: {
      health_check_passed: true,
      test_transcription_passed: true,
      last_health_checked_at: '2026-05-10T00:00:00Z',
      last_test_transcription_at: '2026-05-10T00:00:00Z',
      fingerprint: 'abc123',
      active_allowed: true,
      invalidation_reason: 'ready'
    },
    capture_timeout_ms: 30_000,
    execution: 'off_event_loop',
    cloud: {
      openai: {
        provider_id: 'openai',
        consent_granted: false,
        api_key: null,
        endpoint_url: null,
        model_name: null
      },
      groq: {
        provider_id: 'groq',
        consent_granted: false,
        api_key: null,
        endpoint_url: null,
        model_name: null
      }
    }
  }
}

function installHandlers(): () => void {
  return registerIpc({ isDestroyed: vi.fn(() => false), webContents: { send: vi.fn() } } as never)
}

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const handler = mocks.handlers.get(channel)
  expect(handler).toBeDefined()
  return (await handler?.({}, payload)) as T
}

describe('voice input permission handling', () => {
  it('allows only app-origin audio media permission checks', () => {
    const allowedOrigins = rendererAllowedOrigins('http://localhost:5173/chat')

    expect(
      isVoiceInputPermissionAllowed(
        { permission: 'media', requestingOrigin: 'http://localhost:5173', details: { mediaType: 'audio' } },
        allowedOrigins
      )
    ).toBe(true)
    expect(
      isVoiceInputPermissionAllowed(
        { permission: 'media', requestingOrigin: 'https://example.test', details: { mediaType: 'audio' } },
        allowedOrigins
      )
    ).toBe(false)
    expect(
      isVoiceInputPermissionAllowed(
        { permission: 'media', requestingOrigin: 'http://localhost:5173', details: { mediaTypes: ['video'] } },
        allowedOrigins
      )
    ).toBe(false)
    expect(
      isVoiceInputPermissionAllowed(
        { permission: 'clipboard-read', requestingOrigin: 'http://localhost:5173' },
        allowedOrigins
      )
    ).toBe(false)
  })
})

describe('voice input IPC handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.handlers.clear()
    mocks.removedHandlers.length = 0
    mocks.getSidecarHttpUrl.mockReturnValue('http://127.0.0.1:8765')
    mocks.getMediaAccessStatus.mockReturnValue('granted')
    mocks.askForMediaAccess.mockResolvedValue(true)
    mocks.loadConfig.mockReturnValue({
      audio: { stt: sttConfig() }
    })
  })

  it('proxies readiness and transcription through sidecar using stored STT config', async () => {
    installHandlers()
    const readiness: VoiceInputReadiness = {
      ready: true,
      capture_status: 'idle',
      stt_enabled: true,
      provider_id: 'funasr',
      blocked_reason: null,
      setup_destination: null,
      permission_state: 'granted',
      readiness: sttConfig().readiness,
      summary: 'Voice input is ready.'
    }
    const result: VoiceInputTranscriptionResult = {
      ok: true,
      mode: 'final',
      sequence_id: 'seq-1',
      transcript: 'hello there',
      is_final: true,
      provider_id: 'funasr',
      duration_ms: 700,
      latency_ms: 15,
      readiness,
      summary: 'Voice input transcription succeeded.',
      failure: null,
      redacted_diagnostics: null
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(readiness) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(result) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(invoke<VoiceInputReadiness>('voiceInput:getReadiness')).resolves.toEqual(readiness)
    await expect(
      invoke<VoiceInputTranscriptionResult>('voiceInput:transcribe', {
        audio_base64_wav: 'UklGRg==',
        duration_ms: 700,
        sequence_id: 'seq-1',
        mode: 'final',
        session_id: 'session-1'
      })
    ).resolves.toEqual(result)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8765/admin/audio/voice-input/readiness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: sttConfig(), permission_state: 'granted' })
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8765/admin/audio/voice-input', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64_wav: 'UklGRg==',
        duration_ms: 700,
        sequence_id: 'seq-1',
        mode: 'final',
        session_id: 'session-1',
        config: sttConfig()
      })
    }))
  })

  it('returns typed sidecar-unavailable failures without leaking audio payloads', async () => {
    installHandlers()
    mocks.getSidecarHttpUrl.mockImplementation(() => {
      throw new Error('sidecar not ready')
    })

    const result = await invoke<VoiceInputTranscriptionResult>('voiceInput:transcribe', {
      audio_base64_wav: 'SECRET_AUDIO_BASE64',
      duration_ms: 700,
      sequence_id: 'seq-1',
      mode: 'final',
      session_id: null
    })

    expect(result.ok).toBe(false)
    expect(result.readiness?.blocked_reason).toBe('sidecar_unavailable')
    expect(JSON.stringify(result)).not.toContain('SECRET_AUDIO_BASE64')
  })

  it('times out stuck voice transcription requests with a typed failure', async () => {
    vi.useFakeTimers()
    try {
      installHandlers()
      const cfg = sttConfig()
      cfg.capture_timeout_ms = 1_000
      mocks.loadConfig.mockReturnValue({ audio: { stt: cfg } })
      vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })))

      const pending = invoke<VoiceInputTranscriptionResult>('voiceInput:transcribe', {
        audio_base64_wav: 'UklGRg==',
        duration_ms: 700,
        sequence_id: 'seq-timeout',
        mode: 'final',
        session_id: 'session-1'
      })
      await vi.advanceTimersByTimeAsync(10_001)
      const result = await pending

      expect(result.ok).toBe(false)
      expect(result.failure?.state).toBe('timeout')
      expect(result.summary).toContain('timed out')
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out stuck Settings STT diagnostic requests with a typed failure', async () => {
    vi.useFakeTimers()
    try {
      installHandlers()
      const cfg = sttConfig()
      cfg.active_provider = 'faster_whisper'
      cfg.runtime_device = 'cuda'
      cfg.capture_timeout_ms = 1_000
      const request = {
        config: cfg,
        audio_base64_wav: 'UklGRg==',
        duration_ms: 700,
        sample_label: 'settings-diagnostics'
      }
      vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })))

      const pending = invoke<STTTestResult>('audio:testStt', request)
      await vi.advanceTimersByTimeAsync(10_001)
      const result = await pending

      expect(result.ok).toBe(false)
      expect(result.provider_id).toBe('faster_whisper')
      expect(result.failure?.state).toBe('timeout')
      expect(result.summary).toContain('timed out')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not mislabel voice readiness HTTP failures as sidecar unavailable', async () => {
    installHandlers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('validation failed')
    }))

    const readiness = await invoke<VoiceInputReadiness>('voiceInput:getReadiness')

    expect(readiness.ready).toBe(false)
    expect(readiness.blocked_reason).toBe('unexpected_failure')
    expect(readiness.summary).toBe('Voice input readiness failed: HTTP 422.')
  })

  it('proxies STT model operations with cache root but without STT config secrets', async () => {
    installHandlers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: false,
        provider_id: 'funasr',
        model_id: 'iic/SenseVoiceSmall',
        status: 'not_downloaded',
        summary: 'download failed',
        cache_path_display: 'C:/custom/funasr/iic__SenseVoiceSmall'
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await invoke('audio:downloadSttModel', {
      provider_id: 'funasr',
      model_id: 'iic/SenseVoiceSmall',
      cache_root: 'C:/custom'
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({
      provider_id: 'funasr',
      model_id: 'iic/SenseVoiceSmall',
      cache_root: 'C:/custom'
    })
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(body.config).toBeUndefined()
  })

  it('unregisters voice input handlers during IPC cleanup', () => {
    const cleanup = installHandlers()

    cleanup()

    expect(mocks.removedHandlers).toContain('voiceInput:getReadiness')
    expect(mocks.removedHandlers).toContain('voiceInput:requestMicrophonePermission')
    expect(mocks.removedHandlers).toContain('voiceInput:transcribe')
  })
})
