import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppStoreProvider } from '@/state/app-store'
import { ThemeProvider } from '@/state/theme-provider'
import { COPY } from '@/lib/copy'
import { Settings } from '@/screens/Settings/Settings'
import type { StoredConfig } from '@preload-types'

function renderSettings() {
  return render(
    <AppStoreProvider>
      <ThemeProvider>
        <Settings />
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
    schemaVersion: 1
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
            path: 'plugins/default/plugin.yaml'
          },
          {
            name: 'test-motion',
            version: '0.1.0',
            description: 'Test body motion',
            source: 'userData',
            path: 'userData/plugins/test-motion/plugin.yaml'
          }
        ]),
        openHud: vi.fn().mockResolvedValue(undefined),
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
        schemaVersion: 1
      })
    })
    expect(await screen.findByText(COPY.SETTINGS.CONN_SAVED)).toBeInTheDocument()
    expect(screen.getByText('teto-test-model')).toBeInTheDocument()
    expect(screen.queryByText(/qwen2\.5/i)).toBeNull()
  })
})
