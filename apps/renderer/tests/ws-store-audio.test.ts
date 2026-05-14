import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WSMessage } from '@contracts/ws-message'

const wsClientMock = vi.hoisted(() => ({
  listener: null as ((msg: WSMessage) => void) | null,
  reconnectListener: null as ((url: string, previousUrl: string | null) => void) | null
}))

const playAudioPayloadMock = vi.hoisted(() => vi.fn())
const stopAudioPlaybackMock = vi.hoisted(() => vi.fn())
const audioPlaybackMock = vi.hoisted(() => ({
  active: false,
  listener: null as ((state: { active: boolean }) => void) | null
}))

vi.mock('@/ws/client', () => ({
  subscribe: vi.fn((listener: (msg: WSMessage) => void) => {
    wsClientMock.listener = listener
    return () => undefined
  }),
  subscribeSidecarReconnect: vi.fn(
    (listener: (url: string, previousUrl: string | null) => void) => {
      wsClientMock.reconnectListener = listener
      return () => undefined
    }
  ),
  subscribeState: vi.fn(() => () => undefined)
}))

vi.mock('@/ws/audio-player', () => ({
  playAudioPayload: playAudioPayloadMock,
  stopAudioPlayback: stopAudioPlaybackMock,
  getAudioPlaybackState: vi.fn(() => ({ active: audioPlaybackMock.active })),
  subscribeAudioPlaybackState: vi.fn((listener: (state: { active: boolean }) => void) => {
    audioPlaybackMock.listener = listener
    listener({ active: audioPlaybackMock.active })
    return () => undefined
  })
}))

vi.mock('@/state/conversation-history', () => ({
  commitConversationTurnFromDispatcher: vi.fn()
}))

import { _internalState, resetStreaming } from '@/screens/Chat/useStreamingMessages'

async function loadDispatcher(): Promise<(msg: WSMessage) => void> {
  await import('@/ws/store')
  if (!wsClientMock.listener) throw new Error('WS dispatcher did not subscribe')
  return wsClientMock.listener
}

function audioMessage(audio: string | null): WSMessage {
  return {
    type: 'audio',
    audio,
    failed_audio: null,
    dispatches: [],
    display_text: {
      avatar: 'Teto',
      name: '',
      text: audio ? 'First sentence.' : ''
    },
    forwarded: false,
    sentence_id: 1,
    slice_length: 20,
    volumes: audio ? [0.1, 0.2] : []
  }
}

describe('WS audio dispatcher playback', () => {
  beforeEach(() => {
    resetStreaming()
    playAudioPayloadMock.mockClear()
    audioPlaybackMock.active = false
  })

  it('plays non-silent audio payloads while preserving chat state updates', async () => {
    const dispatch = await loadDispatcher()

    dispatch(audioMessage('UklGRg=='))

    expect(playAudioPayloadMock).toHaveBeenCalledTimes(1)
    expect(playAudioPayloadMock).toHaveBeenCalledWith('UklGRg==')
    expect(_internalState().messages).toMatchObject([
      { role: 'assistant', text: 'First sentence.' }
    ])
    expect(_internalState().isSpeaking).toBe(true)
  })

  it('keeps speaking true at chain end while renderer audio is still playing', async () => {
    const dispatch = await loadDispatcher()

    dispatch(audioMessage('UklGRg=='))
    audioPlaybackMock.active = true
    audioPlaybackMock.listener?.({ active: true })

    dispatch({ type: 'control', text: 'conversation-chain-end' })

    expect(_internalState().isSpeaking).toBe(true)

    audioPlaybackMock.active = false
    audioPlaybackMock.listener?.({ active: false })
    expect(_internalState().isSpeaking).toBe(false)
  })

  it('does not play silent action-only audio envelopes', async () => {
    const dispatch = await loadDispatcher()

    dispatch(audioMessage(null))

    expect(playAudioPayloadMock).not.toHaveBeenCalled()
    expect(_internalState().messages).toMatchObject([{ role: 'assistant', text: '' }])
    expect(_internalState().isSpeaking).toBe(true)
  })
})
