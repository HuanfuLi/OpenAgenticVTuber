import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { AppStoreProvider, useStore } from '@/state/app-store'

function StatusProbe() {
  const { status } = useStore()
  return (
    <div>
      <span data-testid="sidecar-status">{status.sidecar}</span>
      <span data-testid="sidecar-detail">{status.sidecarDetail}</span>
    </div>
  )
}

describe('AppStore sidecar status', () => {
  let readyCb: ((url: string) => void) | null = null
  let crashCb: ((info: { code: number; willRespawn: boolean }) => void) | null = null

  beforeEach(() => {
    readyCb = null
    crashCb = null
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getStoredConfig: vi.fn().mockResolvedValue(null),
        getReadyUrl: vi.fn().mockResolvedValue(null),
        getVtsStatus: vi.fn().mockResolvedValue({
          state: 'unavailable',
          detail: 'Sidecar is not ready.',
          authenticated: false,
          windowDetected: false
        }),
        getChromeState: vi.fn().mockResolvedValue({
          logsDrawerEnabled: false,
          logsDrawerHeight: 200,
          logsDrawerCollapsed: true
        }),
        onSidecarReady: vi.fn((cb: (url: string) => void) => {
          readyCb = cb
          return () => undefined
        }),
        onSidecarCrash: vi.fn((cb: (info: { code: number; willRespawn: boolean }) => void) => {
          crashCb = cb
          return () => undefined
        })
      }
    })
  })

  it('reflects ready, restarting, and permanent crash lifecycle states', async () => {
    render(
      <AppStoreProvider>
        <StatusProbe />
      </AppStoreProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('sidecar-status')).toHaveTextContent('amber')
      expect(screen.getByTestId('sidecar-detail')).toHaveTextContent('starting')
    })

    act(() => readyCb?.('ws://127.0.0.1:54321/ws'))
    await waitFor(() => {
      expect(screen.getByTestId('sidecar-status')).toHaveTextContent('green')
      expect(screen.getByTestId('sidecar-detail')).toHaveTextContent('ws://127.0.0.1:54321/ws')
    })

    act(() => crashCb?.({ code: 1, willRespawn: true }))
    await waitFor(() => {
      expect(screen.getByTestId('sidecar-status')).toHaveTextContent('amber')
      expect(screen.getByTestId('sidecar-detail')).toHaveTextContent('restarting')
    })

    act(() => crashCb?.({ code: 137, willRespawn: false }))
    await waitFor(() => {
      expect(screen.getByTestId('sidecar-status')).toHaveTextContent('red')
      expect(screen.getByTestId('sidecar-detail')).toHaveTextContent('exited code 137')
    })
  })
})
