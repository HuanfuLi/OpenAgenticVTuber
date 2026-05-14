import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeVadRms,
  type VadLevelDiagnostics,
  VadController,
  vadThresholdForSensitivity
} from '@/audio/vad-controller'
import type { AecDiagnosticSnapshot } from '@/audio/aec-diagnostics'

describe('VadController', () => {
  let startRecording: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  let stopRecording: ReturnType<typeof vi.fn<() => Promise<void>>>
  let onLevel: ReturnType<typeof vi.fn<(diagnostics: VadLevelDiagnostics) => void>>
  let onAecDiagnostics: ReturnType<typeof vi.fn<(diagnostics: AecDiagnosticSnapshot) => void>>
  let onError: ReturnType<typeof vi.fn<(message: string) => void>>

  beforeEach(() => {
    startRecording = vi.fn(async () => true)
    stopRecording = vi.fn(async () => undefined)
    onLevel = vi.fn()
    onAecDiagnostics = vi.fn()
    onError = vi.fn()
  })

  function controller(
    patch: Partial<ConstructorParameters<typeof VadController>[0]> = {},
    blocked = false
  ): VadController {
    return new VadController(
      {
        sensitivity: 'low',
        silenceTimeoutMs: 1800,
        ...patch
      },
      {
        startRecording,
        stopRecording,
        isRecording: () => false,
        shouldIgnoreSpeech: () => blocked,
        onLevel,
        onError
      }
    )
  }

  it('uses conservative sensitivity thresholds by default', () => {
    expect(vadThresholdForSensitivity('low')).toBeGreaterThan(vadThresholdForSensitivity('medium'))
    expect(vadThresholdForSensitivity('medium')).toBeGreaterThan(vadThresholdForSensitivity('high'))
  })

  it('computes RMS from byte time-domain samples', () => {
    expect(computeVadRms(new Uint8Array([128, 128, 128]))).toBe(0)
    expect(computeVadRms(new Uint8Array([128, 255, 1]))).toBeGreaterThan(0.5)
  })

  it('starts recording when speech crosses the configured threshold', async () => {
    const vad = controller()

    await vad.processLevelForTests(vadThresholdForSensitivity('low') + 0.01, 0)

    expect(startRecording).toHaveBeenCalledTimes(1)
    expect(stopRecording).not.toHaveBeenCalled()
    expect(onLevel).toHaveBeenLastCalledWith(expect.objectContaining({
      speechDetected: true,
      threshold: vadThresholdForSensitivity('low'),
      ignoredReason: null
    }))
  })

  it('finalizes after the configured silence timeout', async () => {
    const vad = controller({ silenceTimeoutMs: 1500 })

    await vad.processLevelForTests(vadThresholdForSensitivity('low') + 0.01, 100)
    await vad.processLevelForTests(0, 1499)
    expect(stopRecording).not.toHaveBeenCalled()

    await vad.processLevelForTests(0, 1600)
    expect(stopRecording).toHaveBeenCalledTimes(1)
  })

  it('sensitivity changes affect whether a level starts capture', async () => {
    const low = controller({ sensitivity: 'low' })
    await low.processLevelForTests(0.03, 0)
    expect(startRecording).not.toHaveBeenCalled()

    const medium = controller({ sensitivity: 'medium' })
    await medium.processLevelForTests(0.03, 0)
    expect(startRecording).toHaveBeenCalledTimes(1)
  })

  it('reports below-threshold diagnostics without starting capture', async () => {
    const vad = controller({ sensitivity: 'low' })

    await vad.processLevelForTests(vadThresholdForSensitivity('low') - 0.005, 0)

    expect(startRecording).not.toHaveBeenCalled()
    expect(onLevel).toHaveBeenLastCalledWith(expect.objectContaining({
      speechDetected: false,
      level: vadThresholdForSensitivity('low') - 0.005,
      sensitivity: 'low'
    }))
  })

  it('blocks auto-recording while the app is speaking', async () => {
    const vad = controller({}, true)

    await vad.processLevelForTests(0.2, 0)

    expect(startRecording).not.toHaveBeenCalled()
    expect(onLevel).toHaveBeenLastCalledWith(expect.objectContaining({
      speechDetected: true,
      ignoredReason: 'turn_in_progress'
    }))
  })

  it('does not expose wake-word behavior', () => {
    const vad = controller()

    expect('wakeWord' in vad).toBe(false)
    expect('wake_word' in vad).toBe(false)
  })

  it('uses selected microphone constraints for monitoring', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({
      getAudioTracks: () => [{
        kind: 'audio',
        stop: vi.fn(),
        getSettings: () => ({ echoCancellation: true, deviceId: 'secret-device-id' }),
        getConstraints: () => ({ echoCancellation: { ideal: true }, deviceId: { exact: 'secret-device-id' } })
      }],
      getTracks: () => []
    })
    const createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }))
    const createAnalyser = vi.fn(() => ({
      fftSize: 0,
      getByteTimeDomainData: vi.fn()
    }))
    class FakeAudioContext {
      createMediaStreamSource = createMediaStreamSource
      createAnalyser = createAnalyser
      close = vi.fn()
    }
    const vad = new VadController(
      {
        sensitivity: 'low',
        silenceTimeoutMs: 1800,
        microphone: {
          deviceId: 'mic-physical-1',
          label: 'USB Microphone',
          suspectedSystemAudio: false
        }
      },
      {
        mediaDevices: { getUserMedia } as unknown as MediaDevices,
        AudioContextCtor: FakeAudioContext as unknown as new () => AudioContext,
        requestAnimationFrame: vi.fn(() => 1),
        cancelAnimationFrame: vi.fn(),
        startRecording,
        stopRecording,
        isRecording: () => false,
        onAecDiagnostics,
        onLevel,
        onError
      }
    )

    await vad.start()

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        deviceId: { exact: 'mic-physical-1' },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true }
      })
    })
    expect(onAecDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      source: 'vad',
      selectedInput: expect.objectContaining({
        label: 'USB Microphone',
        deviceIdPresent: true
      }),
      applied: expect.objectContaining({
        echoCancellation: true,
        deviceIdPresent: true
      })
    }))
  })

  it('reports selected microphone availability errors without default fallback', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('missing mic', 'OverconstrainedError'))
    class FakeAudioContext {
      close = vi.fn()
    }
    const vad = new VadController(
      {
        sensitivity: 'low',
        silenceTimeoutMs: 1800,
        microphone: {
          deviceId: 'missing-mic',
          label: 'USB Microphone',
          suspectedSystemAudio: false
        }
      },
      {
        mediaDevices: { getUserMedia } as unknown as MediaDevices,
        AudioContextCtor: FakeAudioContext as unknown as new () => AudioContext,
        startRecording,
        stopRecording,
        isRecording: () => false,
        onError
      }
    )

    await vad.start()

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('Selected microphone input is unavailable. Choose another microphone in Settings.')
  })
})
