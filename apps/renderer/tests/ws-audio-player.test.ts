import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAudioPlaybackState,
  playAudioPayload,
  resetAudioPlaybackQueueForTests,
  stopAudioPlayback,
  subscribeAudioPlaybackState
} from '@/ws/audio-player'
import { saveVoiceOutputSettings } from '@/state/audio-settings'

class MockAudioElement {
  src: string
  listeners = new Map<string, Array<() => void>>()
  play = vi.fn(() => nextPlayResult)
  pause = vi.fn()
  load = vi.fn()
  removeAttribute = vi.fn()
  setSinkId = vi.fn(() => Promise.resolve())

  constructor(src: string) {
    this.src = src
    mockAudioElements.push(this)
  }

  addEventListener(eventName: string, listener: EventListenerOrEventListenerObject): void {
    const fn =
      typeof listener === 'function'
        ? () => listener(new Event(eventName))
        : () => listener.handleEvent(new Event(eventName))
    const listeners = this.listeners.get(eventName) ?? []
    listeners.push(fn)
    this.listeners.set(eventName, listeners)
  }

  removeEventListener(eventName: string): void {
    this.listeners.delete(eventName)
  }

  emit(eventName: string): void {
    for (const listener of this.listeners.get(eventName) ?? []) listener()
  }
}

let mockAudioElements: MockAudioElement[] = []
let objectUrlCounter = 0
let nextPlayResult: Promise<void>

describe('playAudioPayload', () => {
  beforeEach(() => {
    mockAudioElements = []
    objectUrlCounter = 0
    nextPlayResult = Promise.resolve()
    vi.restoreAllMocks()
    resetAudioPlaybackQueueForTests()

    vi.stubGlobal('Audio', MockAudioElement)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      objectUrlCounter += 1
      return `blob:audio-${objectUrlCounter}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  async function flushAudioPlayback(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
  }

  it('plays a non-empty base64 WAV payload through browser audio', async () => {
    playAudioPayload(btoa('RIFF-wav-bytes'))
    await flushAudioPlayback()

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(mockAudioElements).toHaveLength(1)
    expect(mockAudioElements[0]!.src).toBe('blob:audio-1')
    expect(mockAudioElements[0]!.play).toHaveBeenCalledTimes(1)
  })

  it('applies selected renderer audio output sink before playback', async () => {
    saveVoiceOutputSettings({
      outputDeviceId: 'speaker-1',
      outputDeviceLabel: 'Desktop Speakers'
    })

    playAudioPayload(btoa('RIFF-wav-bytes'))
    await flushAudioPlayback()

    expect(mockAudioElements[0]!.setSinkId).toHaveBeenCalledWith('speaker-1')
    expect(mockAudioElements[0]!.play).toHaveBeenCalledTimes(1)
  })

  it('revokes object URLs when playback ends or errors', () => {
    playAudioPayload(btoa('RIFF-wav-bytes'))
    mockAudioElements[0]!.emit('ended')
    mockAudioElements[0]!.emit('error')

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
  })

  it('queues payloads so sentence audio does not overlap', async () => {
    playAudioPayload(btoa('RIFF-first'))
    playAudioPayload(btoa('RIFF-second'))
    await flushAudioPlayback()

    expect(mockAudioElements).toHaveLength(1)
    expect(mockAudioElements[0]!.play).toHaveBeenCalledTimes(1)

    mockAudioElements[0]!.emit('ended')
    await flushAudioPlayback()

    expect(mockAudioElements).toHaveLength(2)
    expect(mockAudioElements[1]!.src).toBe('blob:audio-2')
    expect(mockAudioElements[1]!.play).toHaveBeenCalledTimes(1)
  })

  it('publishes playback lifecycle state until queued audio drains', () => {
    const states: string[] = []
    const unsubscribe = subscribeAudioPlaybackState((state) => {
      states.push(`${state.lastEvent}:${state.active}:${state.queuedCount}:${state.current}`)
    })

    playAudioPayload(btoa('RIFF-first'))
    playAudioPayload(btoa('RIFF-second'))
    expect(getAudioPlaybackState()).toMatchObject({
      active: true,
      queuedCount: 1,
      current: true
    })

    mockAudioElements[0]!.emit('ended')
    expect(getAudioPlaybackState()).toMatchObject({
      active: true,
      current: true
    })

    mockAudioElements[1]!.emit('ended')
    expect(getAudioPlaybackState()).toMatchObject({
      active: false,
      queuedCount: 0,
      current: false,
      lastEvent: 'drained'
    })
    expect(states).toContain('started:true:0:true')
    expect(states).toContain('drained:false:0:false')
    unsubscribe()
  })

  it('stops current playback and drops queued payloads', () => {
    playAudioPayload(btoa('RIFF-first'))
    playAudioPayload(btoa('RIFF-second'))

    stopAudioPlayback()

    expect(mockAudioElements[0]!.pause).toHaveBeenCalledTimes(1)
    expect(mockAudioElements[0]!.removeAttribute).toHaveBeenCalledWith('src')
    expect(mockAudioElements[0]!.load).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')

    mockAudioElements[0]!.emit('ended')
    expect(mockAudioElements).toHaveLength(1)
    expect(getAudioPlaybackState()).toMatchObject({
      active: false,
      lastEvent: 'stopped'
    })
  })

  it('allows repeated stop calls with no active audio', () => {
    stopAudioPlayback()
    stopAudioPlayback()

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('skips null and empty payloads without warning', () => {
    playAudioPayload(null)
    playAudioPayload('')
    playAudioPayload('   ')

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(mockAudioElements).toHaveLength(0)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('catches invalid payloads without throwing into the dispatcher', () => {
    expect(() => playAudioPayload('%%%')).not.toThrow()

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })

  it('logs and cleans up when browser playback rejects', async () => {
    nextPlayResult = Promise.reject(new Error('blocked'))
    playAudioPayload(btoa('RIFF-wav-bytes'))

    await flushAudioPlayback()
    await flushAudioPlayback()

    expect(console.warn).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
  })
})
