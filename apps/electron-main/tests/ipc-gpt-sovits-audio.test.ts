import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type {
  GptSoVitsHealthRequest,
  GptSoVitsProviderConfig,
  GptSoVitsTestSynthesisRequest,
  GptSoVitsTestSynthesisResult
} from '../../../packages/contracts/ts/audio-provider'
import type { AudioProviderHealth } from '../../../packages/contracts/ts/audio-provider-health'
import type { ReferenceAudioAsset, VoicePreset } from '../../../packages/contracts/ts/voice-preset'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  removedHandlers: [] as string[],
  getSidecarHttpUrl: vi.fn(() => 'http://127.0.0.1:8765'),
  onReady: vi.fn(() => vi.fn()),
  onCrash: vi.fn(() => vi.fn()),
  onLog: vi.fn(() => vi.fn())
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
  }
}))

vi.mock('../src/sidecar', () => ({
  getReadyUrl: vi.fn(() => 'ws://127.0.0.1:8765/ws'),
  getSidecarHttpUrl: mocks.getSidecarHttpUrl,
  onReady: mocks.onReady,
  onCrash: mocks.onCrash,
  onLog: mocks.onLog,
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
  loadConfig: vi.fn(() => ({
    provider: { provider: 'lm_studio', endpointUrl: 'http://localhost:1234/v1', apiKey: '', modelName: '' },
    plugin: { activePluginName: 'default' },
    hasCompletedSetup: true,
    schemaVersion: 2,
    audio: {},
    voicePresets: [candidatePreset()],
    referenceAudioAssets: [candidateReferenceAudioAsset()],
    activePresetByAvatarSession: {}
  })),
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
  selectConversationSession: vi.fn()
}))

import { registerIpc } from '../src/ipc'

function candidateConfig(): GptSoVitsProviderConfig {
  return {
    provider_id: 'gpt_sovits',
    enabled: true,
    base_url: 'http://127.0.0.1:9880',
    request_timeout_ms: 30_000,
    activation: {
      health_check_passed: false,
      test_synthesis_passed: false,
      active_allowed: false,
      last_health_checked_at: null,
      last_test_synthesis_at: null
    },
    launch: {
      mode: 'external',
      command: null,
      working_directory: null,
      auto_start: false
    }
  }
}

function candidatePreset(): VoicePreset {
  return {
    preset_id: 'preset-1',
    name: 'Teto GPT',
    provider_id: 'gpt_sovits',
    piper_voice_model: null,
    created_at: null,
    updated_at: null,
    gpt_sovits: {
      reference_audio_id: 'asset-1',
      prompt_text: 'hello reference',
      prompt_lang: 'en',
      text_lang: 'en',
      top_k: 15,
      top_p: 1,
      temperature: 1,
      text_split_method: 'cut5',
      batch_size: 1,
      speed_factor: 1,
      media_type: 'wav',
      streaming_mode: false,
      repetition_penalty: 1.35
    }
  }
}

function candidateReferenceAudioAsset(): ReferenceAudioAsset {
  return {
    asset_id: 'asset-1',
    display_basename: 'voice.wav',
    managed_path_token: 'reference-audio/asset-1-voice.wav',
    transcript_text: 'hello reference',
    language: 'en',
    format: 'wav',
    duration_ms: 3000
  }
}

function installHandlers(): () => void {
  return registerIpc({ isDestroyed: vi.fn(() => false), webContents: { send: vi.fn() } } as never)
}

async function invoke<T>(channel: string, payload: unknown): Promise<T> {
  const handler = mocks.handlers.get(channel)
  expect(handler).toBeDefined()
  return (await handler?.({}, payload)) as T
}

