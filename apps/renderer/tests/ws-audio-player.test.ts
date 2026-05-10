import { describe, it, expect, beforeEach, vi } from 'vitest'
import { playAudioPayload, resetAudioPlaybackQueueForTests } from '@/ws/audio-player'

class MockAudioElement {
  src: string
  listeners = new Map<string, Array<() => void>>()
  play = vi.fn(() => nextPlayResult)

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

  it('plays a non-empty base64 WAV payload through browser audio', () => {
    playAudioPayload(btoa('RIFF-wav-bytes'))

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(mockAudioElements).toHaveLength(1)
    expect(mockAudioElements[0]!.src).toBe('blob:audio-1')
    expect(mockAudioElements[0]!.play).toHaveBeenCalledTimes(1)
  })

  it('revokes object URLs when playback ends or errors', () => {
    playAudioPayload(btoa('RIFF-wav-bytes'))
    mockAudioElements[0]!.emit('ended')
    mockAudioElements[0]!.emit('error')

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
  })

  it('queues payloads so sentence audio does not overlap', () => {
    playAudioPayload(btoa('RIFF-first'))
    playAudioPayload(btoa('RIFF-second'))

    expect(mockAudioElements).toHaveLength(1)
    expect(mockAudioElements[0]!.play).toHaveBeenCalledTimes(1)

    mockAudioElements[0]!.emit('ended')

    expect(mockAudioElements).toHaveLength(2)
    expect(mockAudioElements[1]!.src).toBe('blob:audio-2')
    expect(mockAudioElements[1]!.play).toHaveBeenCalledTimes(1)
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

    await Promise.resolve()

    expect(console.warn).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
  })
})
