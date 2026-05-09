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
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig, type StoredConfig } from './safe-storage'
import { NO_ACTIVE_AVATAR_ID, resolveCurrentAvatarId, store } from './window-store'

const READY_RE = /^\[READY\] (ws:\/\/127\.0\.0\.1:(\d+)\/ws)$/
const READY_TIMEOUT_MS = 10_000
const CRASH_WINDOW_MS = 30_000
const CRASH_RESPAWN_LIMIT = 3 // 3rd crash within 30s -> permanent banner

type SpawnImpl = typeof spawn

export interface SidecarHandle {
  child: ChildProcess
  wsUrl: string
  port: number
}

export interface BodyMotionPluginSummary {
  name: string
  version: string | null
  description: string | null
  source: 'repo' | 'userData'
  path: string
  valid: boolean
  selectable: boolean
  statusSummary?: string
  developerDetails?: string
  manifestApiVersion?: string | null
  isSelected?: boolean
}

interface SidecarSupervisorState {
  handle: SidecarHandle | null
  crashTimestamps: number[]
  readyUrl: string | null
  respawnDisabled: boolean
  intentionalShutdown: boolean
}

const state: SidecarSupervisorState = {
  handle: null,
  crashTimestamps: [],
  readyUrl: null,
  respawnDisabled: false,
  intentionalShutdown: false
}

const subscribers = {
  ready: new Set<(url: string) => void>(),
  crash: new Set<(info: { code: number; willRespawn: boolean }) => void>(),
  log: new Set<(line: string) => void>()
}

// Bridge: Phase 1 stores LLM config in DPAPI-encrypted safeStorage; Phase 2's
// Python sidecar can't decrypt that blob, so we hand it the decrypted JSON via
// AGENTICLLMVTUBER_LLM_CONFIG_JSON in the spawn env (one-shot, never written to
// disk). Returns undefined when setup hasn't been completed — sidecar then
// boots with `orchestrator=None` and the renderer's setup gate keeps the user
// out of the chat screen.
export function buildSidecarConfigEnv(stored: StoredConfig | null): string | undefined {
  if (!stored || !stored.hasCompletedSetup) return undefined
  const p = stored.provider
  return JSON.stringify({
    provider: p.provider,
    endpoint: p.endpointUrl,
    apiKey: p.apiKey,
    model: p.modelName
  })
}

export function buildSidecarAudioConfigEnv(stored: StoredConfig | null): string | undefined {
  if (!stored || !stored.hasCompletedSetup) return undefined
  return JSON.stringify(stored.audio)
}

export function activeBodyMotionPluginName(stored: StoredConfig | null): string {
  const configured = stored?.plugin?.activePluginName?.trim()
  return configured || 'default'
}

export function cursorTrackingEnabled(stored: StoredConfig | null): boolean {
  return stored?.plugin?.cursorTrackingEnabled !== false
}

function parseYamlScalar(text: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`^${escapedKey}:\\s*(?:"([^"]*)"|'([^']*)'|([^#\\r\\n]+))`, 'm'))
  const value = match?.[1] ?? match?.[2] ?? match?.[3]
  return value ? value.trim() : null
}

function readPluginSummary(
  manifestPath: string,
  source: BodyMotionPluginSummary['source']
): BodyMotionPluginSummary {
  const fallbackName = path.basename(path.dirname(manifestPath))
  try {
    const text = fs.readFileSync(manifestPath, 'utf8') as string
    const name = parseYamlScalar(text, 'name') || fallbackName
    const version = parseYamlScalar(text, 'version')
    const entrypoint = parseYamlScalar(text, 'entrypoint')
    const apiVersion = parseYamlScalar(text, 'api_version')
    const problems: string[] = []
    if (!parseYamlScalar(text, 'name')) problems.push('missing name')
    if (!version) problems.push('missing version')
    if (!entrypoint) problems.push('missing entrypoint')
    else if (!entrypoint.includes(':')) problems.push('entrypoint must use path.py:ClassName')
    if (!apiVersion) problems.push('missing api_version')
    else if (apiVersion.split('.')[0] !== '1') problems.push(`unsupported api_version ${apiVersion}`)
    const valid = problems.length === 0
    return {
      name,
      version,
      description: parseYamlScalar(text, 'description'),
      source,
      path: manifestPath,
      valid,
      selectable: true,
      statusSummary: valid ? 'Manifest valid.' : 'Manifest invalid; selecting it will use fallback/null motion.',
      developerDetails: valid ? undefined : problems.join('; '),
      manifestApiVersion: apiVersion
    }
  } catch (err) {
    return {
      name: fallbackName,
      version: null,
      description: null,
      source,
      path: manifestPath,
      valid: false,
      selectable: true,
      statusSummary: 'Manifest could not be read; selecting it will use fallback/null motion.',
      developerDetails: err instanceof Error ? err.message : String(err),
      manifestApiVersion: null
    }
  }
}

function pluginManifestPaths(root: string): string[] {
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'plugin.yaml'))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .sort()
}