describe('GPT-SoVITS audio IPC handlers', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.removedHandlers.length = 0
    mocks.getSidecarHttpUrl.mockReturnValue('http://127.0.0.1:8765')
    vi.restoreAllMocks()
  })

  it('proxies gptSovits:checkHealth to sidecar candidate health endpoint', async () => {
    installHandlers()
    const health: AudioProviderHealth = {
      provider_id: 'gpt_sovits',
      kind: 'tts',
      state: 'ok',
      summary: 'GPT-SoVITS candidate ready.',
      detail: null,
      retryable: false,
      latency_ms: 24,
      redacted_diagnostics: null
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(health) })
    vi.stubGlobal('fetch', fetchMock)
    const request: GptSoVitsHealthRequest = { config: candidateConfig() }

    await expect(invoke<AudioProviderHealth>('gptSovits:checkHealth', request)).resolves.toEqual(health)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/admin/audio/gpt-sovits/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
  })

  it('proxies gptSovits:testSynthesis and returns preview audio metadata', async () => {
    installHandlers()
    const result: GptSoVitsTestSynthesisResult = {
      ok: true,
      provider_id: 'gpt_sovits',
      media_type: 'wav',
      audio_base64: 'UklGRg==',
      sample_rate_hz: 24_000,
      duration_ms: 800,
      summary: 'Preview synthesis ready.',
      failure: null
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(result) })
    vi.stubGlobal('fetch', fetchMock)
    const request: GptSoVitsTestSynthesisRequest = {
      config: candidateConfig(),
      preset: candidatePreset(),
      text: 'test voice'
    }

    await expect(invoke<GptSoVitsTestSynthesisResult>('gptSovits:testSynthesis', request)).resolves.toEqual(result)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/admin/audio/test-synthesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, reference_audio_path: path.resolve('C:\\AgenticLLMVTuberTest', 'reference-audio/asset-1-voice.wav') })
    })
  })

  it('rejects test synthesis before forwarding when the preset has no managed reference asset', async () => {
    installHandlers()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const request: GptSoVitsTestSynthesisRequest = {
      config: candidateConfig(),
      preset: { ...candidatePreset(), gpt_sovits: { ...candidatePreset().gpt_sovits, reference_audio_id: null } },
      text: 'test voice'
    }

    const result = await invoke<GptSoVitsTestSynthesisResult>('gptSovits:testSynthesis', request)

    expect(result.ok).toBe(false)
    expect(result.failure?.state).toBe('misconfigured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns typed redacted failures for sidecar unavailable and HTTP failure responses', async () => {
    installHandlers()
    mocks.getSidecarHttpUrl.mockImplementationOnce(() => {
      throw new Error('C:/secret/user/path sidecar is not ready')
    })

    await expect(
      invoke<AudioProviderHealth>('gptSovits:checkHealth', { config: candidateConfig() })
    ).resolves.toMatchObject({
      provider_id: 'gpt_sovits',
      kind: 'tts',
      state: 'unavailable',
      summary: 'Sidecar is not ready.',
      detail: null,
      retryable: true,
      redacted_diagnostics: null
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Traceback C:/Users/alice/private/ref.wav boom')
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await invoke<GptSoVitsTestSynthesisResult>('gptSovits:testSynthesis', {
      config: candidateConfig(),
      preset: candidatePreset(),
      text: 'test voice'
    })
    expect(result.ok).toBe(false)
    expect(result.failure).toMatchObject({
      provider_id: 'gpt_sovits',
      kind: 'tts',
      state: 'external_service_failure',
      summary: 'GPT-SoVITS test synthesis failed: HTTP 500',
      detail: null,
      retryable: true
    })
    expect(JSON.stringify(result)).not.toContain('alice')
    expect(JSON.stringify(result)).not.toContain('private')
    expect(JSON.stringify(result)).not.toContain('ref.wav')
  })

  it('unregisters GPT-SoVITS handlers during IPC cleanup', () => {
    const cleanup = installHandlers()

    cleanup()

    expect(mocks.removedHandlers).toContain('gptSovits:checkHealth')
    expect(mocks.removedHandlers).toContain('gptSovits:testSynthesis')
  })
})

describe('GPT-SoVITS preload bridge declarations', () => {
  it('allowlists health and test synthesis methods through concrete IPC channels', () => {
    const preloadSource = fs.readFileSync(path.join(process.cwd(), 'preload/index.ts'), 'utf-8')

    expect(preloadSource).toContain('checkGptSoVitsHealth')
    expect(preloadSource).toContain("ipcRenderer.invoke('gptSovits:checkHealth'")
    expect(preloadSource).toContain('testGptSoVitsSynthesis')
    expect(preloadSource).toContain("ipcRenderer.invoke('gptSovits:testSynthesis'")
  })

  it('declares GPT-SoVITS bridge methods with generated contract types', () => {
    const declarationSource = fs.readFileSync(path.join(process.cwd(), 'preload/index.d.ts'), 'utf-8')

    expect(declarationSource).toContain('GptSoVitsHealthRequest')
    expect(declarationSource).toContain('GptSoVitsTestSynthesisRequest')
    expect(declarationSource).toContain('GptSoVitsTestSynthesisResult')
    expect(declarationSource).toContain(
      'checkGptSoVitsHealth(input: GptSoVitsHealthRequest): Promise<AudioProviderHealth>'
    )
    expect(declarationSource).toContain(
      'testGptSoVitsSynthesis(input: GptSoVitsTestSynthesisRequest): Promise<GptSoVitsTestSynthesisResult>'
    )
  })
})
