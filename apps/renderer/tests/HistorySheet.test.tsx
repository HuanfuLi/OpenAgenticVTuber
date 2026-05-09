import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AppStoreProvider, useStore } from '@/state/app-store'
import { HistorySheet } from '@/chrome/HistorySheet'
import { COPY } from '@/lib/copy'
import type { ConversationSession, ConversationSessionSummary, ConversationStats } from '@preload-types'

const now = '2026-05-09T12:00:00.000Z'

function makeSession(id: string, title: string, preview = ''): ConversationSession {
  const messages = preview
    ? [{ id: `${id}-a`, role: 'assistant' as const, text: preview, createdAt: now }]
    : []
  return {
    id,
    title,
    titleSource: title === 'New chat' ? 'auto' : 'manual',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: messages.length > 0 ? now : null,
    messages
  }
}

function summary(session: ConversationSession): ConversationSessionSummary {
  return {
    id: session.id,
    title: session.title,
    titleSource: session.titleSource,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt,
    messageCount: session.messages.length,
    preview: session.messages[session.messages.length - 1]?.text ?? ''
  }
}

function installApi() {
  let sessions = [
    makeSession('s1', 'Croissant plan', 'Fresh croissants and local transcripts.'),
    makeSession('s2', 'Debug notes', 'Renderer state stays deterministic.')
  ]
  let activeSessionId = 's1'
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
      const session = makeSession('s3', 'New chat')
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
      activeSessionId = sessions[0]?.id ?? 's3'
      if (sessions.length === 0) sessions = [makeSession('s3', 'New chat')]
      return active()
    }),
    clearConversationHistory: vi.fn(),
    commitConversationTurn: vi.fn(),
    getConversationStats: vi.fn(async () => stats())
  }
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  Object.defineProperty(window, 'confirm', { configurable: true, value: vi.fn(() => true) })
  return api
}

function OpenHistory() {
  const { setHistoryOpen } = useStore()
  return <button onClick={() => setHistoryOpen(true)}>open history</button>
}

describe('HistorySheet', () => {
  beforeEach(() => {
    installApi()
  })

  function renderHistory() {
    return render(
      <AppStoreProvider>
        <OpenHistory />
        <HistorySheet />
      </AppStoreProvider>
    )
  }

  it('lists real sessions and filters by title or preview', async () => {
    renderHistory()
    fireEvent.click(screen.getByText('open history'))

    expect(await screen.findByText('Croissant plan')).toBeInTheDocument()
    expect(screen.getByText('Debug notes')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(COPY.HISTORY.SEARCH_LABEL), {
      target: { value: 'renderer' }
    })

    expect(screen.queryByText('Croissant plan')).toBeNull()
    expect(screen.getByText('Debug notes')).toBeInTheDocument()
  })

  it('creates, selects, renames, and deletes sessions through conversation history APIs', async () => {
    const api = installApi()
    renderHistory()
    fireEvent.click(screen.getByText('open history'))

    fireEvent.click(await screen.findByRole('button', { name: COPY.HISTORY.NEW_THREAD }))
    await waitFor(() => expect(api.createConversationSession).toHaveBeenCalled())

    fireEvent.click(screen.getByText('open history'))
    fireEvent.click(await screen.findByText('Debug notes'))
    await waitFor(() => expect(api.selectConversationSession).toHaveBeenCalledWith('s2'))

    fireEvent.click(screen.getByText('open history'))
    const row = (await screen.findByText('Croissant plan')).closest('.history-row')!
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: COPY.HISTORY.RENAME }))
    fireEvent.change(screen.getByLabelText(COPY.HISTORY.RENAME_INPUT_LABEL), {
      target: { value: 'Manual croissant title' }
    })
    fireEvent.click(screen.getByRole('button', { name: COPY.HISTORY.RENAME_SAVE }))
    await waitFor(() =>
      expect(api.renameConversationSession).toHaveBeenCalledWith('s1', 'Manual croissant title')
    )

    const renamedRow = (await screen.findByText('Manual croissant title')).closest('.history-row')!
    fireEvent.click(within(renamedRow as HTMLElement).getByRole('button', { name: COPY.HISTORY.DELETE }))
    await waitFor(() => expect(api.deleteConversationSession).toHaveBeenCalled())
    expect(window.confirm).toHaveBeenCalledWith(COPY.HISTORY.DELETE_CONFIRM)
  })
})
