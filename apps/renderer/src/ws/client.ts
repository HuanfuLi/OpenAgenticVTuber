// Singleton WS client for the sidecar /ws endpoint.
// Localhost-only; URL comes from window.api.getReadyUrl() (set by Electron main
// after parsing the [READY] line from the sidecar).
//
// Reconnect-with-fixed-backoff schedule per RESEARCH.md Open Questions #3:
// 1s, 2s, 4s capped at 4s.

import type { WSMessage } from '@contracts/ws-message'

type Listener = (msg: WSMessage) => void

interface ClientState {
  socket: WebSocket | null
  url: string | null
  reconnectAttempt: number
  open: boolean
  listeners: Set<Listener>
  stateListeners: Set<(open: boolean) => void>
}

const state: ClientState = {
  socket: null,
  url: null,
  reconnectAttempt: 0,
  open: false,
  listeners: new Set(),
  stateListeners: new Set()
}

const BACKOFF_MS = [1_000, 2_000, 4_000]
function backoffFor(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!
}

function connect(url: string): void {
  if (
    state.socket &&
    (state.socket.readyState === WebSocket.OPEN ||
      state.socket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }
  state.url = url
  const socket = new WebSocket(url)
  state.socket = socket

  socket.addEventListener('open', () => {
    state.open = true
    state.reconnectAttempt = 0
    for (const cb of state.stateListeners) cb(true)
  })
  socket.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as WSMessage
      for (const cb of state.listeners) cb(msg)
    } catch {
      console.warn('[ws] non-JSON message dropped:', ev.data)
    }
  })
  socket.addEventListener('close', () => {
    state.open = false
    state.socket = null
    for (const cb of state.stateListeners) cb(false)
    // Reconnect-with-fixed-backoff. RESEARCH Open Q #3.
    const delay = backoffFor(state.reconnectAttempt++)
    setTimeout(() => {
      if (state.url) connect(state.url)
    }, delay)
  })
  socket.addEventListener('error', () => {
    // Errors will trigger close; close handler does the reconnect.
  })
}

export async function ensureConnected(): Promise<void> {
  if (state.open) return
  const url = await window.api.getReadyUrl()
  if (!url) {
    // Sidecar not ready yet -- listen for the next ready event.
    return new Promise((resolve) => {
      const off = window.api.onSidecarReady((u) => {
        off()
        connect(u)
        resolve()
      })
    })
  }
  connect(url)
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

// Initialize on module load. Vite HMR re-runs this file; the connect() guard
// above prevents double-sockets.
void ensureConnected()
