import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'

const wsMock = vi.hoisted(() => ({ connected: true }))
const sendMock = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/ws/client', () => ({
  send: sendMock
}))

vi.mock('@/ws/store', () => ({
  appendUserMessage: () => undefined,
  useWSConnected: () => wsMock.connected
}))

import { AppStoreProvider, useStore } from '@/state/app-store'
import { COPY } from '@/lib/copy'
import { Chat } from '@/screens/Chat/Chat'
import type { ConversationSession } from '@preload-types'
import {
  resetStreaming,
  setInputDisabled,
  setSpeaking
} from '@/screens/Chat/useStreamingMessages'


describe('Chat speaking affordance', () => {
  beforeEach(() => {
    wsMock.connected = true
    sendMock.mockClear()
    resetStreaming()
    const session: ConversationSession = {
      id: 's1',
      title: 'Persisted session',
      titleSource: 'manual',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
      lastMessageAt: '2026-05-09T12:00:00.000Z',
      messages: []
    }
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getStoredConfig: vi.fn().mockResolvedValue(null),
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
        listConversationSessions: vi.fn().mockResolvedValue([
          {
            id: session.id,
            title: session.title,
            titleSource: session.titleSource,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastMessageAt: session.lastMessageAt,
            messageCount: session.messages.length,
            preview: ''
          }
        ]),
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

  function renderChat() {
    return render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )
  }

  function chatTree() {
    return (
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )
  }

  function BannerHarness({ kind }: { kind: 'llm' | 'sidecarRepeat' }) {
    const { setBanners } = useStore()
    return (
      <>
        <button onClick={() => setBanners({ [kind]: true })}>show banner</button>
        <Chat />
      </>
    )
  }

  it('hides the speaking label initially', () => {
    renderChat()
    expect(screen.queryByTestId('speaking-label')).toBeNull()
  })

  it('shows the speaking label on speaking state', () => {
    renderChat()
    act(() => {
      setSpeaking(true)
    })
    expect(screen.getByTestId('speaking-label')).toHaveTextContent(COPY.CHAT.SPEAKING)
  })

  it('clears the speaking label when speaking ends', () => {
    renderChat()
    act(() => {
      setSpeaking(true)
    })
    expect(screen.getByTestId('speaking-label')).toBeInTheDocument()

    act(() => {
      setSpeaking(false)
    })
    expect(screen.queryByTestId('speaking-label')).toBeNull()
  })

  it('keeps the input disabled while speaking', () => {
    renderChat()
    act(() => {
      setInputDisabled(true)
      setSpeaking(true)
    })

    expect(screen.getByLabelText('Chat input')).toBeDisabled()
    expect(screen.getByLabelText('Send')).toBeDisabled()
    expect(screen.getByTestId('speaking-label')).toHaveTextContent(COPY.CHAT.SPEAKING)
  })

  it('hydrates persisted active-session messages before live streaming bubbles', async () => {
    const persistedSession: ConversationSession = {
      id: 's1',
      title: 'Persisted session',
      titleSource: 'manual',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:01:00.000Z',
      lastMessageAt: '2026-05-09T12:01:00.000Z',
      messages: [
        {
          id: 'm1',
          role: 'user',
          text: 'Do you remember this transcript?',
          createdAt: '2026-05-09T12:00:00.000Z'
        },
        {
          id: 'm2',
          role: 'assistant',
          text: 'Yes, it restored from local history.',
          createdAt: '2026-05-09T12:01:00.000Z'
        }
      ]
    }
    vi.mocked(window.api.getActiveConversationSession).mockResolvedValue(persistedSession)
    vi.mocked(window.api.listConversationSessions).mockResolvedValue([
      {
        id: persistedSession.id,
        title: persistedSession.title,
        titleSource: persistedSession.titleSource,
        createdAt: persistedSession.createdAt,
        updatedAt: persistedSession.updatedAt,
        lastMessageAt: persistedSession.lastMessageAt,
        messageCount: 2,
        preview: 'Yes, it restored from local history.'
      }
    ])
    vi.mocked(window.api.getConversationStats).mockResolvedValue({
      sessionCount: 1,
      messageCount: 2,
      activeSessionId: persistedSession.id,
      persistence: 'local'
    })

    renderChat()

    expect(await screen.findByText('Do you remember this transcript?')).toBeInTheDocument()
    expect(screen.getByText('Yes, it restored from local history.')).toBeInTheDocument()
  })

  it('sends recovered active-session transcript as LLM context', async () => {
    const persistedSession: ConversationSession = {
      id: 's1',
      title: 'Persisted session',
      titleSource: 'manual',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:01:00.000Z',
      lastMessageAt: '2026-05-09T12:01:00.000Z',
      messages: [
        {
          id: 'm1',
          role: 'user',
          text: 'What should I bake today?',
          createdAt: '2026-05-09T12:00:00.000Z'
        },
        {
          id: 'm2',
          role: 'assistant',
          text: 'Bake croissants.',
          createdAt: '2026-05-09T12:01:00.000Z'
        }
      ]
    }
    vi.mocked(window.api.getActiveConversationSession).mockResolvedValue(persistedSession)
    vi.mocked(window.api.listConversationSessions).mockResolvedValue([
      {
        id: persistedSession.id,
        title: persistedSession.title,
        titleSource: persistedSession.titleSource,
        createdAt: persistedSession.createdAt,
        updatedAt: persistedSession.updatedAt,
        lastMessageAt: persistedSession.lastMessageAt,
        messageCount: 2,
        preview: 'Bake croissants.'
      }
    ])

    renderChat()

    const input = await screen.findByLabelText('Chat input')
    fireEvent.change(input, { target: { value: 'And after that?' } })
    fireEvent.click(screen.getByLabelText('Send'))

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({
        type: 'text-input',
        text: 'And after that?',
        session_id: 's1',
        history: [
          { role: 'user', text: 'What should I bake today?' },
          { role: 'assistant', text: 'Bake croissants.' }
        ]
      })
    })
  })

  it('reenables the input after sidecar reconnect clears transient streaming state', () => {
    const view = render(chatTree())

    act(() => {
      wsMock.connected = false
      setInputDisabled(true)
      setSpeaking(true)
    })
    view.rerender(chatTree())

    expect(screen.getByLabelText('Chat input')).toBeDisabled()

    act(() => {
      resetStreaming()
      wsMock.connected = true
    })
    view.rerender(chatTree())

    expect(screen.getByLabelText('Chat input')).not.toBeDisabled()
    expect(screen.queryByTestId('speaking-label')).toBeNull()
  })

  it('opens VTube Studio docs through the Electron bridge', () => {
    renderChat()

    fireEvent.click(screen.getByRole('button', { name: COPY.CHAT.EMPTY_VTS_LINK }))

    expect(window.api.openVtsDocs).toHaveBeenCalledTimes(1)
  })

  it('does not inject prototype scripted messages into normal Chat', () => {
    renderChat()

    window.dispatchEvent(new CustomEvent('chat:inject'))

    expect(screen.queryByText('echo: hello')).toBeNull()
  })

  it('refreshes status through real APIs from the LLM banner action', async () => {
    render(
      <AppStoreProvider>
        <BannerHarness kind="llm" />
      </AppStoreProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'show banner' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(window.api.getStoredConfig).toHaveBeenCalled()
      expect(window.api.getVtsStatus).toHaveBeenCalled()
    })
  })

  it('restarts the sidecar through the real API from the crash banner action', async () => {
    render(
      <AppStoreProvider>
        <BannerHarness kind="sidecarRepeat" />
      </AppStoreProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'show banner' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restart sidecar' }))

    await waitFor(() => {
      expect(window.api.restartSidecar).toHaveBeenCalledTimes(1)
    })
  })
})
