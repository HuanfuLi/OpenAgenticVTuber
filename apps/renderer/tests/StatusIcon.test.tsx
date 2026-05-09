import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppStoreProvider } from '@/state/app-store'
import { StatusIcon } from '@/chrome/StatusIcon'
import { defaultAudioConfig } from '@/state/setup-store'

const storedConfig = {
  provider: {
    provider: 'lm_studio',
    endpointUrl: 'http://localhost:1234/v1',
    apiKey: '',
    modelName: 'teto-test-model'
  },
  plugin: { activePluginName: 'default' },
  hasCompletedSetup: true,
  schemaVersion: 2,
  audio: defaultAudioConfig()
}

function installApi() {
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
      restartSidecar: vi.fn().mockResolvedValue(undefined),
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
      onSidecarReady: vi.fn().mockReturnValue(() => undefined),
      onSidecarCrash: vi.fn().mockReturnValue(() => undefined)
    }
  })
}

function renderStatusIcon() {
  return render(
    <AppStoreProvider>
      <StatusIcon />
    </AppStoreProvider>
  )
}

describe('StatusIcon', () => {
  beforeEach(() => {
    installApi()
  })

  it('renders persisted provider/model without scripted status text', async () => {
    renderStatusIcon()

    fireEvent.click(screen.getByRole('button', { name: /Status:/i }))

    expect(await screen.findByText('teto-test-model · LM Studio')).toBeInTheDocument()
    expect(screen.getByText('default: Plugin active.')).toBeInTheDocument()
    expect(screen.queryByText(/qwen2\.5/i)).toBeNull()
    expect(screen.queryByText(/last reply/i)).toBeNull()
  })

  it('refreshes through real status APIs instead of simulating success', async () => {
    renderStatusIcon()
    fireEvent.click(screen.getByRole('button', { name: /Status:/i }))
    await screen.findByText('teto-test-model · LM Studio')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }))

    await waitFor(() => {
      expect(window.api.getStoredConfig).toHaveBeenCalledTimes(2)
      expect(window.api.getVtsStatus).toHaveBeenCalledTimes(2)
      expect(window.api.getPluginStatus).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText(/qwen2\.5/i)).toBeNull()
    expect(screen.queryByText(/last reply/i)).toBeNull()
  })
})
