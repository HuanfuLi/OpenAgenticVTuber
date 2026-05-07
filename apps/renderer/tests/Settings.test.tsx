import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getStoredConfig: vi.fn().mockResolvedValue(null),
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
})
