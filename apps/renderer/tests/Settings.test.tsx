import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AppStoreProvider, useStore } from '@/state/app-store'
import { ThemeProvider } from '@/state/theme-provider'
import { COPY } from '@/lib/copy'
import { Settings } from '@/screens/Settings/Settings'
import { defaultAudioConfig } from '@/state/setup-store'
import type { StoredConfig } from '@preload-types'
import type { AvatarImportPlan } from '@contracts/avatar-import-plan'

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

describe('Settings TTS section', () => {
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
    expect(screen.getByText(COPY.SETTINGS.TTS_ENGINE_VAL)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.TTS_OUTPUT_VAL)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.TTS_HELP)).toBeInTheDocument()
    expect(screen.queryByText(/Coming in milestone-3.*TTS/i)).toBeNull()
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
