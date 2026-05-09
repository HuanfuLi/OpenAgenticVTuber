import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resetGptSoVitsProcessManagerForTests,
  getGptSoVitsProcessStatus,
  isAppManagedGptSoVitsRunning,
  restartGptSoVitsProcess,
  startGptSoVitsProcess,
  stopGptSoVitsProcess,
  type GptSoVitsSpawnedChild
} from '../src/gpt-sovits-process'

class FakeChild extends EventEmitter implements GptSoVitsSpawnedChild {
  pid = 4242
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill = vi.fn(() => {
    this.exitCode = 0
    this.emit('exit', 0)
    return true
  })
}

describe('app-owned GPT-SoVITS process manager', () => {
  let cwd: string
  let spawned: FakeChild[]
  let spawnImpl: ReturnType<typeof vi.fn>
  let killTreeImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    cwd = mkdtempSync(path.join(tmpdir(), 'avt-gpt-sovits-'))
    spawned = []
    spawnImpl = vi.fn(() => {
      const child = new FakeChild()
      spawned.push(child)
      return child
    })
    killTreeImpl = vi.fn(async (child: GptSoVitsSpawnedChild) => {
      child.kill()
    })
    resetGptSoVitsProcessManagerForTests({ spawnImpl, killTreeImpl, platform: 'win32' })
  })

  afterEach(() => {
    resetGptSoVitsProcessManagerForTests()
    rmSync(cwd, { recursive: true, force: true })
  })

  it('spawns exactly the user-supplied command in the supplied working directory', async () => {
    const status = await startGptSoVitsProcess({
      command: 'uv run python api_v2.py --port 9880',
      workingDirectory: cwd,
      healthUrl: 'http://127.0.0.1:9880/docs'
    })

    expect(status).toMatchObject({ mode: 'app_managed', appManaged: true, state: 'running', pid: 4242 })
    expect(spawnImpl).toHaveBeenCalledTimes(1)
    expect(spawnImpl).toHaveBeenCalledWith('uv run python api_v2.py --port 9880', [], {
      cwd,
      env: process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
  })

  it('returns typed misconfigured status for missing command or non-directory cwd', async () => {
    await expect(startGptSoVitsProcess({ command: '   ', workingDirectory: cwd })).resolves.toMatchObject({
      appManaged: false,
      state: 'misconfigured',
      summary: 'GPT-SoVITS launch command is required.'
    })

    await expect(
      startGptSoVitsProcess({ command: 'uv run python api_v2.py', workingDirectory: path.join(cwd, 'missing') })
    ).resolves.toMatchObject({
      appManaged: false,
      state: 'misconfigured',
      summary: 'GPT-SoVITS working directory must exist and be a directory.'
    })
    expect(spawnImpl).not.toHaveBeenCalled()
  })

  it('stops only the tracked app-owned process tree', async () => {
    await startGptSoVitsProcess({ command: 'node server.js', workingDirectory: cwd })

    const stopped = await stopGptSoVitsProcess()

    expect(killTreeImpl).toHaveBeenCalledTimes(1)
    expect(killTreeImpl).toHaveBeenCalledWith(spawned[0])
    expect(stopped).toMatchObject({ appManaged: false, state: 'stopped', summary: 'App-launched GPT-SoVITS stopped.' })
  })

  it('does not kill by port/name/base URL when no app-owned process is tracked', async () => {
    await expect(stopGptSoVitsProcess()).resolves.toMatchObject({
      mode: 'external',
      appManaged: false,
      state: 'not_app_managed',
      summary: 'No app-launched GPT-SoVITS process is running.'
    })
    expect(killTreeImpl).not.toHaveBeenCalled()
    expect(isAppManagedGptSoVitsRunning()).toBe(false)
    expect(getGptSoVitsProcessStatus()).toMatchObject({ state: 'not_app_managed' })
  })

  it('restarts by stopping the tracked app-owned process then relaunching the last user command', async () => {
    await startGptSoVitsProcess({ command: 'node server.js', workingDirectory: cwd })

    const status = await restartGptSoVitsProcess()

    expect(killTreeImpl).toHaveBeenCalledTimes(1)
    expect(spawnImpl).toHaveBeenCalledTimes(2)
    expect(status).toMatchObject({ appManaged: true, state: 'running', pid: 4242 })
  })
})
