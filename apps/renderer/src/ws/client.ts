// Singleton WS client for the sidecar /ws endpoint.
// Localhost-only; URL comes from window.api.getReadyUrl() (set by Electron main
// after parsing the [READY] line from the sidecar).
//
// Reconnect-with-fixed-backoff schedule per RESEARCH.md Open Questions #3:
// 1s, 2s, 4s capped at 4s.

import type { WSMessage } from '@contracts/ws-message'

type Listener = (msg: WSMessage) => void
type OpenListener = (url: string, previousUrl: string | null) => void

interface ClientState {
  socket: WebSocket | null
  socketUrl: string | null
  url: string | null
  reconnectAttempt: number
  open: boolean
  generation: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  sidecarReadySubscribed: boolean
  lastOpenedUrl: string | null
  listeners: Set<Listener>
  stateListeners: Set<(open: boolean) => void>
  openListeners: Set<OpenListener>
}

const state: ClientState = {
  socket: null,
  socketUrl: null,
  url: null,
  reconnectAttempt: 0,
  open: false,
  generation: 0,
  reconnectTimer: null,
  sidecarReadySubscribed: false,
  lastOpenedUrl: null,
  listeners: new Set(),
  stateListeners: new Set(),
  openListeners: new Set()
}

const BACKOFF_MS = [1_000, 2_000, 4_000]
function backoffFor(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!
}

function notifyOpen(open: boolean): void {
  if (state.open === open) return
  state.open = open
  for (const cb of state.stateListeners) cb(open)
}

function clearReconnectTimer(): void {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
}

function subscribeToSidecarReady(): void {
  if (state.sidecarReadySubscribed) return
  state.sidecarReadySubscribed = true
  window.api.onSidecarReady((url) => {
    connect(url)
  })
}

function connect(url: string): void {
  const previousUrl = state.url
  const urlChanged = previousUrl !== null && previousUrl !== url

  if (urlChanged) {
    state.generation += 1
    state.reconnectAttempt = 0
    clearReconnectTimer()

    const previousSocket = state.socket
    state.socket = null
    state.socketUrl = null
    notifyOpen(false)

    if (
      previousSocket &&
      (previousSocket.readyState === WebSocket.OPEN ||
        previousSocket.readyState === WebSocket.CONNECTING)
    ) {
      previousSocket.close()
    }
  }

  state.url = url

  if (
    state.socket &&
    state.socketUrl === url &&
    (state.socket.readyState === WebSocket.OPEN ||
      state.socket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  clearReconnectTimer()
  const generation = state.generation
  const socket = new WebSocket(url)
  state.socket = socket
  state.socketUrl = url

  socket.addEventListener('open', () => {
    if (generation !== state.generation || socket !== state.socket) return
    const previousOpenedUrl = state.lastOpenedUrl
    state.lastOpenedUrl = url
    state.reconnectAttempt = 0
    notifyOpen(true)
    if (previousOpenedUrl && previousOpenedUrl !== url) {
      for (const cb of state.openListeners) cb(url, previousOpenedUrl)
    }
  })
  socket.addEventListener('message', (ev) => {
    if (generation !== state.generation || socket !== state.socket) return
    try {
      const msg = JSON.parse(ev.data as string) as WSMessage
      for (const cb of state.listeners) cb(msg)
    } catch {
      console.warn('[ws] non-JSON message dropped:', ev.data)
    }
  })
  socket.addEventListener('close', () => {
    if (generation !== state.generation || socket !== state.socket) return
    state.socket = null
    state.socketUrl = null
    notifyOpen(false)
    // Reconnect-with-fixed-backoff. RESEARCH Open Q #3.
    const delay = backoffFor(state.reconnectAttempt++)
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null
      if (generation === state.generation && state.url) connect(state.url)
    }, delay)
  })
  socket.addEventListener('error', () => {
    // Errors will trigger close; close handler does the reconnect.
  })
}

export async function ensureConnected(): Promise<void> {
  subscribeToSidecarReady()
  if (state.open) return
  const url = await window.api.getReadyUrl()
  if (url) {
    connect(url)
    return
  }

  // Sidecar not ready yet -- the global sidecar-ready listener above will
  // connect. Resolve once that socket opens.
  return new Promise((resolve) => {
    let shouldUnsubscribe = false
    let off: (() => void) | null = null
    const onState = (open: boolean): void => {
      if (!open) return
      if (off) {
        off()
      } else {
        shouldUnsubscribe = true
      }
      resolve()
    }
    off = subscribeState(onState)
    if (shouldUnsubscribe) off()
  })
}

export function send(msg: WSMessage): boolean {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify(msg))
    return true
  }
  return false
}

export function subscribe(cb: Listener): () => void {
  state.listeners.add(cb)
  return () => {
    state.listeners.delete(cb)
  }
}

export function subscribeState(cb: (open: boolean) => void): () => void {
  state.stateListeners.add(cb)
  cb(state.open) // emit current state on subscribe
  return () => {
    state.stateListeners.delete(cb)
  }
}

export function subscribeSidecarReconnect(cb: OpenListener): () => void {
  state.openListeners.add(cb)
  return () => {
    state.openListeners.delete(cb)
  }
}

// Initialize on module load. Vite HMR re-runs this file; the connect() guard
// above prevents double-sockets.
void ensureConnected()
