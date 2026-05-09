import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

type ReadyHandler = (url: string) => void

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  private listeners = new Map<string, Set<(event: Event | MessageEvent) => void>>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, cb: (event: Event | MessageEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(cb)
    this.listeners.set(type, listeners)
  }

  send(_data: string): void {
    // Test double only needs to expose the browser API shape.
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    this.dispatch('close', new Event('close'))
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.dispatch('open', new Event('open'))
  }

  private dispatch(type: string, event: Event | MessageEvent): void {
    for (const cb of this.listeners.get(type) ?? []) cb(event)
  }
}

function installWindowApi(initialUrl: string | null, readyHandlers: ReadyHandler[]): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      getReadyUrl: vi.fn().mockResolvedValue(initialUrl),
      onSidecarReady: vi.fn((cb: ReadyHandler) => {
        readyHandlers.push(cb)
        return () => {
          const index = readyHandlers.indexOf(cb)
          if (index >= 0) readyHandlers.splice(index, 1)
        }
      })
    }
  })
}

async function importClient() {
  vi.resetModules()
  const client = await import('@/ws/client')
  await Promise.resolve()
  await Promise.resolve()
  return client
}

describe('WS client sidecar restart handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('switches to a new sidecar-ready URL and closes the old socket', async () => {
    const readyHandlers: ReadyHandler[] = []
    installWindowApi('ws://127.0.0.1:1111/ws', readyHandlers)

    await importClient()
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0]?.url).toBe('ws://127.0.0.1:1111/ws')

    const oldSocket = FakeWebSocket.instances[0]!
    oldSocket.open()
    readyHandlers[0]?.('ws://127.0.0.1:2222/ws')

    expect(oldSocket.readyState).toBe(FakeWebSocket.CLOSED)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(FakeWebSocket.instances[1]?.url).toBe('ws://127.0.0.1:2222/ws')
  })

  it('does not reconnect a stale socket URL after switching sidecars', async () => {
    const readyHandlers: ReadyHandler[] = []
    installWindowApi('ws://127.0.0.1:1111/ws', readyHandlers)

    await importClient()
    const oldSocket = FakeWebSocket.instances[0]!
    oldSocket.open()

    readyHandlers[0]?.('ws://127.0.0.1:2222/ws')
    FakeWebSocket.instances[1]?.open()

    await vi.advanceTimersByTimeAsync(10_000)

    expect(FakeWebSocket.instances.map((socket) => socket.url)).toEqual([
      'ws://127.0.0.1:1111/ws',
      'ws://127.0.0.1:2222/ws'
    ])
  })

  it('emits a sidecar reconnect event only after the replacement socket opens', async () => {
    const readyHandlers: ReadyHandler[] = []
    installWindowApi('ws://127.0.0.1:1111/ws', readyHandlers)

    const client = await importClient()
    const reconnects: Array<{ url: string; previousUrl: string | null }> = []
    client.subscribeSidecarReconnect((url, previousUrl) => {
      reconnects.push({ url, previousUrl })
    })

    FakeWebSocket.instances[0]?.open()
    expect(reconnects).toEqual([])

    readyHandlers[0]?.('ws://127.0.0.1:2222/ws')
    expect(reconnects).toEqual([])

    FakeWebSocket.instances[1]?.open()
    expect(reconnects).toEqual([
      {
        url: 'ws://127.0.0.1:2222/ws',
        previousUrl: 'ws://127.0.0.1:1111/ws'
      }
    ])
  })
})
