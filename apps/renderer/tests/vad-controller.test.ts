import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeVadRms,
  VadController,
  vadThresholdForSensitivity
} from '@/audio/vad-controller'

describe('VadController', () => {
  let startRecording: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  let stopRecording: ReturnType<typeof vi.fn<() => Promise<void>>>

  beforeEach(() => {
    startRecording = vi.fn(async () => true)
    stopRecording = vi.fn(async () => undefined)
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
        shouldIgnoreSpeech: () => blocked
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
    await low.processLevelForTests(0.09, 0)
    expect(startRecording).not.toHaveBeenCalled()

    const medium = controller({ sensitivity: 'medium' })
    await medium.processLevelForTests(0.09, 0)
    expect(startRecording).toHaveBeenCalledTimes(1)
  })

  it('blocks auto-recording while the app is speaking', async () => {
    const vad = controller({}, true)

    await vad.processLevelForTests(0.2, 0)

    expect(startRecording).not.toHaveBeenCalled()
  })

  it('does not expose wake-word behavior', () => {
    const vad = controller()

    expect('wakeWord' in vad).toBe(false)
    expect('wake_word' in vad).toBe(false)
  })
})
