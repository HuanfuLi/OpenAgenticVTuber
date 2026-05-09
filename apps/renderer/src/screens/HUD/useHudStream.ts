import { useCallback, useEffect, useRef, useState } from 'react'
import type { HudMessageC2S } from '@contracts/hud-message-c2s'
import type { HudMessageS2C } from '@contracts/hud-message-s2c'

export type HudConnectionState = 'connecting' | 'connected' | 'reconnecting'

interface HudStreamState {
  paramValues: Record<string, number>
  lockedIds: Set<string>
  optimisticLockedIds: Set<string>
  animatingIds: Set<string>
  connectionState: HudConnectionState
  sendSetLock: (paramId: string, value: number) => void
  sendClearLock: (paramId: string) => void
}

const RECONNECT_MS = 1500

function httpBaseFromReadyUrl(url: string): string {
  const parsed = new URL(url)
  parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:'
  if (parsed.pathname.endsWith('/ws')) parsed.pathname = parsed.pathname.slice(0, -3)
  return parsed.toString().replace(/\/$/, '')
}

function wsBaseFromReadyUrl(url: string): string {
  const parsed = new URL(url)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  if (parsed.pathname.endsWith('/ws')) parsed.pathname = parsed.pathname.slice(0, -3)
  return parsed.toString().replace(/\/$/, '')
}

async function resolveReadyUrl(): Promise<string | null> {
  const readyUrl = await window.api?.getReadyUrl?.()
  if (readyUrl) return readyUrl
  return new Promise((resolve) => {
    const off = window.api?.onSidecarReady?.((url) => {
      off?.()
      resolve(url)
    })
    if (!off) resolve(null)
  })
}

export async function getHudHttpBase(): Promise<string | null> {
  const readyUrl = await resolveReadyUrl()
  return readyUrl ? httpBaseFromReadyUrl(readyUrl) : null
}

export function useHudStream(onLocksCleared?: () => void, onReconnect?: () => void): HudStreamState {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const bufferedRef = useRef<Map<string, HudMessageC2S>>(new Map())
  const hadServerLocksRef = useRef(false)
  const wasReconnectingRef = useRef(false)
  const previousValuesRef = useRef<Record<string, number>>({})
  const [paramValues, setParamValues] = useState<Record<string, number>>({})
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set())
  const [optimisticLockedIds, setOptimisticLockedIds] = useState<Set<string>>(new Set())
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
  const [connectionState, setConnectionState] = useState<HudConnectionState>('connecting')

  const flushBuffered = useCallback((socket: WebSocket) => {
    for (const msg of bufferedRef.current.values()) {
      socket.send(JSON.stringify(msg))
    }
    bufferedRef.current.clear()
  }, [])

  const queueOrSend = useCallback((msg: HudMessageC2S) => {
    const key = msg.kind === 'set-lock' ? msg.param_id : `${msg.param_id}:clear`
    const socket = socketRef.current
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(msg))
      return
    }
    bufferedRef.current.set(key, msg)
  }, [])

  const sendSetLock = useCallback(
    (paramId: string, value: number) => {
      setOptimisticLockedIds((prev) => new Set(prev).add(paramId))
      queueOrSend({ kind: 'set-lock', param_id: paramId, value })
    },
    [queueOrSend]
  )

  const sendClearLock = useCallback(
    (paramId: string) => {
      setOptimisticLockedIds((prev) => {
        const next = new Set(prev)
        next.delete(paramId)
        return next
      })
      setLockedIds((prev) => {
        const next = new Set(prev)
        next.delete(paramId)
        return next
      })
      queueOrSend({ kind: 'clear-lock', param_id: paramId })
    },
    [queueOrSend]
  )

  useEffect(() => {
    let disposed = false

    const connect = async () => {
      const readyUrl = await resolveReadyUrl()
      if (disposed || !readyUrl) return
      const socket = new WebSocket(`${wsBaseFromReadyUrl(readyUrl)}/hud/ws`)
      socketRef.current = socket

      socket.onopen = () => {
        if (disposed) return
        setConnectionState('connected')
        flushBuffered(socket)
        if (wasReconnectingRef.current) onReconnect?.()
        wasReconnectingRef.current = false
      }

      socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as HudMessageS2C
        if (msg.kind === 'param-frame') {
          setParamValues(msg.params)
          setAnimatingIds(() => {
            const next = new Set<string>()
            const prev = previousValuesRef.current
            for (const [paramId, value] of Object.entries(msg.params)) {
              if (Math.abs((prev[paramId] ?? value) - value) > 0.01) next.add(paramId)
            }
            previousValuesRef.current = msg.params
            return next
          })

          const nextLocked = new Set(msg.locked_ids)
          if (hadServerLocksRef.current && nextLocked.size === 0) {
            onLocksCleared?.()
          }
          hadServerLocksRef.current = nextLocked.size > 0
          setLockedIds(nextLocked)
          setOptimisticLockedIds((prev) => {
            const next = new Set(prev)
            for (const paramId of msg.locked_ids) next.add(paramId)
            if (msg.locked_ids.length === 0) next.clear()
            return next
          })
        }
      }

      socket.onclose = () => {
        if (disposed) return
        setConnectionState('reconnecting')
        wasReconnectingRef.current = true
        socketRef.current = null
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_MS)
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    void connect()

    return () => {
      disposed = true
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [flushBuffered, onLocksCleared, onReconnect])

  return {
    paramValues,
    lockedIds,
    optimisticLockedIds,
    animatingIds,
    connectionState,
    sendSetLock,
    sendClearLock
  }
}
