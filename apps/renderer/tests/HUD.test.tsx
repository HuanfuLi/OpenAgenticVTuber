import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HudRoot } from '@/screens/HUD/HUD'
import { AppStoreProvider } from '@/state/app-store'
import { ThemeProvider } from '@/state/theme-provider'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  readyState = 0
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.()
    }, 0)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.onclose?.()
  }
}

const MOCK_RIG_CAPS = {
  writable_param_ids: ['ParamAngleX', 'ParamBHandIN', 'MouthOpen', 'ParamMouthOpenY'],
  param_ranges: {
    ParamAngleX: [-30, 30],
    ParamBHandIN: [0, 1],
    MouthOpen: [0, 1],
    ParamMouthOpenY: [0, 1]
  },
  expressions: [],
  hotkeys: [],
  cdi3_display_names: { ParamAngleX: 'Angle X' },
  sign_inversions: [],
  default_plugin_action_bindings: [],
  hud_excluded_param_ids: ['MouthOpen', 'ParamMouthOpenY']
}

function renderHud() {
  return render(
    <ThemeProvider>
      <AppStoreProvider>
        <HudRoot />
      </AppStoreProvider>
    </ThemeProvider>
  )
}

describe('HudRoot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    ;(globalThis as any).WebSocket = MockWebSocket
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RIG_CAPS
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getReadyUrl: vi.fn().mockResolvedValue('http://127.0.0.1:9999'),
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

  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as any).WebSocket
    delete (globalThis as any).fetch
    delete (window as any).api
  })

  it('mounts loading state then renders rig-derived rows', async () => {
    renderHud()
    expect(screen.getByText('Loading rig parameters...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Angle X')).toBeInTheDocument()
      expect(screen.getByText('ParamBHandIN')).toBeInTheDocument()
    })
  })

  it('NEVER renders MouthOpen or ParamMouthOpenY rows', async () => {
    renderHud()
    await waitFor(() => screen.getByText('Angle X'))

    expect(screen.queryByText('MouthOpen')).toBeNull()
    expect(screen.queryByText('ParamMouthOpenY')).toBeNull()
  })

  it('opens /hud/ws after mount', async () => {
    renderHud()

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1)
      expect(MockWebSocket.instances[0]?.url).toMatch(/\/hud\/ws$/)
    })
  })

  it('updates row value when param-frame arrives', async () => {
    renderHud()
    await waitFor(() => screen.getByText('Angle X'))
    const ws = MockWebSocket.instances[0]!

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          kind: 'param-frame',
          tick_n: 1,
          params: { ParamAngleX: 0.5, ParamBHandIN: 0 },
          locked_ids: []
        })
      })
    })

    await waitFor(() => screen.getByText('0.50'))
  })

  it('sends set-lock on drag and clear-lock on locked toggle', async () => {
    renderHud()
    await waitFor(() => screen.getByText('Angle X'))
    const ws = MockWebSocket.instances[0]!
    act(() => {
      vi.runOnlyPendingTimers()
    })

    fireEvent.pointerDown(screen.getByLabelText('Angle X value'))
    fireEvent.change(screen.getByLabelText('Angle X value'), { target: { value: '10' } })

    await waitFor(() => {
      expect(ws.sent.some((msg) => msg.includes('"kind":"set-lock"'))).toBe(true)
    })

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          kind: 'param-frame',
          tick_n: 2,
          params: { ParamAngleX: 10 },
          locked_ids: ['ParamAngleX']
        })
      })
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Unlock Angle X' }))
    expect(ws.sent.some((msg) => msg.includes('"kind":"clear-lock"'))).toBe(true)
  })

  it('fires Avatar-changed toast when locked_ids drops from non-empty to empty', async () => {
    renderHud()
    await waitFor(() => screen.getByText('Angle X'))
    const ws = MockWebSocket.instances[0]!

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          kind: 'param-frame',
          tick_n: 1,
          params: { ParamAngleX: 0.5 },
          locked_ids: ['ParamAngleX']
        })
      })
      ws.onmessage?.({
        data: JSON.stringify({
          kind: 'param-frame',
          tick_n: 2,
          params: { ParamAngleX: 0 },
          locked_ids: []
        })
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Avatar changed - locks cleared.')).toBeInTheDocument()
    })
  })

  it('shows reconnecting banner when WS closes', async () => {
    renderHud()
    await waitFor(() => screen.getByText('Angle X'))
    const ws = MockWebSocket.instances[0]!

    act(() => {
      ws.close()
    })

    await waitFor(() => {
      expect(screen.getByText(/lost connection/i)).toBeInTheDocument()
    })
  })
})
