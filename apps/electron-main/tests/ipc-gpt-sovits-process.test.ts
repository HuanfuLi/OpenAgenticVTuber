import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type {
  GptSoVitsProcessRequest,
  GptSoVitsProcessStatus
} from '../src/gpt-sovits-process'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  removedHandlers: [] as string[],
  startGptSoVitsProcess: vi.fn(),
  getGptSoVitsProcessStatus: vi.fn(),
  stopGptSoVitsProcess: vi.fn(),
  restartGptSoVitsProcess: vi.fn(),
  onReady: vi.fn(() => vi.fn()),
  onCrash: vi.fn(() => vi.fn()),
  onLog: vi.fn(() => vi.fn())
}))

vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn(() => process.cwd()),
    getPath: vi.fn(() => 'C:\\AgenticLLMVTuberTest')
  },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      mocks.removedHandlers.push(channel)
      mocks.handlers.delete(channel)
    })
  },
  safeStorage: {
    decryptString: vi.fn((buf: Buffer) => buf.toString('utf8')),
    encryptString: vi.fn((text: string) => Buffer.from(text)),
    isEncryptionAvailable: vi.fn(() => true)
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../src/sidecar', () => ({
  getReadyUrl: vi.fn(() => 'ws://127.0.0.1:8765/ws'),
  getSidecarHttpUrl: vi.fn(() => 'http://127.0.0.1:8765'),
  onReady: mocks.onReady,
  onCrash: mocks.onCrash,
  onLog: mocks.onLog,
  listBodyMotionPlugins: vi.fn(() => []),
  restartSidecar: vi.fn().mockResolvedValue(undefined),
  resetVtsAuthToken: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../src/gpt-sovits-process', () => ({
  startGptSoVitsProcess: mocks.startGptSoVitsProcess,
  getGptSoVitsProcessStatus: mocks.getGptSoVitsProcessStatus,
  stopGptSoVitsProcess: mocks.stopGptSoVitsProcess,
  restartGptSoVitsProcess: mocks.restartGptSoVitsProcess
}))

vi.mock('../src/window-store', () => ({
  getChromeState: vi.fn(() => ({ mode: 'normal' })),
  getLogLevel: vi.fn(() => 'info'),
  getThemePreference: vi.fn(() => null),
  resolveCurrentAvatarId: vi.fn(() => 'teto'),
  saveChromeState: vi.fn((patch) => patch),
  saveLogLevel: vi.fn((level) => level),
  saveThemePreference: vi.fn().mockResolvedValue(undefined),
  store: { get: vi.fn(), set: vi.fn() }
}))

vi.mock('../src/hud-window', () => ({ createHudWindow: vi.fn() }))
vi.mock('../src/conversation-store', () => ({
  clearConversationHistory: vi.fn(),
  commitConversationTurn: vi.fn(),
  createConversationSession: vi.fn(),
  deleteConversationSession: vi.fn(),
  getActiveConversationSession: vi.fn(),
  getConversationStats: vi.fn(),
  listConversationSessions: vi.fn(),
  renameConversationSession: vi.fn(),
  selectConversationSession: vi.fn()
}))

import { registerIpc } from '../src/ipc'

function installHandlers(): () => void {
  return registerIpc({ isDestroyed: vi.fn(() => false), webContents: { send: vi.fn() } } as never)
}

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const handler = mocks.handlers.get(channel)
  expect(handler).toBeDefined()
  return (await handler?.({}, payload)) as T
}

describe('GPT-SoVITS process IPC handlers', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.removedHandlers.length = 0
    vi.restoreAllMocks()
  })

  it('exposes start/status/stop/restart channels with typed request and status payloads', async () => {
    installHandlers()
    const request: GptSoVitsProcessRequest = {
      command: 'uv run python api_v2.py',
      workingDirectory: 'C:/gpt-sovits',
      healthUrl: 'http://127.0.0.1:9880/docs'
    }
    const running: GptSoVitsProcessStatus = {
      mode: 'app_managed',
      appManaged: true,
      pid: 1234,
      state: 'running',
      summary: 'App-launched GPT-SoVITS is running.',
      healthUrl: request.healthUrl,
      diagnostics: []
    }
    mocks.startGptSoVitsProcess.mockResolvedValue(running)
    mocks.getGptSoVitsProcessStatus.mockReturnValue(running)

    await expect(invoke<GptSoVitsProcessStatus>('gptSovits:start', request)).resolves.toEqual(running)
    await expect(invoke<GptSoVitsProcessStatus>('gptSovits:status')).resolves.toEqual(running)
    expect(mocks.startGptSoVitsProcess).toHaveBeenCalledWith(request)
  })

  it('returns concise not-app-managed status for external stop/restart attempts', async () => {
    installHandlers()
    const external: GptSoVitsProcessStatus = {
      mode: 'external',
      appManaged: false,
      pid: null,
      state: 'not_app_managed',
      summary: 'No app-launched GPT-SoVITS process is running.',
      diagnostics: []
    }
    mocks.stopGptSoVitsProcess.mockResolvedValue(external)
    mocks.restartGptSoVitsProcess.mockResolvedValue(external)

    await expect(invoke<GptSoVitsProcessStatus>('gptSovits:stop')).resolves.toEqual(external)
    await expect(invoke<GptSoVitsProcessStatus>('gptSovits:restart')).resolves.toEqual(external)
    expect(external.appManaged).toBe(false)
    expect(external.summary).not.toMatch(/kill|port|process name/i)
  })

  it('unregisters all process lifecycle handlers during IPC cleanup', () => {
    const cleanup = installHandlers()

    cleanup()

    expect(mocks.removedHandlers).toEqual(expect.arrayContaining([
      'gptSovits:start',
      'gptSovits:status',
      'gptSovits:stop',
      'gptSovits:restart'
    ]))
  })
})

describe('GPT-SoVITS process preload declarations', () => {
  it('allowlists process lifecycle methods and declaration types', () => {
    const preloadSource = fs.readFileSync(path.join(process.cwd(), 'preload/index.ts'), 'utf-8')
    const declarationSource = fs.readFileSync(path.join(process.cwd(), 'preload/index.d.ts'), 'utf-8')

    expect(preloadSource).toContain('startGptSoVits')
    expect(preloadSource).toContain("ipcRenderer.invoke('gptSovits:start'")
    expect(preloadSource).toContain('getGptSoVitsProcessStatus')
    expect(preloadSource).toContain("ipcRenderer.invoke('gptSovits:status'")
    expect(preloadSource).toContain('stopGptSoVits')
    expect(preloadSource).toContain("ipcRenderer.invoke('gptSovits:stop'")
    expect(preloadSource).toContain('restartGptSoVits')
    expect(preloadSource).toContain("ipcRenderer.invoke('gptSovits:restart'")
    expect(declarationSource).toContain('GptSoVitsProcessRequest')
    expect(declarationSource).toContain('GptSoVitsProcessStatus')
    expect(declarationSource).toContain('startGptSoVits(input: GptSoVitsProcessRequest): Promise<GptSoVitsProcessStatus>')
  })
})
