import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppStoreProvider } from '@/state/app-store'
import { ThemeProvider } from '@/state/theme-provider'
import { COPY } from '@/lib/copy'
import { Settings } from '@/screens/Settings/Settings'

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
  const storedConfig = {
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
})
