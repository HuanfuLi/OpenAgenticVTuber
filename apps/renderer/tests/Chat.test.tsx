import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('@/ws/client', () => ({
  send: () => true
}))

vi.mock('@/ws/store', () => ({
  appendUserMessage: () => undefined,
  useWSConnected: () => true
}))

import { AppStoreProvider } from '@/state/app-store'
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
        })
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
})
