import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { COPY } from '@/lib/copy'
import { LLMSetup } from '@/screens/LLMSetup/LLMSetup'

describe('LLMSetup help action', () => {
  it('opens setup help through the Electron bridge', () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        openSetupHelp: vi.fn().mockResolvedValue(undefined)
      }
    })

    render(<LLMSetup />)

    fireEvent.click(screen.getByRole('button', { name: COPY.SETUP.HELP_LINK }))

    expect(window.api.openSetupHelp).toHaveBeenCalledTimes(1)
  })
})
