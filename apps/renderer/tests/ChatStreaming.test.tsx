import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const stopAudioPlaybackMock = vi.hoisted(() => vi.fn())

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
  playAudioPayload: playAudioPayloadMock,
  stopAudioPlayback: stopAudioPlaybackMock,
  getAudioPlaybackState: vi.fn(() => ({ active: false })),
  subscribeAudioPlaybackState: vi.fn((listener: (state: { active: boolean }) => void) => {
    listener({ active: false })
    return () => undefined
  })
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
    const client = await import('@/ws/client')
    store.disposeWSStoreSubscriptions()
    vi.mocked(client.send).mockClear()
    resetStreaming()
    playAudioPayloadMock.mockClear()
    stopAudioPlaybackMock.mockClear()
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
        truncateConversationBeforeMessage: vi.fn().mockResolvedValue(session),
        getConversationStats: vi.fn().mockResolvedValue({
          sessionCount: 1,
          messageCount: 0,
          activeSessionId: session.id,
          persistence: 'local'
        }),
        openVtsDocs: vi.fn().mockResolvedValue(undefined),
        restartSidecar: vi.fn().mockResolvedValue(undefined),
        getVoiceInputReadiness: vi.fn().mockResolvedValue({
          ready: false,
          capture_status: 'idle',
          stt_enabled: false,
          provider_id: null,
          blocked_reason: 'stt_disabled',
          setup_destination: 'voice_settings',
          permission_state: 'unknown',
          readiness: null,
          summary: 'Voice input is disabled.'
        }),
        requestMicrophonePermission: vi.fn().mockResolvedValue('granted')
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

  it('replaces Send with Stop during an active turn and discards partial assistant output locally', async () => {
    const send = await import('@/ws/client').then((m) => vi.mocked(m.send))
    const dispatch = await loadDispatcher()
    render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    const input = await screen.findByLabelText('Chat input')
    fireEvent.change(input, { target: { value: 'bad transcript' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.SEND }))
    dispatch({ type: 'control', text: 'conversation-chain-start' })
    dispatch(normalAudio('Partial answer.'))

    const stop = await screen.findByRole('button', { name: COPY.CHAT.STOP_RESPONSE })
    fireEvent.click(stop)

    expect(send).toHaveBeenLastCalledWith({ type: 'stop-turn' })
    expect(stopAudioPlaybackMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('bad transcript')).toBeInTheDocument()
    expect(screen.queryByText('Partial answer.')).toBeNull()

    dispatch({ type: 'control', text: 'conversation-chain-end' })
    expect(screen.getByText('bad transcript')).toBeInTheDocument()
  })

  it('edits a stopped user message and resends without duplicating the user bubble', async () => {
    const send = await import('@/ws/client').then((m) => vi.mocked(m.send))
    const dispatch = await loadDispatcher()
    render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    const input = await screen.findByLabelText('Chat input')
    fireEvent.change(input, { target: { value: 'transcrip typo' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.SEND }))
    dispatch({ type: 'control', text: 'conversation-chain-start' })
    fireEvent.click(await screen.findByRole('button', { name: COPY.CHAT.STOP_RESPONSE }))

    fireEvent.click(await screen.findByRole('button', { name: COPY.CHAT.EDIT_MESSAGE }))
    fireEvent.change(screen.getByRole('textbox', { name: COPY.CHAT.EDIT_MESSAGE }), {
      target: { value: 'transcript typo fixed' }
    })
    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.SAVE_EDIT }))

    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'text-input',
      text: 'transcript typo fixed',
      history: []
    }))
    expect(screen.getAllByText('transcript typo fixed')).toHaveLength(1)
  })

  it('keeps a stopped message anchored and editable after later history appears', async () => {
    const send = await import('@/ws/client').then((m) => vi.mocked(m.send))
    const dispatch = await loadDispatcher()
    const view = render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    const input = await screen.findByLabelText('Chat input')
    fireEvent.change(input, { target: { value: 'orphaned typo' } })
    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.SEND }))
    dispatch({ type: 'control', text: 'conversation-chain-start' })
    fireEvent.click(await screen.findByRole('button', { name: COPY.CHAT.STOP_RESPONSE }))

    view.unmount()

    const laterSession: ConversationSession = {
      ...session,
      messages: [
        { id: 'later-u', role: 'user', text: 'later prompt', createdAt: '2099-05-10T00:00:00.000Z' },
        { id: 'later-a', role: 'assistant', text: 'later answer', createdAt: '2099-05-10T00:00:01.000Z' }
      ]
    }
    vi.mocked(window.api.getActiveConversationSession).mockResolvedValue(laterSession)
    vi.mocked(window.api.listConversationSessions).mockResolvedValue([{
      id: laterSession.id,
      title: laterSession.title,
      titleSource: laterSession.titleSource,
      createdAt: laterSession.createdAt,
      updatedAt: laterSession.updatedAt,
      lastMessageAt: laterSession.lastMessageAt,
      messageCount: laterSession.messages.length,
      preview: 'later answer'
    }])

    render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    await screen.findByText('later prompt')
    const chatText = document.querySelector('.chat-scroll')?.textContent ?? ''
    expect(chatText.indexOf('orphaned typo')).toBeGreaterThanOrEqual(0)
    expect(chatText.indexOf('orphaned typo')).toBeLessThan(chatText.indexOf('later prompt'))

    send.mockClear()
    const stoppedBubble = screen.getByText('orphaned typo').closest('.bubble') as HTMLElement
    fireEvent.click(within(stoppedBubble).getByRole('button', { name: COPY.CHAT.EDIT_MESSAGE }))
    fireEvent.change(screen.getByRole('textbox', { name: COPY.CHAT.EDIT_MESSAGE }), {
      target: { value: 'orphaned typo fixed' }
    })
    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.SAVE_EDIT }))

    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'text-input',
      text: 'orphaned typo fixed'
    }))
    expect(screen.queryByRole('textbox', { name: COPY.CHAT.EDIT_MESSAGE })).toBeNull()
    expect(screen.getAllByText('orphaned typo fixed')).toHaveLength(1)
  })

  it('truncates persisted history before edited user text is regenerated', async () => {
    const send = await import('@/ws/client').then((m) => vi.mocked(m.send))
    const persisted: ConversationSession = {
      ...session,
      messages: [
        { id: 'u1', role: 'user', text: 'first prompt', createdAt: '2026-05-10T00:00:00.000Z' },
        { id: 'a1', role: 'assistant', text: 'first answer', createdAt: '2026-05-10T00:00:01.000Z' },
        { id: 'u2', role: 'user', text: 'bad voice text', createdAt: '2026-05-10T00:00:02.000Z' },
        { id: 'a2', role: 'assistant', text: 'bad answer', createdAt: '2026-05-10T00:00:03.000Z' }
      ]
    }
    const truncated = { ...persisted, messages: persisted.messages.slice(0, 2) }
    vi.mocked(window.api.getActiveConversationSession).mockResolvedValue(persisted)
    vi.mocked(window.api.listConversationSessions).mockResolvedValue([{
      id: persisted.id,
      title: persisted.title,
      titleSource: persisted.titleSource,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
      lastMessageAt: persisted.lastMessageAt,
      messageCount: persisted.messages.length,
      preview: 'bad answer'
    }])
    vi.mocked(window.api.truncateConversationBeforeMessage).mockResolvedValue(truncated)

    render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )

    await screen.findByText('bad voice text')
    fireEvent.click(screen.getAllByRole('button', { name: COPY.CHAT.EDIT_MESSAGE })[1]!)
    fireEvent.change(screen.getByRole('textbox', { name: COPY.CHAT.EDIT_MESSAGE }), {
      target: { value: 'fixed voice text' }
    })
    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.SAVE_EDIT }))

    await waitFor(() => expect(window.api.truncateConversationBeforeMessage).toHaveBeenCalledWith('s1', 'u2'))
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'text-input',
      text: 'fixed voice text',
      history: [
        { role: 'user', text: 'first prompt' },
        { role: 'assistant', text: 'first answer' }
      ]
    }))
  })
})
