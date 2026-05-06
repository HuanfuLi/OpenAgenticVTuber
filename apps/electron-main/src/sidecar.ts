// Electron-main sidecar supervisor: spawn `uv run python -m sidecar`, parse the
// READY line, run a crash circuit-breaker (CONTEXT.md "Claude's Discretion"),
// expose typed subscribe APIs for the IPC bridge.
//
// Pitfall references (RESEARCH.md): 11 (orphan port via PYTHONUNBUFFERED), 12
// (spawn-inside-whenReady, not at module top), 13 (mute crash → forward stderr
// to renderer's logs drawer), port:0-race (READY before accept loop is the
// sidecar's responsibility — see sidecar/src/sidecar/main.py).

import { spawn, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import * as path from 'node:path'

const READY_RE = /^\[READY\] (ws:\/\/127\.0\.0\.1:(\d+)\/ws)$/
const READY_TIMEOUT_MS = 10_000
const CRASH_WINDOW_MS = 30_000
const CRASH_RESPAWN_LIMIT = 3 // 3rd crash within 30s -> permanent banner

export interface SidecarHandle {
  child: ChildProcess
  wsUrl: string
  port: number
}

interface SidecarSupervisorState {
  handle: SidecarHandle | null
  crashTimestamps: number[]
  readyUrl: string | null
  respawnDisabled: boolean
}

const state: SidecarSupervisorState = {
  handle: null,
  crashTimestamps: [],
  readyUrl: null,
  respawnDisabled: false
}

const subscribers = {
  ready: new Set<(url: string) => void>(),
  crash: new Set<(info: { code: number; willRespawn: boolean }) => void>(),
  log: new Set<(line: string) => void>()
}

function resolveSidecarRoot(): string {
  // Dev layout (running via electron-vite dev): app.getAppPath() resolves to
  //   <repo>/apps/electron-main
  // → ../../sidecar gives <repo>/sidecar.
  // Packaged layout (Phase 5 concern; not in 01-01 scope): the sidecar is
  // bundled under resources/ — branch added later.
  return path.resolve(app.getAppPath(), '..', '..', 'sidecar')
}

export async function spawnSidecar(): Promise<SidecarHandle> {
  if (state.handle) return state.handle
  if (state.respawnDisabled) {
    throw new Error('Sidecar auto-respawn disabled (3 crashes within 30s)')
  }

  const sidecarRoot = resolveSidecarRoot()
  const child = spawn('uv', ['run', 'python', '-m', 'sidecar'], {
    cwd: sidecarRoot,
    // PYTHONUNBUFFERED=1 is critical — without this, Python may line-buffer
    // stdout in pipe mode and the READY-line parser hangs indefinitely.
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    // shell=true on Windows so PATHEXT lookup finds uv.cmd.
    shell: process.platform === 'win32'
  })

  return new Promise<SidecarHandle>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Sidecar did not emit [READY] within ${READY_TIMEOUT_MS}ms`))
    }, READY_TIMEOUT_MS)

    let resolved = false

    const onLine = (line: string): void => {
      for (const cb of subscribers.log) cb(line)
      const m = line.trim().match(READY_RE)
      if (m && !resolved) {
        resolved = true
        clearTimeout(timer)
        const handle: SidecarHandle = { child, wsUrl: m[1]!, port: Number(m[2]!) }
        state.handle = handle
        state.readyUrl = m[1]!
        for (const cb of subscribers.ready) cb(m[1]!)
        resolve(handle)
      }
    }

    let stdoutBuf = ''
    child.stdout!.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8')
      let idx: number
      while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, idx)
        stdoutBuf = stdoutBuf.slice(idx + 1)
        onLine(line)
      }
    })
    child.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      for (const line of text.split('\n')) {
        if (line) for (const cb of subscribers.log) cb(`[stderr] ${line}`)
      }
    })

    child.on('exit', (code) => {
      clearTimeout(timer)
      state.handle = null
      state.readyUrl = null
      if (!resolved) {
        reject(new Error(`Sidecar exited (code=${code}) before emitting [READY]`))
        return
      }
      // Crash mid-session — apply circuit breaker (CONTEXT.md "Claude's Discretion").
      const now = Date.now()
      state.crashTimestamps = [...state.crashTimestamps, now].filter(
        (t) => now - t < CRASH_WINDOW_MS
      )
      const willRespawn =
        state.crashTimestamps.length < CRASH_RESPAWN_LIMIT && !app.isQuitting
      for (const cb of subscribers.crash) cb({ code: code ?? -1, willRespawn })
      if (willRespawn && !app.isQuitting) {
        setTimeout(() => {
          spawnSidecar().catch(() => {
            /* surfaced via crash subscriber */
          })
        }, 1_000)
      } else {
        state.respawnDisabled = true
      }
    })
  })
}

export function getReadyUrl(): string | null {
  return state.readyUrl
}

export function onReady(cb: (url: string) => void): () => void {
  subscribers.ready.add(cb)
  return () => {
    subscribers.ready.delete(cb)
  }
}

export function onCrash(
  cb: (info: { code: number; willRespawn: boolean }) => void
): () => void {
  subscribers.crash.add(cb)
  return () => {
    subscribers.crash.delete(cb)
  }
}

export function onLog(cb: (line: string) => void): () => void {
  subscribers.log.add(cb)
  return () => {
    subscribers.log.delete(cb)
  }
}

export async function shutdownSidecar(softTimeoutMs = 5_000): Promise<void> {
  const handle = state.handle
  if (!handle) return
  // Plan 01-02 will replace this with a WS shutdown handshake. For 01-01 we
  // hard-kill — there's no WS connection yet to send `{type: "shutdown"}` over.
  handle.child.kill()
  await new Promise<void>((res) => {
    const t = setTimeout(() => res(), softTimeoutMs)
    handle.child.on('exit', () => {
      clearTimeout(t)
      res()
    })
  })
}