export function listBodyMotionPlugins(): BodyMotionPluginSummary[] {
  const repoRoot = path.resolve(app.getAppPath(), '..', '..')
  const repoPluginRoot = path.join(repoRoot, 'plugins')
  const userPluginRoot = path.join(app.getPath('userData'), 'plugins')
  const selected = activeBodyMotionPluginName(loadConfig())
  const discovered = new Map<string, BodyMotionPluginSummary>()

  for (const manifestPath of pluginManifestPaths(repoPluginRoot)) {
    const summary = readPluginSummary(manifestPath, 'repo')
    discovered.set(summary.name, summary)
  }
  for (const manifestPath of pluginManifestPaths(userPluginRoot)) {
    const summary = readPluginSummary(manifestPath, 'userData')
    discovered.set(summary.name, summary)
  }

  return [...discovered.values()]
    .map((plugin) => ({ ...plugin, isSelected: plugin.name === selected }))
    .sort((a, b) => a.name.localeCompare(b.name))
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
  const repoRoot = path.resolve(app.getAppPath(), '..', '..')
  const storedConfig = loadConfig()
  const llmConfigJson = buildSidecarConfigEnv(storedConfig)
  const audioConfigJson = buildSidecarAudioConfigEnv(storedConfig)
  const activePluginName = activeBodyMotionPluginName(storedConfig)
  const cursorTracking = cursorTrackingEnabled(storedConfig)
  const activeAvatarId = resolveCurrentAvatarId(repoRoot) || NO_ACTIVE_AVATAR_ID
  const child = spawn('uv', ['run', 'python', '-m', 'sidecar'], {
    cwd: sidecarRoot,
    env: {
      ...process.env,
      // PYTHONUNBUFFERED=1 is critical — without this, Python may line-buffer
      // stdout in pipe mode and the READY-line parser hangs indefinitely.
      PYTHONUNBUFFERED: '1',
      // Watchdog parent PID. With shell:true on Windows the spawn chain is
      // electron.exe -> cmd.exe -> uv.exe -> python.exe, so Python's getppid()
      // returns uv's PID — uv stays alive as long as python does, making
      // pid_exists() useless for orphan detection. Pass Electron's actual PID
      // explicitly; the watchdog will prefer it over getppid(). Killing
      // Electron via Task Manager then wakes the watchdog within one poll
      // (≤2s), Python os._exit(0)s, uv exits with it, cmd.exe drains.
      AGENTICLLMVTUBER_PARENT_PID: String(process.pid),
      // One-shot LLM config handoff (see buildSidecarConfigEnv above). Omitted
      // when setup is incomplete; sidecar then idles with config-error replies
      // and the renderer setup gate keeps the user out of /chat.
      AGENTICLLMVTUBER_REPO_ROOT: repoRoot,
      AGENTICLLMVTUBER_USER_DATA: app.getPath('userData'),
      AGENTICLLMVTUBER_ACTIVE_PLUGIN: activePluginName,
      AGENTICLLMVTUBER_CURSOR_TRACKING_ENABLED: cursorTracking ? '1' : '0',
      AGENTICLLMVTUBER_ACTIVE_AVATAR: activeAvatarId,
      ...(llmConfigJson ? { AGENTICLLMVTUBER_LLM_CONFIG_JSON: llmConfigJson } : {}),
      ...(audioConfigJson ? { AGENTICLLMVTUBER_AUDIO_CONFIG_JSON: audioConfigJson } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // shell=true on Windows so PATHEXT lookup finds uv.cmd.
    shell: process.platform === 'win32'
  })

  return new Promise<SidecarHandle>((resolve, reject) => {
    const timer = setTimeout(() => {
      void terminateProcessTree(child)
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
      if (state.intentionalShutdown) {
        state.intentionalShutdown = false
        return
      }
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

export function getSidecarHttpUrl(): string {
  if (!state.readyUrl) {
    throw new Error('Sidecar is not ready')
  }
  return state.readyUrl.replace(/^ws:/, 'http:').replace(/\/ws$/, '')
}

export function getVtsTokenPath(): string {
  return path.join(resolveSidecarRoot(), '.vts_token.txt')
}

export async function resetVtsAuthToken(): Promise<void> {
  await fs.promises.rm(getVtsTokenPath(), { force: true })
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

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function runTaskkill(pid: number, spawnImpl: SpawnImpl): Promise<void> {
  return new Promise<void>((resolve) => {
    const killer = spawnImpl('taskkill', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore'
    })
    killer.once('error', () => resolve())
    killer.once('exit', () => resolve())
  })
}

export async function terminateProcessTree(
  child: ChildProcess,
  options: {
    platform?: NodeJS.Platform
    spawnImpl?: SpawnImpl
  } = {}
): Promise<void> {
  const platform = options.platform ?? process.platform
  const spawnImpl = options.spawnImpl ?? spawn
  if (child.exitCode !== null || child.signalCode !== null) return

  if (platform === 'win32' && child.pid) {
    await runTaskkill(child.pid, spawnImpl)
    return
  }

  child.kill()
}

export async function shutdownSidecar(softTimeoutMs = 5_000): Promise<void> {
  const handle = state.handle
  if (!handle) return
  state.intentionalShutdown = true
  const exited = waitForChildExit(handle.child, softTimeoutMs)
  await terminateProcessTree(handle.child)
  await exited
  if (state.handle === handle) {
    state.handle = null
    state.readyUrl = null
  }
  state.intentionalShutdown = false
}

export async function restartSidecar(): Promise<SidecarHandle> {
  await shutdownSidecar()
  state.crashTimestamps = []
  state.respawnDisabled = false
  return spawnSidecar()
}
