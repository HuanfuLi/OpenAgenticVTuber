import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { WSMessage } from '@contracts/ws-message'

const wsClientMock = vi.hoisted(() => ({
  listener: null as ((msg: WSMessage) => void) | null,
  listeners: new Set<(msg: WSMessage) => void>(),
  reconnectListeners: new Set<(url: string, previousUrl: string | null) => void>(),
  dispatch(msg: WSMessage): void {
    for (const listener of Array.from(this.listeners)) listener(msg)
  },
  reset(): void {
    this.listener = null
    this.listeners.clear()
    this.reconnectListeners.clear()
  }
}))

const playAudioPayloadMock = vi.hoisted(() => vi.fn())

vi.mock('@/ws/client', () => ({
  send: vi.fn(() => true),
  subscribe: vi.fn((listener: (msg: WSMessage) => void) => {
    wsClientMock.listener = listener
    wsClientMock.listeners.add(listener)
    return () => {
      wsClientMock.listeners.delete(listener)
      if (wsClientMock.listener === listener) {
        wsClientMock.listener = wsClientMock.listeners.values().next().value ?? null
      }
    }
  }),
  subscribeSidecarReconnect: vi.fn((listener: (url: string, previousUrl: string | null) => void) => {
    wsClientMock.reconnectListeners.add(listener)
    return () => {
      wsClientMock.reconnectListeners.delete(listener)
    }
  }),
  subscribeState: vi.fn((listener: (open: boolean) => void) => {
    listener(true)
    return () => undefined
  })
}))

vi.mock('@/ws/audio-player', () => ({
  playAudioPayload: playAudioPayloadMock
}))

vi.mock('@/state/conversation-history', async () => {
  const actual = await vi.importActual<typeof import('@/state/conversation-history')>('@/state/conversation-history')
  return {
    ...actual,
    commitConversationTurnFromDispatcher: vi.fn()
  }
})

import { AppStoreProvider } from '@/state/app-store'
import { COPY } from '@/lib/copy'
import { Chat } from '@/screens/Chat/Chat'
import { _internalState, resetStreaming } from '@/screens/Chat/useStreamingMessages'
import type { ConversationSession } from '@preload-types'

type StoreModule = typeof import('@/ws/store')

async function loadDispatcher(): Promise<(msg: WSMessage) => void> {
  const store = await import('@/ws/store')
  store.ensureWSStoreSubscriptions()
  if (!wsClientMock.listener) throw new Error('WS dispatcher did not subscribe')
  return wsClientMock.listener
}

async function loadStore(): Promise<StoreModule> {
  return import('@/ws/store')
}

function normalAudio(text = 'Hello!'): WSMessage {
  return {
    type: 'audio',
    audio: 'UklGRg==',
    dispatches: [],
    display_text: { avatar: 'Teto', name: '', text },
    failed_audio: null,
    forwarded: false,
    sentence_id: 1,
    slice_length: 20,
    volumes: []
  }
}

function failedGptAudio(text = 'The visible sentence.'): WSMessage {
  return {
    type: 'audio',
    audio: null,
    dispatches: [],
    display_text: { avatar: 'Teto', name: '', text },
    failed_audio: {
      provider_id: 'gpt_sovits',
      state: 'external_service_failure',
      summary: 'server returned 500 with private details',
      retryable: true,
      redacted_diagnostics: { log_ref: 'tts-gpt-sovits-1' }
    },
    forwarded: false,
    sentence_id: 7,
    slice_length: 20,
    volumes: []
  }
}

