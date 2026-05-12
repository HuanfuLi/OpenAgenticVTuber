import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordSettingsTestWav } from '../src/audio/test-recorder'

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  mimeType = 'audio/webm'
  state: RecordingState = 'inactive'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onerror: (() => void) | null = null
  onstop: (() => void) | null = null

  constructor() {
    FakeMediaRecorder.instances.push(this)
  }

  start(): void {
    this.state = 'recording'
  }

  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) } as BlobEvent)
    this.onstop?.()
  }
}

class FakeAudioContext {
  decodeAudioData = vi.fn().mockResolvedValue({
    duration: 0.2,
    sampleRate: 48000,
    length: 9600,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(9600)
  })

  close = vi.fn().mockResolvedValue(undefined)
}

describe('recordSettingsTestWav', () => {
  const stop = vi.fn()
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] })

  beforeEach(() => {
    vi.useFakeTimers()
    FakeMediaRecorder.instances = []
    stop.mockClear()
    getUserMedia.mockClear()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia }
    })
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('records only when called and returns RIFF WAV base64', async () => {
    expect(getUserMedia).not.toHaveBeenCalled()

    const pending = recordSettingsTestWav(100)
    await vi.advanceTimersByTimeAsync(100)
    const result = await pending
    const bytes = Uint8Array.from(atob(result.audioBase64Wav), (char) => char.charCodeAt(0))

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(stop).toHaveBeenCalled()
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
    expect(result.durationMs).toBe(200)
  })
})
