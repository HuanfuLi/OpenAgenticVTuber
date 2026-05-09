import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/state/theme-provider'

function ThemeProbe() {
  const { prefs, setPrefs } = useTheme()
  return (
    <button onClick={() => setPrefs({ mode: 'dark', darkBg: 'onyx' })}>
      {prefs.mode}:{prefs.darkBg}
    </button>
  )
}

describe('ThemeProvider persistence', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getThemePreference: vi.fn().mockResolvedValue({
          mode: 'light',
          lightAccent: 'ember',
          darkBg: 'midnight',
          darkAccent: 'sky'
        }),
        saveThemePreference: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('hydrates and saves theme preference through window.api', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )

    expect(await screen.findByRole('button', { name: 'light:midnight' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(window.api.saveThemePreference).toHaveBeenCalledWith({
        mode: 'dark',
        lightAccent: 'ember',
        darkBg: 'onyx',
        darkAccent: 'sky'
      })
    })
  })
})
