import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AppStoreProvider, useStore } from '@/state/app-store'
import { ThemeProvider } from '@/state/theme-provider'
import { COPY } from '@/lib/copy'
import { Settings } from '@/screens/Settings/Settings'
import { defaultAudioConfig } from '@/state/setup-store'
import type { StoredConfig } from '@preload-types'
import type { AvatarImportPlan } from '@contracts/avatar-import-plan'
import type { GptSoVitsProviderConfig } from '@contracts/audio-provider'
import type { VoicePreset } from '@contracts/voice-preset'
import { buildGptSoVitsPresetValidationFingerprint } from '@contracts/gpt-sovits-validation'

function renderSettings() {
  return render(
    <AppStoreProvider>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </AppStoreProvider>
  )
}

function StoreProbe() {
  const { avatarImportPlan, view } = useStore()
  return (
    <div>
      <span data-testid="store-view">{view}</span>
      <span data-testid="store-avatar-plan">{avatarImportPlan?.avatar_id ?? 'none'}</span>
      <span data-testid="store-avatar-variants">
        {avatarImportPlan?.variants.map((variant) => variant.code).join(',') ?? 'none'}
      </span>
      <span data-testid="store-avatar-events">
        {avatarImportPlan?.events.map((event) => event.code).join(',') ?? 'none'}
      </span>
    </div>
  )
}

function renderSettingsWithProbe() {
  return render(
    <AppStoreProvider>
      <ThemeProvider>
        <Settings />
        <StoreProbe />
      </ThemeProvider>
    </AppStoreProvider>
  )
}

async function openGptSoVitsSettings(): Promise<void> {
  fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
}

async function waitForPresetLibrary(): Promise<void> {
  await screen.findByRole('radio', { name: /Akari bright/i })
}

async function waitForReferenceReady(): Promise<void> {
  await screen.findByText(COPY.SETTINGS.REFERENCE_AUDIO_REQUIRED)
}