describe('Chat streaming failed-audio surface', () => {
  const session: ConversationSession = {
    id: 's1',
    title: 'New chat',
    titleSource: 'auto',
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
    lastMessageAt: null,
    messages: []
  }

  beforeEach(async () => {
    const store = await import('@/ws/store')
    store.disposeWSStoreSubscriptions()
    resetStreaming()
    playAudioPayloadMock.mockClear()
    wsClientMock.reset()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getStoredConfig: vi.fn().mockResolvedValue(null),
        saveStoredConfig: vi.fn().mockResolvedValue(undefined),
        getReadyUrl: vi.fn().mockResolvedValue('ws://127.0.0.1:54321/ws'),
        getVtsStatus: vi.fn().mockResolvedValue({
          state: 'authenticated',
          detail: 'VTS authenticated.',
          authenticated: true,
          windowDetected: true
        }),
        getChromeState: vi.fn().mockResolvedValue({
          logsDrawerEnabled: false,
          logsDrawerHeight: 200,
          logsDrawerCollapsed: true
        }),
        saveChromeState: vi.fn().mockResolvedValue({}),
        onSidecarReady: vi.fn().mockReturnValue(() => undefined),
        onSidecarCrash: vi.fn().mockReturnValue(() => undefined),
        listConversationSessions: vi.fn().mockResolvedValue([]),
        getActiveConversationSession: vi.fn().mockResolvedValue(session),
        getConversationStats: vi.fn().mockResolvedValue({
          sessionCount: 1,
          messageCount: 0,
          activeSessionId: session.id,
          persistence: 'local'
        }),
        openVtsDocs: vi.fn().mockResolvedValue(undefined),
        restartSidecar: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  describe('UAT Test 6 duplicate dispatcher regression', () => {
    it('keeps one active audio dispatcher when store registration is requested twice', async () => {
      const store = await loadStore()

      store.ensureWSStoreSubscriptions()
      store.ensureWSStoreSubscriptions()

      expect(wsClientMock.listeners.size).toBe(1)
      expect(wsClientMock.reconnectListeners.size).toBe(1)
    })

    it('replaces Thinking exactly once for one audio payload after duplicate registration simulation', async () => {
      const store = await loadStore()
      store.ensureWSStoreSubscriptions()
      store.ensureWSStoreSubscriptions()

      wsClientMock.dispatch({ type: 'control', text: 'conversation-chain-start' })
      wsClientMock.dispatch(normalAudio('Hello!'))

      expect(_internalState().messages).toHaveLength(1)
      expect(_internalState().messages[0]?.text).toBe('Hello!')
      expect(_internalState().messages[0]?.text).not.toBe('Hello!Hello!')
      expect(playAudioPayloadMock).toHaveBeenCalledTimes(1)
    })

    it('records one failed GPT-SoVITS sentence and no audio playback after duplicate registration simulation', async () => {
      const store = await loadStore()
      store.ensureWSStoreSubscriptions()
      store.ensureWSStoreSubscriptions()

      wsClientMock.dispatch(failedGptAudio('Failed but visible once.'))

      expect(_internalState().messages).toHaveLength(1)
      expect(_internalState().messages[0]?.text).toBe('Failed but visible once.')
      expect(_internalState().messages[0]?.audioFailures).toHaveLength(1)
      expect(_internalState().messages[0]?.audioFailures[0]).toEqual(
        expect.objectContaining({ sentenceId: 7, failedProviderId: 'gpt_sovits' })
      )
      expect(playAudioPayloadMock).not.toHaveBeenCalled()
    })
  })

  it('appends failed GPT-SoVITS sentence text once and marks the audio failure', async () => {
    const dispatch = await loadDispatcher()

    dispatch(failedGptAudio())

    expect(_internalState().messages).toHaveLength(1)
    expect(_internalState().messages[0]?.text).toBe('The visible sentence.')
    expect(_internalState().messages[0]?.audioFailures).toEqual([
      expect.objectContaining({ sentenceId: 7, failedProviderId: 'gpt_sovits' })
    ])
    expect(playAudioPayloadMock).not.toHaveBeenCalled()
  })

  it('renders concise failed-audio copy and next-turn Piper fallback notice without raw details', async () => {
    const dispatch = await loadDispatcher()
    render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    dispatch(failedGptAudio())

    expect(await screen.findByText('The visible sentence.')).toBeInTheDocument()
    expect(screen.getByText(COPY.CHAT.GPT_SOVITS_AUDIO_FAILED_SENTENCE)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(COPY.CHAT.GPT_SOVITS_NEXT_TURN_FALLBACK)
    expect(screen.getByText(COPY.CHAT.GPT_SOVITS_OPEN_LOGS)).toBeInTheDocument()
    expect(screen.queryByText(/server returned 500/i)).toBeNull()
  })

  it('does not save config or auto-select Piper when a GPT-SoVITS audio payload fails', async () => {
    const dispatch = await loadDispatcher()

    dispatch(failedGptAudio())

    dispatch({ type: 'control', text: 'conversation-chain-end' })

    expect(window.api.saveStoredConfig).not.toHaveBeenCalled()
    expect(_internalState().banner?.text).toBe(COPY.CHAT.GPT_SOVITS_NEXT_TURN_FALLBACK)
  })

  it('leaves silent action-only payloads unmarked unless failed_audio metadata is present', async () => {
    const dispatch = await loadDispatcher()

    dispatch({
      type: 'audio',
      audio: null,
      failed_audio: null,
      dispatches: [],
      display_text: { avatar: 'Teto', name: '', text: '' },
      forwarded: false,
      sentence_id: 2,
      slice_length: 20,
      volumes: []
    })

    expect(_internalState().messages[0]?.audioFailures).toEqual([])
    expect(_internalState().banner).toBeNull()
  })

  it('keeps explicit next-turn fallback in Settings Piper selection only', async () => {
    const dispatch = await loadDispatcher()
    render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    dispatch(failedGptAudio('Failed but readable.'))

    const bubble = await screen.findByText('Failed but readable.').then((node) => node.closest('.bubble')!)
    expect(within(bubble as HTMLElement).getByText(COPY.CHAT.GPT_SOVITS_AUDIO_FAILED_SENTENCE)).toBeInTheDocument()
    expect(window.api.saveStoredConfig).not.toHaveBeenCalled()
  })
})
