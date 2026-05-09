import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppStoreProvider } from '@/state/app-store'
import { useConversationHistory } from '@/state/conversation-history'
import type { ConversationSession, ConversationSessionSummary, ConversationStats } from '@preload-types'

const now = '2026-05-09T12:00:00.000Z'

function summary(session: ConversationSession): ConversationSessionSummary {
  const last = session.messages[session.messages.length - 1]
  return {
    id: session.id,
    title: session.title,
    titleSource: session.titleSource,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt,
    messageCount: session.messages.length,
    preview: last?.text ?? ''
  }
}

function makeSession(id: string, title = 'New chat'): ConversationSession {
  return {
    id,
    title,
    titleSource: title === 'New chat' ? 'auto' : 'manual',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    messages: []
  }
}

function installConversationApi(initial: ConversationSession[] = [makeSession('s1')]) {
  let sessions = [...initial]
  let activeSessionId = sessions[0]!.id
  const active = (): ConversationSession => sessions.find((session) => session.id === activeSessionId)!
  const stats = (): ConversationStats => ({
    sessionCount: sessions.length,
    messageCount: sessions.reduce((total, session) => total + session.messages.length, 0),
    activeSessionId,
    persistence: 'local'
  })
  const api = {
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
    listConversationSessions: vi.fn(async () => sessions.map(summary)),
    getActiveConversationSession: vi.fn(async () => active()),
    createConversationSession: vi.fn(async () => {
      const session = makeSession(`s${sessions.length + 1}`)
      sessions = [session, ...sessions]
      activeSessionId = session.id
      return session
    }),
    selectConversationSession: vi.fn(async (id: string) => {
      activeSessionId = id
      return active()
    }),
    renameConversationSession: vi.fn(async (id: string, title: string) => {
      sessions = sessions.map((session) =>
        session.id === id ? { ...session, title, titleSource: 'manual' as const } : session
      )
      return sessions.find((session) => session.id === id)!
    }),
    deleteConversationSession: vi.fn(async (id: string) => {
      sessions = sessions.filter((session) => session.id !== id)
      if (sessions.length === 0) sessions = [makeSession('fresh')]
      activeSessionId = sessions[0]!.id
      return active()
    }),
    clearConversationHistory: vi.fn(async () => {
      const session = makeSession('cleared')
      sessions = [session]
      activeSessionId = session.id
      return session
    }),
    commitConversationTurn: vi.fn(async ({ sessionId, userText, assistantText, createdAt }) => {
      sessions = sessions.map((session) => {
        if (session.id !== sessionId) return session
        const messages = [
          ...session.messages,
          { id: 'u1', role: 'user' as const, text: userText, createdAt: createdAt ?? now },
          { id: 'a1', role: 'assistant' as const, text: assistantText, createdAt: now }
        ]
        return {
          ...session,
          title: session.titleSource === 'auto' && session.messages.length === 0 ? userText : session.title,
          updatedAt: now,
          lastMessageAt: now,
          messages
        }
      })
      return sessions.find((session) => session.id === sessionId)!
    }),
    getConversationStats: vi.fn(async () => stats())
  }
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  return api
}

function Probe() {
  const history = useConversationHistory()
  return (
    <div>
      <div data-testid="active-title">{history.activeSession.title}</div>
      <div data-testid="session-count">{history.stats.sessionCount}</div>
      <div data-testid="message-count">{history.stats.messageCount}</div>
      <button onClick={() => void history.createSession()}>create</button>
      <button onClick={() => void history.renameSession(history.activeSession.id, 'Manual title')}>
        rename
      </button>
      <button
        onClick={() =>
          void history.commitTurn({
            sessionId: history.activeSession.id,
            userText: 'Why local history?',
            assistantText: 'Because transcript sessions persist locally.'
          })
        }
      >
        commit
      </button>
      <button onClick={() => void history.clearAll()}>clear all</button>
    </div>
  )
}

describe('ConversationHistoryProvider', () => {
  beforeEach(() => {
    installConversationApi()
  })

  function renderProbe() {
    return render(
      <AppStoreProvider>
        <Probe />
      </AppStoreProvider>
    )
  }

  it('hydrates a New chat session and local stats from the bridge', async () => {
    renderProbe()

    expect(await screen.findByTestId('active-title')).toHaveTextContent('New chat')
    expect(screen.getByTestId('session-count')).toHaveTextContent('1')
    expect(screen.getByTestId('message-count')).toHaveTextContent('0')
    expect(window.api.listConversationSessions).toHaveBeenCalled()
    expect(window.api.getConversationStats).toHaveBeenCalled()
  })

  it('creates, renames, commits, and clears through real bridge methods', async () => {
    renderProbe()
    await screen.findByTestId('active-title')

    await act(async () => {
      fireEvent.click(screen.getByText('create'))
    })
    await waitFor(() => expect(window.api.createConversationSession).toHaveBeenCalled())

    await act(async () => {
      fireEvent.click(screen.getByText('rename'))
    })
    await waitFor(() => expect(screen.getByTestId('active-title')).toHaveTextContent('Manual title'))

    await act(async () => {
      fireEvent.click(screen.getByText('commit'))
    })
    await waitFor(() => expect(window.api.commitConversationTurn).toHaveBeenCalled())
    expect(screen.getByTestId('message-count')).toHaveTextContent('2')

    await act(async () => {
      fireEvent.click(screen.getByText('clear all'))
    })
    await waitFor(() => expect(window.api.clearConversationHistory).toHaveBeenCalled())
    expect(screen.getByTestId('active-title')).toHaveTextContent('New chat')
    expect(screen.getByTestId('session-count')).toHaveTextContent('1')
  })
})