describe('Settings TTS section', () => {
  const gptConfig = (): GptSoVitsProviderConfig => ({
    provider_id: 'gpt_sovits',
    enabled: true,
    base_url: 'http://127.0.0.1:9880',
    request_timeout_ms: 30_000,
    launch: {
      mode: 'external',
      command: null,
      working_directory: null,
      auto_start: false
    },
    activation: {
      active_allowed: false,
      health_check_passed: false,
      test_synthesis_passed: false,
      last_health_checked_at: null,
      last_test_synthesis_at: null
    }
  })

  const gptPreset = (overrides: Partial<VoicePreset> = {}): VoicePreset => ({
    preset_id: 'preset-akari',
    name: 'Akari bright',
    provider_id: 'gpt_sovits',
    piper_voice_model: null,
    created_at: null,
    updated_at: null,
    validation: null,
    gpt_sovits: {
      prompt_text: 'こんにちは',
      prompt_lang: 'ja',
      text_lang: 'ja',
      gpt_weights_path: null,
      sovits_weights_path: null,
      reference_audio_id: 'ref-akari',
      top_k: 15,
      top_p: 1,
      temperature: 1,
      speed_factor: 1,
      repetition_penalty: 1.35,
      text_split_method: 'cut5',
      batch_size: 1,
      media_type: 'wav',
      streaming_mode: false
    },
    ...overrides
  })

  const validatedGptPreset = (
    config: GptSoVitsProviderConfig,
    overrides: Partial<VoicePreset> = {}
  ): VoicePreset => {
    const preset = gptPreset(overrides)
    return {
      ...preset,
      validation: {
        state: 'validated',
        fingerprint: buildGptSoVitsPresetValidationFingerprint(config, preset),
        validated_at: '2026-05-10T00:00:00Z',
        health_checked_at: '2026-05-10T00:00:00Z',
        test_synthesis_at: '2026-05-10T00:00:00Z',
        summary: 'validated'
      }
    }
  }

  const storedConfig: StoredConfig = {
    provider: {
      provider: 'lm_studio',
      endpointUrl: 'http://localhost:1234/v1',
      apiKey: '',
      modelName: ''
    },
    plugin: { activePluginName: 'default' },
    hasCompletedSetup: true,
    schemaVersion: 2,
    audio: defaultAudioConfig(),
    voicePresets: [],
    referenceAudioAssets: [],
    activePresetByAvatarSession: {}
  }
  const currentAvatarPlan: AvatarImportPlan = {
    avatar_id: 'akari',
    avatar_name: 'Akari',
    detected_type: 'live2d',
    source_rig_path: 'C:/avatars/akari/model3.json',
    variants: [
      { code: 'smile', hotkey_id: 'hotkey-smile', is_placeholder: false, source_name: 'Smile' },
      { code: 'wink', hotkey_id: 'hotkey-wink', is_placeholder: false, source_name: 'Wink' }
    ],
    events: [
      {
        code: 'wave',
        duration_is_fallback: false,
        duration_seconds: 1.2,
        hotkey_id: 'hotkey-wave',
        is_loop: false,
        is_placeholder: false,
        motion_file: 'wave.motion3.json'
      }
    ],
    voice: { backend: 'piper', model: 'en_US-amy-medium', lipsync_mode: 'rms' },
    default_plugin_action_bindings: [],
    existing_overrides: null,
    warnings: []
  }

  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getStoredConfig: vi.fn().mockResolvedValue(storedConfig),
        saveStoredConfig: vi.fn().mockResolvedValue(undefined),
        clearStoredConfig: vi.fn().mockResolvedValue(undefined),
        getReadyUrl: vi.fn().mockResolvedValue('ws://127.0.0.1:54321/ws'),
        getVtsStatus: vi.fn().mockResolvedValue({
          state: 'authenticated',
          detail: 'VTS authenticated and window detected.',
          authenticated: true,
          windowDetected: true
        }),
        getPluginStatus: vi.fn().mockResolvedValue({
          selectedPlugin: 'default',
          loadedPlugin: 'default',
          lifecycleState: 'active',
          summary: 'Plugin active.',
          developerDetails: null,
          fallbackActive: false,
          chatAvailable: true
        }),
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
        getAudioProviders: vi.fn().mockResolvedValue({
          providers: [
            {
              provider_id: 'funasr',
              kind: 'stt',
              display_name: 'FunASR',
              capabilities: ['local', 'requires_local_model', 'test_transcription', 'chinese_english'],
              local: true,
              requires_api_key: false,
              requires_consent: false,
              enabled: true,
              summary: 'Local STT adapter planned.'
            },
            {
              provider_id: 'faster_whisper',
              kind: 'stt',
              display_name: 'faster-whisper',
              capabilities: ['local', 'requires_local_model', 'test_transcription'],
              local: true,
              requires_api_key: false,
              requires_consent: false,
              enabled: true,
              summary: 'Local STT adapter planned.'
            },
            {
              provider_id: 'openai',
              kind: 'stt',
              display_name: 'OpenAI STT',
              capabilities: ['cloud', 'requires_api_key', 'test_transcription'],
              local: false,
              requires_api_key: true,
              requires_consent: true,
              enabled: true,
              summary: 'Cloud STT option.'
            },
            {
              provider_id: 'groq',
              kind: 'stt',
              display_name: 'Groq STT',
              capabilities: ['cloud', 'requires_api_key', 'test_transcription'],
              local: false,
              requires_api_key: true,
              requires_consent: true,
              enabled: true,
              summary: 'Cloud STT option.'
            }
          ]
        }),
        testSttProvider: vi.fn().mockResolvedValue({
          ok: false,
          provider_id: 'funasr',
          summary: COPY.SETTINGS.VOICE_IN_TEST_NOT_READY,
          failure: {
            provider_id: 'funasr',
            kind: 'stt',
            state: 'unavailable',
            summary: COPY.SETTINGS.VOICE_IN_TEST_NOT_READY,
            detail: null,
            retryable: true,
            latency_ms: null,
            redacted_diagnostics: { adapter: 'not_implemented' }
          },
          redacted_diagnostics: { adapter: 'not_implemented' }
        }),
        checkGptSoVitsHealth: vi.fn().mockResolvedValue({
          provider_id: 'gpt_sovits',
          kind: 'tts',
          state: 'ok',
          summary: 'GPT-SoVITS reachable.',
          detail: null,
          retryable: false,
          latency_ms: 12,
          redacted_diagnostics: null
        }),
        testGptSoVitsSynthesis: vi.fn().mockResolvedValue({
          ok: true,
          provider_id: 'gpt_sovits',
          media_type: 'wav',
          audio_base64: 'UklGRg==',
          sample_rate_hz: 24_000,
          duration_ms: 120,
          summary: 'Test synthesis ready.',
          failure: null
        }),
        startGptSoVits: vi.fn().mockResolvedValue({ mode: 'app_managed', appManaged: true, pid: 123, state: 'running', summary: 'running' }),
        stopGptSoVits: vi.fn().mockResolvedValue({ mode: 'app_managed', appManaged: false, pid: null, state: 'stopped', summary: 'stopped' }),
        restartGptSoVits: vi.fn().mockResolvedValue({ mode: 'app_managed', appManaged: true, pid: 124, state: 'running', summary: 'running' }),
        getGptSoVitsProcessStatus: vi.fn().mockResolvedValue({ mode: 'external', appManaged: false, pid: null, state: 'not_app_managed', summary: 'No app-launched GPT-SoVITS process is running.' }),
        listVoicePresets: vi.fn().mockResolvedValue([]),
        saveVoicePreset: vi.fn().mockResolvedValue([]),
        deleteVoicePreset: vi.fn().mockResolvedValue([]),
        setActiveVoicePresetForAvatarSession: vi.fn().mockResolvedValue({}),
        pickAndImportReferenceAudio: vi.fn().mockResolvedValue(null),
        validateReferenceAudio: vi.fn().mockResolvedValue({
          ok: true,
          format: 'wav',
          duration_seconds: 4.2,
          sample_rate: 24_000,
          channels: 1,
          errors: [],
          redacted_diagnostics: 'ok'
        }),
        deleteReferenceAudio: vi.fn().mockResolvedValue([]),
        restartSidecar: vi.fn().mockResolvedValue(undefined),
        resetVtsAuth: vi.fn().mockResolvedValue(undefined),
        getCurrentAvatarId: vi.fn().mockResolvedValue('akari'),
        getCurrentAvatarPlan: vi.fn().mockResolvedValue(currentAvatarPlan),
        getLogLevel: vi.fn().mockResolvedValue('info'),
        saveLogLevel: vi.fn().mockResolvedValue('debug'),
        openLogFolder: vi.fn().mockResolvedValue(undefined),
        getChromeState: vi.fn().mockResolvedValue({
          logsDrawerEnabled: false,
          logsDrawerHeight: 200,
          logsDrawerCollapsed: true
        }),
        saveChromeState: vi.fn().mockResolvedValue({
          logsDrawerEnabled: false,
          logsDrawerHeight: 200,
          logsDrawerCollapsed: true
        }),
        getThemePreference: vi.fn().mockResolvedValue(null),
        saveThemePreference: vi.fn().mockResolvedValue(undefined),
        listBodyMotionPlugins: vi.fn().mockResolvedValue([
          {
            name: 'default',
            version: '1.0.0',
            description: 'Default body motion',
            source: 'repo',
            path: 'plugins/default/plugin.yaml',
            valid: true,
            selectable: true
          },
          {
            name: 'test-motion',
            version: '0.1.0',
            description: 'Test body motion',
            source: 'userData',
            path: 'userData/plugins/test-motion/plugin.yaml',
            valid: true,
            selectable: true
          }
        ]),
        openHud: vi.fn().mockResolvedValue(undefined),
        listConversationSessions: vi.fn().mockResolvedValue([
          {
            id: 's1',
            title: 'Croissant plan',
            titleSource: 'manual',
            createdAt: '2026-05-09T12:00:00.000Z',
            updatedAt: '2026-05-09T12:01:00.000Z',
            lastMessageAt: '2026-05-09T12:01:00.000Z',
            messageCount: 2,
            preview: 'Fresh croissants.'
          }
        ]),
        getActiveConversationSession: vi.fn().mockResolvedValue({
          id: 's1',
          title: 'Croissant plan',
          titleSource: 'manual',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:01:00.000Z',
          lastMessageAt: '2026-05-09T12:01:00.000Z',
          messages: [
            {
              id: 'u1',
              role: 'user',
              text: 'Any croissants?',
              createdAt: '2026-05-09T12:00:00.000Z'
            },
            {
              id: 'a1',
              role: 'assistant',
              text: 'Fresh croissants.',
              createdAt: '2026-05-09T12:01:00.000Z'
            }
          ]
        }),
        clearConversationHistory: vi.fn().mockResolvedValue({
          id: 's2',
          title: 'New chat',
          titleSource: 'auto',
          createdAt: '2026-05-09T12:02:00.000Z',
          updatedAt: '2026-05-09T12:02:00.000Z',
          lastMessageAt: null,
          messages: []
        }),
        commitConversationTurn: vi.fn().mockResolvedValue({
          id: 's1',
          title: 'Croissant plan',
          titleSource: 'manual',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:01:00.000Z',
          lastMessageAt: '2026-05-09T12:01:00.000Z',
          messages: []
        }),
        getConversationStats: vi.fn().mockResolvedValue({
          sessionCount: 1,
          messageCount: 2,
          activeSessionId: 's1',
          persistence: 'local'
        }),
        onSidecarReady: vi.fn().mockReturnValue(() => undefined),
        onSidecarCrash: vi.fn().mockReturnValue(() => undefined)
      }
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:settings-test')
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    })
    vi.stubGlobal('Audio', vi.fn(function (_url: string) {
      return { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() }
    }))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
  })

  it('renders Phase 3 TTS as active, not a milestone placeholder', () => {
    renderSettings()

    expect(screen.getByRole('heading', { name: COPY.SETTINGS.TTS_HEADER })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: COPY.SETTINGS.VOICE_IN_HEADER })).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.TTS_ENGINE_VAL)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.TTS_OUTPUT_VAL)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.TTS_HELP)).toBeInTheDocument()
    expect(screen.queryByText(/Coming in milestone-3.*TTS/i)).toBeNull()
  })

  it('shows voice input provider choices with cloud consent blocked by default', async () => {
    renderSettings()

    expect(await screen.findByRole('radio', { name: /FunASR/i })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('radio', { name: /OpenAI STT/i }))

    expect(screen.getByLabelText(COPY.SETTINGS.VOICE_IN_CLOUD_CONSENT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_IN_TEST })).toBeDisabled()
    expect(screen.getByText(COPY.SETTINGS.VOICE_IN_TEST_BLOCKED)).toBeInTheDocument()
  })

  it('saves voice input settings without committing a conversation turn', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /faster-whisper/i }))
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_IN_LANGUAGE), { target: { value: 'en' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_IN_SAVE }))

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.objectContaining({
          stt: expect.objectContaining({
            active_provider: 'faster_whisper',
            language_mode: 'en'
          })
        })
      }))
    })
    expect(window.api.commitConversationTurn).not.toHaveBeenCalled()
  })

  it('selecting Piper local TTS explicitly saves piper without GPT-SoVITS gates', async () => {
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      audio: {
        ...defaultAudioConfig(),
        tts: { ...defaultAudioConfig().tts, active_provider: 'gpt_sovits', gpt_sovits: gptConfig() }
      }
    })

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /Piper local TTS/i }))

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.objectContaining({
          tts: expect.objectContaining({ active_provider: 'piper' })
        })
      }))
    })
    expect(window.api.checkGptSoVitsHealth).not.toHaveBeenCalled()
    expect(window.api.testGptSoVitsSynthesis).not.toHaveBeenCalled()
  })

  it('shows external versus app-launched GPT-SoVITS setup fields', async () => {
    renderSettings()

    await openGptSoVitsSettings()
    expect(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_BASE_URL)).toBeInTheDocument()
    expect(screen.queryByLabelText(COPY.SETTINGS.GPT_SOVITS_COMMAND)).toBeNull()

    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_CONNECTION_MODE), {
      target: { value: 'app_managed' }
    })

    expect(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_COMMAND)).toBeInTheDocument()
    expect(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_WORKING_DIRECTORY)).toBeInTheDocument()
    expect(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_HEALTH_URL)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_START })).toBeInTheDocument()
  })

  it('confirms before stopping app-launched GPT-SoVITS', async () => {
    renderSettings()

    await openGptSoVitsSettings()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_CONNECTION_MODE), {
      target: { value: 'app_managed' }
    })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_STOP_APP_LAUNCHED }))

    expect(window.api.stopGptSoVits).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog', { name: COPY.SETTINGS.GPT_SOVITS_STOP_APP_LAUNCHED })
    expect(within(dialog).getByText(COPY.SETTINGS.GPT_SOVITS_STOP_CONFIRM)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_STOP_APP_LAUNCHED }))

    await waitFor(() => {
      expect(window.api.stopGptSoVits).toHaveBeenCalledTimes(1)
    })
  })

  it('gates GPT-SoVITS activation on health plus successful test synthesis', async () => {
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [gptPreset()] })
    vi.mocked(window.api.testGptSoVitsSynthesis).mockResolvedValue({
      ok: false,
      provider_id: 'gpt_sovits',
      media_type: 'wav',
      audio_base64: null,
      sample_rate_hz: null,
      duration_ms: null,
      summary: 'failed',
      failure: null
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    const activate = await screen.findByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET })
    expect(activate).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))
    expect(await screen.findByText(COPY.SETTINGS.GPT_SOVITS_CANDIDATE_FAILURE)).toBeInTheDocument()
    expect(window.api.saveStoredConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      audio: expect.objectContaining({ tts: expect.objectContaining({ active_provider: 'gpt_sovits' }) })
    }))
  })

  it('persists the default first preset association in the activation config save', async () => {
    const preset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [preset] })
    vi.mocked(window.api.getAudioStatus).mockResolvedValue({
      provider_id: 'gpt_sovits',
      kind: 'tts',
      state: 'ok',
      summary: 'GPT-SoVITS service is reachable.',
      detail: null,
      retryable: false,
      latency_ms: 12,
      redacted_diagnostics: null
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_PREVIEW_READY)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET }))

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith(expect.objectContaining({
        activePresetByAvatarSession: expect.objectContaining({
          'avatar:akari|session:s1': preset.preset_id
        }),
        audio: expect.objectContaining({
          tts: expect.objectContaining({ active_provider: 'gpt_sovits' })
        })
      }))
    })
    expect(window.api.setActiveVoicePresetForAvatarSession).toHaveBeenCalledWith('akari', 's1', preset.preset_id)
  })

  it('activates a matching validated preset after health without redundant test synthesis', async () => {
    const config = gptConfig()
    const preset = validatedGptPreset(config)
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      audio: { ...defaultAudioConfig(), tts: { ...defaultAudioConfig().tts, gpt_sovits: config } },
      voicePresets: [preset]
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    expect(await screen.findByRole('radio', { name: /Akari bright.*Validated/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET }))

    await waitFor(() => {
      expect(window.api.setActiveVoicePresetForAvatarSession).toHaveBeenCalledWith('akari', 's1', preset.preset_id)
    })
    expect(window.api.testGptSoVitsSynthesis).not.toHaveBeenCalled()
  })

  it('keeps validation valid when only preset display name changes', async () => {
    const config = gptConfig()
    const preset = validatedGptPreset(config, { name: 'Renamed Akari' })
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      audio: { ...defaultAudioConfig(), tts: { ...defaultAudioConfig().tts, gpt_sovits: config } },
      voicePresets: [preset]
    })

    renderSettings()

    await openGptSoVitsSettings()
    expect(await screen.findByRole('radio', { name: /Renamed Akari.*Validated/i })).toBeInTheDocument()
  })

  it('marks synthesis-affecting edits as changed since last test and blocks activation', async () => {
    const config = gptConfig()
    const validated = validatedGptPreset(config)
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      audio: { ...defaultAudioConfig(), tts: { ...defaultAudioConfig().tts, gpt_sovits: config } },
      voicePresets: [{ ...validated, gpt_sovits: { ...validated.gpt_sovits, prompt_text: 'changed prompt' } }]
    })

    renderSettings()

    await openGptSoVitsSettings()
    expect(await screen.findByRole('radio', { name: /Akari bright.*Changed since last test/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET })).toBeDisabled()
  })

  it('marks text language and weight edits as changed since last test', async () => {
    const config = gptConfig()
    const validated = validatedGptPreset(config)
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      audio: { ...defaultAudioConfig(), tts: { ...defaultAudioConfig().tts, gpt_sovits: config } },
      voicePresets: [validated]
    })

    renderSettings()

    await openGptSoVitsSettings()
    expect(await screen.findByRole('radio', { name: /Akari bright.*Validated/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_TEXT_LANGUAGE), { target: { value: 'zh' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_GPT_WEIGHTS_PATH), { target: { value: 'GPT_weights_v2Pro/teto_v1-e15.ckpt' } })

    expect(await screen.findByRole('radio', { name: /Akari bright.*zh.*Changed since last test/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET })).toBeDisabled()
  })

  it('sends health with candidate preset text language, reference language, and weight paths', async () => {
    const preset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [preset] })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_TEXT_LANGUAGE), { target: { value: 'zh' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_GPT_WEIGHTS_PATH), { target: { value: 'GPT_weights_v2Pro/teto_v1-e15.ckpt' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_SOVITS_WEIGHTS_PATH), { target: { value: 'SoVITS_weights_v2Pro/teto_v1_e8_s160.pth' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))

    await waitFor(() => {
      expect(window.api.checkGptSoVitsHealth).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ provider_id: 'gpt_sovits' }),
        preset: expect.objectContaining({
          gpt_sovits: expect.objectContaining({
            text_lang: 'zh',
            prompt_lang: 'ja',
            gpt_weights_path: 'GPT_weights_v2Pro/teto_v1-e15.ckpt',
            sovits_weights_path: 'SoVITS_weights_v2Pro/teto_v1_e8_s160.pth'
          })
        })
      }))
    })
  })

  it('keeps synthesized text language independent from reference language', async () => {
    const preset = gptPreset({ gpt_sovits: { ...gptPreset().gpt_sovits, text_lang: 'zh', prompt_lang: 'ja' } })
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [preset] })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    expect(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_TEXT_LANGUAGE)).toHaveValue('zh')
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE), { target: { value: 'en' } })

    expect(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_TEXT_LANGUAGE)).toHaveValue('zh')
  })

  it('persists validation metadata onto the selected preset only after successful test synthesis', async () => {
    const preset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [preset] })
    vi.mocked(window.api.saveVoicePreset).mockImplementation(async (savedPreset) => [savedPreset])

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))

    await waitFor(() => {
      expect(window.api.saveVoicePreset).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({
          state: 'validated',
          fingerprint: buildGptSoVitsPresetValidationFingerprint(gptConfig(), preset)
        })
      }))
    })
  })

  it('persists selected reference audio into the activated preset before restarting chat TTS', async () => {
    const preset = gptPreset({
      gpt_sovits: { ...gptPreset().gpt_sovits, reference_audio_id: null, prompt_text: '' }
    })
    const referenceAsset = {
      asset_id: 'ref-akari',
      display_basename: 'akari.wav',
      managed_path_token: 'reference-audio/ref-akari-akari.wav',
      transcript_text: 'こんにちは',
      language: 'ja' as const,
      format: 'wav' as const,
      duration_ms: 3000
    }
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [preset],
      referenceAudioAssets: [referenceAsset]
    })
    vi.mocked(window.api.listVoicePresets).mockResolvedValue([preset])
    vi.mocked(window.api.saveVoicePreset).mockImplementation(async (savedPreset) => [savedPreset])
    vi.mocked(window.api.getAudioStatus).mockResolvedValue({
      provider_id: 'gpt_sovits',
      kind: 'tts',
      state: 'ok',
      summary: 'GPT-SoVITS service is reachable.',
      detail: null,
      retryable: false,
      latency_ms: 12,
      redacted_diagnostics: null
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_PREVIEW_READY)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET }))

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith(expect.objectContaining({
        voicePresets: [expect.objectContaining({
          preset_id: preset.preset_id,
          gpt_sovits: expect.objectContaining({
            reference_audio_id: referenceAsset.asset_id,
            prompt_text: referenceAsset.transcript_text,
            prompt_lang: referenceAsset.language
          })
        })],
        audio: expect.objectContaining({
          tts: expect.objectContaining({ active_provider: 'gpt_sovits' })
        })
      }))
    })
    expect(await screen.findByText(COPY.SETTINGS.GPT_SOVITS_ACTIVATION_SUCCESS)).toBeInTheDocument()
    expect(screen.getByText(/Runtime provider: gpt_sovits/i)).toBeInTheDocument()
  })

  it('keeps activation success even when runtime status still reports Piper', async () => {
    const preset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [preset] })
    vi.mocked(window.api.getAudioStatus).mockResolvedValue({
      provider_id: 'piper',
      kind: 'tts',
      state: 'ok',
      summary: 'Piper provider ready.',
      detail: 'voice=en_US-amy-medium',
      retryable: false,
      latency_ms: null,
      redacted_diagnostics: null
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_PREVIEW_READY)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET }))

    expect(await screen.findByText(COPY.SETTINGS.GPT_SOVITS_ACTIVATION_SUCCESS)).toBeInTheDocument()
    expect(screen.queryByText(COPY.SETTINGS.GPT_SOVITS_ACTIVATION_RUNTIME_MISMATCH)).toBeNull()
  })

  it('plays successful test synthesis audio without chat or history side effects', async () => {
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [gptPreset()] })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(window.Audio).toHaveBeenCalledWith('blob:settings-test')
    })
    expect(window.api.commitConversationTurn).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: /message/i })).toBeNull()
  })

  it('blocks test synthesis and activation until the selected preset has reference audio', async () => {
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [gptPreset({ gpt_sovits: { ...gptPreset().gpt_sovits, reference_audio_id: null, prompt_text: '' } })]
    })

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)

    expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).toBeDisabled()
    expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_ACTIVATE_PRESET })).toBeDisabled()
    expect(window.api.testGptSoVitsSynthesis).not.toHaveBeenCalled()
  })

  it('enables test synthesis after health when a selected reference asset can populate the preset', async () => {
    const preset = gptPreset({
      gpt_sovits: { ...gptPreset().gpt_sovits, reference_audio_id: null, prompt_text: '' }
    })
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [preset],
      referenceAudioAssets: [
        {
          asset_id: 'ref-selected',
          display_basename: 'selected.wav',
          managed_path_token: 'reference-audio/ref-selected-selected.wav',
          transcript_text: 'selected reference',
          language: 'en',
          format: 'wav',
          duration_ms: 3200
        }
      ]
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_HEALTH_CHECK }))
    await screen.findByText(COPY.SETTINGS.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING)

    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.GPT_SOVITS_TEST_SYNTHESIS }))

    await waitFor(() => {
      expect(window.api.testGptSoVitsSynthesis).toHaveBeenCalledWith(expect.objectContaining({
        preset: expect.objectContaining({
          gpt_sovits: expect.objectContaining({
            reference_audio_id: 'ref-selected',
            prompt_text: 'selected reference',
            prompt_lang: 'en'
          })
        })
      }))
    })
  })

  it('renders non-localhost GPT-SoVITS warning copy from settings copy', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.GPT_SOVITS_BASE_URL), {
      target: { value: 'http://192.168.1.50:9880' }
    })

    expect(screen.getByText(COPY.SETTINGS.GPT_SOVITS_NON_LOCAL_WARNING)).toBeInTheDocument()
  })

  it('renders the empty voice preset library state', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))

    expect(screen.getByText(COPY.SETTINGS.VOICE_PRESETS_EMPTY_HEAD)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.VOICE_PRESETS_EMPTY_BODY)).toBeInTheDocument()
  })

  it('creates, renames, selects, and deletes global presets without avatar catalog mutation', async () => {
    const initialPreset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [initialPreset],
      referenceAudioAssets: [{
        asset_id: 'ref-akari',
        display_basename: 'akari.wav',
        managed_path_token: 'reference-audio/ref-akari.wav',
        transcript_text: 'こんにちは',
        language: 'ja',
        format: 'wav',
        duration_ms: 3000
      }]
    })
    vi.mocked(window.api.saveVoicePreset).mockImplementation(async (preset: VoicePreset) => [preset])
    vi.mocked(window.api.deleteVoicePreset).mockResolvedValue([])

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: 'Soft Akari' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_SAVE }))

    await waitFor(() => {
      expect(window.api.saveVoicePreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'Soft Akari' }))
    })

    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: 'Bright Akari' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_SAVE }))
    await waitFor(() => {
      expect(window.api.saveVoicePreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bright Akari' }))
    })

    fireEvent.click(screen.getAllByRole('radio', { name: /Bright Akari/i }).at(-1)!)
    await waitFor(() => {
      expect(window.api.setActiveVoicePresetForAvatarSession).toHaveBeenCalledWith('akari', 's1', initialPreset.preset_id)
    })

    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_DELETE }))
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_DELETE_CONFIRM }))
    await waitFor(() => {
      expect(window.api.deleteVoicePreset).toHaveBeenCalledWith(initialPreset.preset_id)
    })
    expect(window.api.commitAvatarOverrides).toBeUndefined()
  })

  it('creates a separate preset from the current fields when clicking New preset', async () => {
    const initialPreset = gptPreset()
    let persistedPresets = [initialPreset]
    let activePresetByAvatarSession: Record<string, string> = {}
    vi.mocked(window.api.getStoredConfig).mockImplementation(async () => ({
      ...storedConfig,
      voicePresets: persistedPresets,
      activePresetByAvatarSession
    }))
    vi.mocked(window.api.listVoicePresets).mockImplementation(async () => persistedPresets)
    vi.mocked(window.api.saveVoicePreset).mockImplementation(async (preset: VoicePreset) => {
      persistedPresets = [...persistedPresets.filter((item) => item.preset_id !== preset.preset_id), preset]
      return persistedPresets
    })
    vi.mocked(window.api.setActiveVoicePresetForAvatarSession).mockImplementation(async (avatarId, sessionId, presetId) => {
      activePresetByAvatarSession = { [`avatar:${avatarId ?? 'global'}|session:${sessionId ?? 'global'}`]: presetId }
      return activePresetByAvatarSession
    })
    vi.mocked(window.api.pickAndImportReferenceAudio).mockResolvedValue({
      asset_id: 'ref-second',
      display_basename: 'second.wav',
      managed_path_token: 'reference-audio/ref-second-second.wav',
      transcript_text: 'second reference',
      language: 'en',
      format: 'wav',
      duration_ms: 3000
    })

    const firstRender = renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: 'Second Akari' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT), { target: { value: 'second reference' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE), { target: { value: 'en' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT }))
    await screen.findByText('second.wav')
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_NEW }))

    await waitFor(() => {
      expect(window.api.saveVoicePreset).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Second Akari',
        preset_id: expect.not.stringMatching(initialPreset.preset_id),
        gpt_sovits: expect.objectContaining({ reference_audio_id: 'ref-second', prompt_text: 'second reference', prompt_lang: 'en' })
      }))
    })
    await waitFor(() => {
      expect(window.api.setActiveVoicePresetForAvatarSession).toHaveBeenCalledWith('akari', 's1', expect.not.stringMatching(initialPreset.preset_id))
    })

    firstRender.unmount()
    renderSettings()
    await openGptSoVitsSettings()
    await waitForPresetLibrary()

    expect(await screen.findByRole('radio', { name: /Second Akari/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Akari bright/i })).not.toBeChecked()
  })

  it('rejects duplicate preset names when creating or renaming presets', async () => {
    const firstPreset = gptPreset()
    const secondPreset = gptPreset({ preset_id: 'preset-soft', name: 'Akari soft' })
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [firstPreset, secondPreset],
      referenceAudioAssets: [{
        asset_id: 'ref-akari',
        display_basename: 'akari.wav',
        managed_path_token: 'reference-audio/ref-akari.wav',
        transcript_text: 'こんにちは',
        language: 'ja',
        format: 'wav',
        duration_ms: 3000
      }]
    })
    vi.mocked(window.api.listVoicePresets).mockResolvedValue([firstPreset, secondPreset])

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: ' akari BRIGHT ' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_NEW }))

    expect(await screen.findByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_TITLE })).toHaveTextContent(COPY.SETTINGS.VOICE_PRESET_DUPLICATE_NAME)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_CLOSE }))
    fireEvent.click(screen.getByRole('radio', { name: /Akari soft/i }))
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: firstPreset.name } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_SAVE }))

    expect(await screen.findByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_TITLE })).toHaveTextContent(COPY.SETTINGS.VOICE_PRESET_DUPLICATE_NAME)
    expect(window.api.saveVoicePreset).not.toHaveBeenCalled()
  })

  it('shows save feedback and reloads persisted voice presets after returning to Settings', async () => {
    let persistedPresets: VoicePreset[] = []
    vi.mocked(window.api.getStoredConfig).mockImplementation(async () => ({
      ...storedConfig,
      voicePresets: persistedPresets
    }))
    vi.mocked(window.api.listVoicePresets).mockImplementation(async () => persistedPresets)
    vi.mocked(window.api.saveVoicePreset).mockImplementation(async (preset: VoicePreset) => {
      persistedPresets = [preset]
      return persistedPresets
    })
    vi.mocked(window.api.pickAndImportReferenceAudio).mockResolvedValue({
      asset_id: 'ref-persistent',
      display_basename: 'persistent.wav',
      managed_path_token: 'reference-audio/ref-persistent-persistent.wav',
      transcript_text: 'persistent reference',
      language: 'en',
      format: 'wav',
      duration_ms: 3000
    })

    const firstRender = renderSettings()
    await openGptSoVitsSettings()
    await waitForReferenceReady()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: 'Persistent Akari' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT), { target: { value: 'persistent reference' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE), { target: { value: 'en' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT }))
    await screen.findByText('persistent.wav')
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_NEW }))

    expect(await screen.findByText(COPY.SETTINGS.VOICE_PRESET_CREATE_SUCCESS)).toBeInTheDocument()
    firstRender.unmount()

    renderSettings()
    await openGptSoVitsSettings()
    await screen.findByRole('radio', { name: /Persistent Akari/i })

    expect(await screen.findByRole('radio', { name: /Persistent Akari/i })).toBeInTheDocument()
  })

  it('blocks active preset deletion without implicitly selecting Piper fallback', async () => {
    const preset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [preset],
      activePresetByAvatarSession: { 'avatar:akari|session:s1': preset.preset_id }
    })

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_DELETE }))

    expect(screen.getByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_DELETE_BLOCKED })).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.VOICE_PRESET_DELETE_LAST_ACTIVE)).toBeInTheDocument()
    expect(window.api.deleteVoicePreset).not.toHaveBeenCalled()
    expect(window.api.saveStoredConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      audio: expect.objectContaining({ tts: expect.objectContaining({ active_provider: 'piper' }) })
    }))
  })

  it('lets users reassign the active preset before deleting it', async () => {
    const activePreset = gptPreset()
    const replacementPreset = gptPreset({ preset_id: 'preset-soft', name: 'Akari soft' })
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [activePreset, replacementPreset],
      activePresetByAvatarSession: { 'avatar:akari|session:s1': activePreset.preset_id }
    })
    vi.mocked(window.api.listVoicePresets).mockResolvedValue([activePreset, replacementPreset])
    vi.mocked(window.api.setActiveVoicePresetForAvatarSession).mockResolvedValue({ 'avatar:akari|session:s1': replacementPreset.preset_id })
    vi.mocked(window.api.deleteVoicePreset).mockResolvedValue([replacementPreset])

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_DELETE }))

    const dialog = screen.getByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_DELETE_BLOCKED })
    expect(dialog).toHaveTextContent(COPY.SETTINGS.VOICE_PRESET_DELETE_REASSIGN_HELP)
    expect(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_DELETE_REASSIGN_LABEL)).toHaveValue(replacementPreset.preset_id)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_DELETE_REASSIGN_AND_DELETE }))

    await waitFor(() => {
      expect(window.api.setActiveVoicePresetForAvatarSession).toHaveBeenCalledWith('akari', 's1', replacementPreset.preset_id)
    })
    expect(window.api.deleteVoicePreset).toHaveBeenCalledWith(activePreset.preset_id)
  })

  it('imports reference audio and displays managed metadata without original absolute path', async () => {
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, voicePresets: [gptPreset()] })
    vi.mocked(window.api.pickAndImportReferenceAudio).mockResolvedValue({
      asset_id: 'ref-imported',
      display_basename: 'sample.wav',
      managed_path_token: 'reference-audio/ref-imported-sample.wav',
      transcript_text: 'こんにちは',
      language: 'ja',
      format: 'wav',
      duration_ms: 4200
    })

    renderSettings()

    await openGptSoVitsSettings()
    await waitForPresetLibrary()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT), { target: { value: 'こんにちは' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE), { target: { value: 'ja' } })
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT }))

    await waitFor(() => {
      expect(window.api.pickAndImportReferenceAudio).toHaveBeenCalledWith({ transcriptText: 'こんにちは', language: 'ja' })
    })
    expect(await screen.findByText('sample.wav')).toBeInTheDocument()
    expect(window.api.saveVoicePreset).not.toHaveBeenCalled()
    expect(screen.getByText('reference-audio/ref-imported-sample.wav')).toBeInTheDocument()
    expect(screen.queryByText(/C:\\Users/)).toBeNull()
    expect(screen.queryByText(/\/Users\//)).toBeNull()
  })

  it('requires transcript and language before reference asset activation', async () => {
    renderSettings()

    await openGptSoVitsSettings()
    await waitForReferenceReady()

    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT }))
    expect(await screen.findByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_TITLE })).toHaveTextContent(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_CLOSE }))
    expect(screen.getAllByText(COPY.SETTINGS.REFERENCE_AUDIO_REQUIRED).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT }))
    expect(await screen.findByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_TITLE })).toHaveTextContent(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE)
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_CLOSE }))
    expect(screen.getAllByText(COPY.SETTINGS.REFERENCE_AUDIO_REQUIRED).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE), { target: { value: 'en' } })
    expect(screen.getByText(COPY.SETTINGS.REFERENCE_AUDIO_READY)).toBeInTheDocument()
  })

  it('shows why a new preset was not saved when required voice reference information is missing', async () => {
    renderSettings()

    await openGptSoVitsSettings()
    await waitForReferenceReady()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.VOICE_PRESET_NAME), { target: { value: 'Broken Akari' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.VOICE_PRESET_NEW }))

    const dialog = await screen.findByRole('alertdialog', { name: COPY.SETTINGS.VOICE_PRESET_SAVE_BLOCKED_TITLE })
    expect(dialog).toHaveTextContent(COPY.SETTINGS.VOICE_PRESET_SAVE_MISSING_REFERENCE)
    expect(dialog).toHaveTextContent(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT)
    expect(dialog).toHaveTextContent(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE)
    expect(dialog).toHaveTextContent(COPY.SETTINGS.REFERENCE_AUDIO_HEADER)
    expect(window.api.saveVoicePreset).not.toHaveBeenCalled()
  })

  it('shows reference import failures instead of silently dropping them', async () => {
    vi.mocked(window.api.pickAndImportReferenceAudio).mockRejectedValue(new Error('Reference audio format must be one of: wav, flac, mp3, ogg.'))

    renderSettings()

    await openGptSoVitsSettings()
    await waitForReferenceReady()
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_TRANSCRIPT), { target: { value: 'hello' } })
    fireEvent.change(screen.getByLabelText(COPY.SETTINGS.REFERENCE_AUDIO_LANGUAGE), { target: { value: 'en' } })
    await waitFor(() => expect(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_IMPORT }))

    expect(await screen.findAllByText('Reference audio format must be one of: wav, flac, mp3, ogg.')).toHaveLength(2)
  })

  it('renders reference audio validation summary including server access', async () => {
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({ ...storedConfig, referenceAudioAssets: [{
      asset_id: 'ref-akari',
      display_basename: 'akari.wav',
      managed_path_token: 'reference-audio/ref-akari.wav',
      transcript_text: 'hello',
      language: 'en',
      format: 'wav',
      duration_ms: 3000
    }] })

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))

    expect(screen.getByText(COPY.SETTINGS.REFERENCE_AUDIO_VALIDATION_FORMAT)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.REFERENCE_AUDIO_VALIDATION_DURATION)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.REFERENCE_AUDIO_VALIDATION_METADATA)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.REFERENCE_AUDIO_VALIDATION_SERVER_ACCESS)).toBeInTheDocument()
  })

  it('blocks deleting in-use reference audio without cascade-deleting presets', async () => {
    const preset = gptPreset()
    vi.mocked(window.api.getStoredConfig).mockResolvedValue({
      ...storedConfig,
      voicePresets: [preset],
      referenceAudioAssets: [{
        asset_id: 'ref-akari',
        display_basename: 'akari.wav',
        managed_path_token: 'reference-audio/ref-akari.wav',
        transcript_text: 'hello',
        language: 'en',
        format: 'wav',
        duration_ms: 3000
      }]
    })

    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /GPT-SoVITS/i }))
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.REFERENCE_AUDIO_DELETE }))

    expect(screen.getByRole('alertdialog', { name: COPY.SETTINGS.REFERENCE_AUDIO_DELETE_BLOCKED(1) })).toBeInTheDocument()
    expect(window.api.deleteReferenceAudio).not.toHaveBeenCalled()
    expect(window.api.deleteVoicePreset).not.toHaveBeenCalled()
  })

  it('renders one combined Avatars section with current catalog counts and actions', async () => {
    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)

    expect(within(section).getByText('akari')).toBeInTheDocument()
    expect(within(section).getByText('Akari')).toBeInTheDocument()
    expect(within(section).getByText('C:/avatars/akari/model3.json')).toBeInTheDocument()
    expect(within(section).getByText('2')).toBeInTheDocument()
    expect(within(section).getByText('1')).toBeInTheDocument()
    expect(within(section).getByText('piper · en_US-amy-medium')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_EDIT_CURRENT })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_IMPORT_REPLACE })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Avatar catalogs' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Per-avatar settings' })).toBeNull()
  })

  it('routes Edit current to Avatar Import with the current avatar plan loaded', async () => {
    renderSettingsWithProbe()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    fireEvent.click(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_EDIT_CURRENT }))

    await waitFor(() => {
      expect(screen.getByTestId('store-view')).toHaveTextContent('avatar-import')
      expect(screen.getByTestId('store-avatar-plan')).toHaveTextContent('akari')
    })
  })

  it('routes Import/replace to Avatar Import without carrying the current plan', async () => {
    renderSettingsWithProbe()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    fireEvent.click(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_IMPORT_REPLACE }))

    await waitFor(() => {
      expect(screen.getByTestId('store-view')).toHaveTextContent('avatar-import')
      expect(screen.getByTestId('store-avatar-plan')).toHaveTextContent('none')
    })
  })

  it('shows degraded avatar state without assuming Teto when metadata is unavailable', async () => {
    vi.mocked(window.api.getCurrentAvatarId).mockResolvedValue('custom-avatar')
    vi.mocked(window.api.getCurrentAvatarPlan).mockResolvedValue(null)

    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(await within(section).findByText('custom-avatar')).toBeInTheDocument()
    expect(within(section).getByText(COPY.SETTINGS.AVATARS_DEGRADED)).toBeInTheDocument()
    expect(within(section).getByText(/saved editable catalog has not loaded yet/i)).toBeInTheDocument()
    expect(within(section).queryByText(/Catalog metadata is unavailable/i)).toBeNull()
    expect(within(section).queryByText(/teto/i)).toBeNull()
    expect(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_IMPORT_REPLACE })).not.toBeDisabled()
  })

  it('keeps the current avatar ID when metadata loading fails', async () => {
    vi.mocked(window.api.getCurrentAvatarId).mockResolvedValue('teto')
    vi.mocked(window.api.getCurrentAvatarPlan).mockRejectedValue(new Error('sidecar starting'))

    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(await within(section).findByText('teto')).toBeInTheDocument()
    expect(within(section).queryByText('unknown')).toBeNull()
  })

  it('retries current avatar metadata when Edit current is clicked after an initial miss', async () => {
    vi.mocked(window.api.getCurrentAvatarId).mockResolvedValue('akari')
    vi.mocked(window.api.getCurrentAvatarPlan)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(currentAvatarPlan)

    renderSettingsWithProbe()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    const editButton = await within(section).findByRole('button', { name: COPY.SETTINGS.AVATARS_EDIT_CURRENT })
    expect(editButton).not.toBeDisabled()
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(window.api.getCurrentAvatarPlan).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('store-view')).toHaveTextContent('avatar-import')
      expect(screen.getByTestId('store-avatar-plan')).toHaveTextContent('akari')
    })
  })

  it('disables Edit current when no current avatar ID is known', async () => {
    vi.mocked(window.api.getCurrentAvatarId).mockResolvedValue('')
    vi.mocked(window.api.getCurrentAvatarPlan).mockResolvedValue(null)

    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(await within(section).findByText(COPY.SETTINGS.AVATARS_UNKNOWN_ID)).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_EDIT_CURRENT })).toBeDisabled()
  })

  it('routes Edit current with saved edited avatar catalog rows', async () => {
    const savedPlan: AvatarImportPlan = {
      ...currentAvatarPlan,
      variants: [
        { code: 'saved-heart-eye', hotkey_id: 'hotkey-heart', is_placeholder: false, source_name: 'Heart Eye' }
      ],
      events: [
        {
          code: 'saved-wave',
          duration_is_fallback: false,
          duration_seconds: 2.4,
          hotkey_id: 'hotkey-saved-wave',
          is_loop: false,
          is_placeholder: false,
          motion_file: 'saved-wave.motion3.json'
        }
      ]
    }
    vi.mocked(window.api.getCurrentAvatarPlan).mockResolvedValue(savedPlan)

    renderSettingsWithProbe()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    fireEvent.click(within(section).getByRole('button', { name: COPY.SETTINGS.AVATARS_EDIT_CURRENT }))

    await waitFor(() => {
      expect(screen.getByTestId('store-view')).toHaveTextContent('avatar-import')
      expect(screen.getByTestId('store-avatar-variants')).toHaveTextContent('saved-heart-eye')
      expect(screen.getByTestId('store-avatar-events')).toHaveTextContent('saved-wave')
    })
  })

  it('does not show an unavailable notice after a successful edit-current retry', async () => {
    vi.mocked(window.api.getCurrentAvatarId).mockResolvedValue('akari')
    vi.mocked(window.api.getCurrentAvatarPlan)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(currentAvatarPlan)

    renderSettingsWithProbe()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.AVATARS_HEADER })
      .then((heading) => heading.closest('section')!)
    fireEvent.click(await within(section).findByRole('button', { name: COPY.SETTINGS.AVATARS_EDIT_CURRENT }))

    await waitFor(() => {
      expect(screen.getByTestId('store-view')).toHaveTextContent('avatar-import')
    })
    expect(within(section).queryByText(COPY.SETTINGS.AVATARS_EDIT_UNAVAILABLE)).toBeNull()
  })

  it('renders compact VTube Studio status and troubleshooting actions', async () => {
    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.VTS_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(within(section).getByText('VTS authenticated and window detected.')).toBeInTheDocument()
    expect(within(section).getByText(COPY.SETTINGS.VTS_HELP)).toBeInTheDocument()

    fireEvent.click(within(section).getByText(COPY.SETTINGS.VTS_TROUBLESHOOTING))
    fireEvent.click(within(section).getByRole('button', { name: COPY.SETTINGS.VTS_RESET_AUTH }))

    await waitFor(() => {
      expect(window.api.resetVtsAuth).toHaveBeenCalledTimes(1)
      expect(window.api.getVtsStatus).toHaveBeenCalled()
    })

    fireEvent.click(within(section).getByRole('button', { name: COPY.SETTINGS.VTS_RESTART }))
    await waitFor(() => {
      expect(window.api.restartSidecar).toHaveBeenCalled()
    })
  })

  it('renders Conversation as truth-only and Memory as disabled v4.0 scope', async () => {
    renderSettings()

    const conversation = await screen.findByRole('heading', { name: COPY.SETTINGS.CONVERSATION_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(within(conversation).getByText(COPY.SETTINGS.CONVERSATION_MODE_VAL)).toBeInTheDocument()
    expect(within(conversation).getByText(COPY.SETTINGS.CONVERSATION_RESET_VAL)).toBeInTheDocument()
    expect(within(conversation).queryByRole('button', { name: /new thread/i })).toBeNull()
    expect(within(conversation).queryByPlaceholderText(/search threads/i)).toBeNull()

    const memory = screen.getByRole('heading', { name: COPY.SETTINGS.MEMORY_HEADER }).closest('section')!
    expect(memory).toHaveAttribute('aria-disabled', 'true')
    expect(within(memory).getByText(/v4\.0 agentic system plus memory/i)).toBeInTheDocument()
  })

  it('shows real conversation history counts and clears all after confirmation', async () => {
    renderSettings()

    const conversation = await screen.findByRole('heading', { name: COPY.SETTINGS.CONVERSATION_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(within(conversation).getByText('Croissant plan')).toBeInTheDocument()
    expect(within(conversation).getByText('2')).toBeInTheDocument()
    expect(within(conversation).getByText(COPY.SETTINGS.CONVERSATION_HELP)).toBeInTheDocument()

    fireEvent.click(within(conversation).getByRole('button', { name: COPY.SETTINGS.CONVERSATION_CLEAR }))
    expect(screen.getByRole('alertdialog', { name: COPY.SETTINGS.CONVERSATION_CLEAR_TITLE })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.CONVERSATION_CLEAR_CONFIRM }))

    await waitFor(() => {
      expect(window.api.clearConversationHistory).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText(COPY.SETTINGS.CONVERSATION_CLEAR_DONE)).toBeInTheDocument()
  })

  it('persists diagnostics log level and removes targeted stale milestone-2 copy', async () => {
    renderSettings()

    const select = await screen.findByRole('combobox', { name: COPY.SETTINGS.DIAG_LOG_LEVEL })
    fireEvent.change(select, { target: { value: 'debug' } })

    await waitFor(() => {
      expect(window.api.saveLogLevel).toHaveBeenCalledWith('debug')
    })
    expect(select).toHaveValue('debug')
    expect(screen.queryByText('Coming in milestone-2.', { exact: false })).toBeNull()
  })

  it('explains what each diagnostics log level means', async () => {
    renderSettings()

    expect(await screen.findByText(/Error: only failures/i)).toBeInTheDocument()
    expect(screen.getByText(/Warn: problems that need attention/i)).toBeInTheDocument()
    expect(screen.getByText(/Info: normal app milestones/i)).toBeInTheDocument()
    expect(screen.getByText(/Debug: verbose troubleshooting detail/i)).toBeInTheDocument()
  })

  it('opens the diagnostics log folder through the Electron bridge', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: COPY.SETTINGS.DIAG_OPEN_FOLDER }))

    await waitFor(() => {
      expect(window.api.openLogFolder).toHaveBeenCalledTimes(1)
    })
  })

  it('shows the current v2.1 milestone in About instead of the skeleton version', async () => {
    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.ABOUT_HEADER })
      .then((heading) => heading.closest('section')!)
    expect(within(section).getByText(/v2\.1 Mock\/Reality Cleanup/i)).toBeInTheDocument()
    expect(within(section).queryByText('0.1.0-skeleton')).toBeNull()
  })

  it('renders body-motion plugin selection and persists active plugin', async () => {
    renderSettings()

    expect(await screen.findByRole('heading', { name: COPY.SETTINGS.PLUGINS_HEADER })).toBeInTheDocument()
    fireEvent.click(await screen.findByText('test-motion v0.1.0'))

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith({
        ...storedConfig,
        plugin: { activePluginName: 'test-motion' }
      })
    })
    expect(screen.getByText(COPY.SETTINGS.PLUGINS_SAVED)).toBeInTheDocument()
  })

  it('shows invalid plugin manifests with details and keeps them selectable', async () => {
    vi.mocked(window.api.listBodyMotionPlugins).mockResolvedValue([
      {
        name: 'broken-motion',
        version: null,
        description: null,
        source: 'userData',
        path: 'userData/plugins/broken/plugin.yaml',
        valid: false,
        selectable: true,
        statusSummary: 'Manifest invalid; selecting it will use fallback/null motion.',
        developerDetails: 'missing api_version',
        manifestApiVersion: null
      }
    ])

    renderSettings()

    expect(await screen.findByText('broken-motion - invalid')).toBeInTheDocument()
    expect(screen.getByText(/selecting it will use fallback\/null motion/i)).toBeInTheDocument()
    expect(screen.getByText('missing api_version')).toBeInTheDocument()

    fireEvent.click(screen.getByText('broken-motion - invalid'))
    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith({
        ...storedConfig,
        plugin: { activePluginName: 'broken-motion' }
      })
    })
  })

  it('renders Open HUD button in the body motion plugin section', async () => {
    renderSettings()

    expect(await screen.findByRole('button', { name: COPY.HUD.OPEN_HUD_BUTTON })).toBeInTheDocument()
  })

  it('clicking Open HUD invokes window.api.openHud', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: COPY.HUD.OPEN_HUD_BUTTON }))

    await waitFor(() => {
      expect(window.api.openHud).toHaveBeenCalledTimes(1)
    })
  })

  it('renders Open HUD helper text', async () => {
    renderSettings()

    expect(await screen.findByText(COPY.HUD.OPEN_HUD_HELP)).toBeInTheDocument()
  })

  it('persists cursor tracking toggle under body-motion plugin settings', async () => {
    renderSettings()

    const section = await screen.findByRole('heading', { name: COPY.SETTINGS.PLUGINS_HEADER })
      .then((heading) => heading.closest('section')!)
    const toggle = await within(section).findByRole('switch', {
      name: COPY.SETTINGS.PLUGINS_CURSOR_TRACKING
    })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith({
        ...storedConfig,
        plugin: { activePluginName: 'default', cursorTrackingEnabled: false }
      })
    })
    expect(screen.getByText(COPY.SETTINGS.PLUGINS_SAVED)).toBeInTheDocument()
  })

  it('refreshes connection status through real APIs without scripted model text', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: COPY.SETTINGS.CONN_REFRESH }))

    await waitFor(() => {
      expect(window.api.getStoredConfig).toHaveBeenCalled()
      expect(window.api.getVtsStatus).toHaveBeenCalled()
    })
    expect(screen.queryByText(/qwen2\.5/i)).toBeNull()
    expect(screen.queryByText(/last reply/i)).toBeNull()
  })

  it('lets the stored auto-detect model remain editable after setup', async () => {
    renderSettings()

    expect(await screen.findByText('auto-detect')).toBeInTheDocument()
    const editButton = await screen.findByRole('button', { name: COPY.SETTINGS.CONN_CHANGE })
    expect(editButton).not.toBeDisabled()

    fireEvent.click(editButton)

    expect(await screen.findByLabelText(COPY.LLM_SETUP.MODEL_LABEL)).toHaveValue('')
    expect(screen.getByPlaceholderText(COPY.LLM_SETUP.MODEL_PLACEHOLDER)).toBeInTheDocument()
    expect(screen.queryByText(/Re-configure provider lands/i)).toBeNull()
  })

  it('saves edited LLM provider settings and preserves plugin config', async () => {
    const preservedConfig = {
      ...storedConfig,
      plugin: { activePluginName: 'test-motion' }
    }
    vi.mocked(window.api.getStoredConfig).mockResolvedValue(preservedConfig)
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: COPY.SETTINGS.CONN_CHANGE }))
    fireEvent.change(await screen.findByRole('combobox', { name: 'Provider' }), {
      target: { value: 'custom' }
    })
    fireEvent.change(screen.getByLabelText(COPY.LLM_SETUP.ENDPOINT_LABEL), {
      target: { value: 'https://llm.example.test/v1' }
    })
    fireEvent.change(screen.getByLabelText(COPY.LLM_SETUP.MODEL_LABEL), {
      target: { value: 'teto-test-model' }
    })
    fireEvent.change(screen.getByLabelText(COPY.LLM_SETUP.APIKEY_LABEL), {
      target: { value: 'test-api-key' }
    })
    fireEvent.click(screen.getByRole('button', { name: COPY.SETTINGS.CONN_SAVE }))

    await waitFor(() => {
      expect(window.api.saveStoredConfig).toHaveBeenCalledWith({
        ...preservedConfig,
        provider: {
          provider: 'custom_openai',
          endpointUrl: 'https://llm.example.test/v1',
          apiKey: 'test-api-key',
          modelName: 'teto-test-model'
        },
        plugin: { activePluginName: 'test-motion' },
        hasCompletedSetup: true,
        schemaVersion: 2,
        audio: defaultAudioConfig()
      })
    })
    expect(await screen.findByText(COPY.SETTINGS.CONN_SAVED)).toBeInTheDocument()
    expect(screen.getByText('teto-test-model')).toBeInTheDocument()
    expect(screen.queryByText(/qwen2\.5/i)).toBeNull()
  })
})
