import { spawn } from 'node:child_process'
import fs from 'node:fs'

export type GptSoVitsProcessState =
  | 'running'
  | 'stopped'
  | 'misconfigured'
  | 'not_app_managed'
  | 'failed'

export interface GptSoVitsProcessRequest {
  command: string | null
  workingDirectory: string | null
  healthUrl?: string | null
}

export interface GptSoVitsProcessStatus {
  mode: 'external' | 'app_managed'
  appManaged: boolean
  pid: number | null
  state: GptSoVitsProcessState
  summary: string
  healthUrl?: string | null
  diagnostics?: string[]
}

export interface GptSoVitsSpawnedChild {
  pid?: number
  exitCode: number | null
  signalCode: NodeJS.Signals | null
  stdout?: NodeJS.EventEmitter | null
  stderr?: NodeJS.EventEmitter | null
  kill(signal?: NodeJS.Signals | number): boolean
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this
}

type SpawnImpl = (command: string, args: string[], options: {
  cwd: string
  env: NodeJS.ProcessEnv
  shell: boolean
  stdio: ['ignore', 'pipe', 'pipe']
  windowsHide: boolean
}) => GptSoVitsSpawnedChild

type KillTreeImpl = (child: GptSoVitsSpawnedChild) => Promise<void>

interface ProcessManagerDeps {
  spawnImpl: SpawnImpl
  killTreeImpl: KillTreeImpl
  platform: NodeJS.Platform
}

const MAX_LOG_LINES = 200

let child: GptSoVitsSpawnedChild | null = null
let lastRequest: GptSoVitsProcessRequest | null = null
let logs: string[] = []

async function defaultKillTree(target: GptSoVitsSpawnedChild): Promise<void> {
  if (target.exitCode !== null || target.signalCode !== null) return
  if (deps.platform === 'win32' && target.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(target.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      })
      killer.once('error', () => resolve())
      killer.once('exit', () => resolve())
    })
    return
  }
  target.kill()
}

let deps: ProcessManagerDeps = {
  spawnImpl: spawn as unknown as SpawnImpl,
  killTreeImpl: defaultKillTree,
  platform: process.platform
}

function appendLog(prefix: string, chunk: unknown): void {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
  const next = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${prefix} ${line}`)
  logs = [...logs, ...next].slice(-MAX_LOG_LINES)
}

function isRunning(target: GptSoVitsSpawnedChild | null): target is GptSoVitsSpawnedChild {
  return target !== null && target.exitCode === null && target.signalCode === null
}

function externalStatus(summary = 'No app-launched GPT-SoVITS process is running.'): GptSoVitsProcessStatus {
  return {
    mode: 'external',
    appManaged: false,
    pid: null,
    state: 'not_app_managed',
    summary,
    diagnostics: [...logs]
  }
}

function validateRequest(request: GptSoVitsProcessRequest): GptSoVitsProcessStatus | null {
  if (!request.command?.trim()) {
    return {
      mode: 'app_managed',
      appManaged: false,
      pid: null,
      state: 'misconfigured',
      summary: 'GPT-SoVITS launch command is required.',
      healthUrl: request.healthUrl ?? null,
      diagnostics: [...logs]
    }
  }
  if (!request.workingDirectory || !fs.existsSync(request.workingDirectory) || !fs.statSync(request.workingDirectory).isDirectory()) {
    return {
      mode: 'app_managed',
      appManaged: false,
      pid: null,
      state: 'misconfigured',
      summary: 'GPT-SoVITS working directory must exist and be a directory.',
      healthUrl: request.healthUrl ?? null,
      diagnostics: [...logs]
    }
  }
  return null
}

export async function startGptSoVitsProcess(request: GptSoVitsProcessRequest): Promise<GptSoVitsProcessStatus> {
  const invalid = validateRequest(request)
  if (invalid) return invalid
  if (isRunning(child)) return getGptSoVitsProcessStatus()

  lastRequest = { ...request }
  logs = []
  const nextChild = deps.spawnImpl(request.command!.trim(), [], {
    cwd: request.workingDirectory!,
    env: process.env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  child = nextChild
  nextChild.stdout?.on('data', (chunk: unknown) => appendLog('[gpt-sovits stdout]', chunk))
  nextChild.stderr?.on('data', (chunk: unknown) => appendLog('[gpt-sovits stderr]', chunk))
  nextChild.on('exit', (code, signal) => {
    appendLog('[gpt-sovits exit]', `code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    if (child === nextChild) child = null
  })
  return getGptSoVitsProcessStatus()
}

export function getGptSoVitsProcessStatus(): GptSoVitsProcessStatus {
  if (!isRunning(child)) return externalStatus()
  return {
    mode: 'app_managed',
    appManaged: true,
    pid: child.pid ?? null,
    state: 'running',
    summary: 'App-launched GPT-SoVITS is running.',
    healthUrl: lastRequest?.healthUrl ?? null,
    diagnostics: [...logs]
  }
}

export async function stopGptSoVitsProcess(): Promise<GptSoVitsProcessStatus> {
  const tracked = child
  if (!isRunning(tracked)) return externalStatus()
  await deps.killTreeImpl(tracked)
  if (child === tracked) child = null
  return {
    mode: 'app_managed',
    appManaged: false,
    pid: null,
    state: 'stopped',
    summary: 'App-launched GPT-SoVITS stopped.',
    healthUrl: lastRequest?.healthUrl ?? null,
    diagnostics: [...logs]
  }
}

export async function restartGptSoVitsProcess(request: GptSoVitsProcessRequest | null = null): Promise<GptSoVitsProcessStatus> {
  const nextRequest = request ?? lastRequest
  if (!nextRequest) return externalStatus('No app-launched GPT-SoVITS process is available to restart.')
  if (isRunning(child)) await stopGptSoVitsProcess()
  return startGptSoVitsProcess(nextRequest)
}

export function isAppManagedGptSoVitsRunning(): boolean {
  return isRunning(child)
}

export function resetGptSoVitsProcessManagerForTests(overrides?: Partial<ProcessManagerDeps>): void {
  child = null
  lastRequest = null
  logs = []
  deps = {
    spawnImpl: (overrides?.spawnImpl ?? (spawn as unknown as SpawnImpl)),
    killTreeImpl: overrides?.killTreeImpl ?? defaultKillTree,
    platform: overrides?.platform ?? process.platform
  }
}
