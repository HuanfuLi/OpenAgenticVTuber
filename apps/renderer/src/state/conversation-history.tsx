import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type {
  CommitConversationTurnInput,
  ConversationMessage,
  ConversationSession,
  ConversationSessionSummary,
  ConversationStats
} from '@preload-types'

type CompletedTurnInput = Omit<CommitConversationTurnInput, 'sessionId'> & { sessionId?: string }
type Committer = (input: CompletedTurnInput) => Promise<ConversationSession | null>

interface ConversationHistoryValue {
  activeSession: ConversationSession
  summaries: ConversationSessionSummary[]
  stats: ConversationStats
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createSession: () => Promise<ConversationSession>
  selectSession: (id: string) => Promise<ConversationSession>
  renameSession: (id: string, title: string) => Promise<ConversationSession>
  deleteSession: (id: string) => Promise<ConversationSession>
  clearAll: () => Promise<ConversationSession>
  commitTurn: (input: CommitConversationTurnInput) => Promise<ConversationSession>
}

const ConversationHistoryContext = createContext<ConversationHistoryValue | null>(null)

let dispatcherCommitter: Committer | null = null

export function registerConversationTurnCommitter(committer: Committer | null): () => void {
  dispatcherCommitter = committer
  return () => {
    if (dispatcherCommitter === committer) dispatcherCommitter = null
  }
}

export async function commitConversationTurnFromDispatcher(
  input: CompletedTurnInput
): Promise<ConversationSession | null> {
  if (!dispatcherCommitter) return null
  return dispatcherCommitter(input)
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeEmptySession(): ConversationSession {
  const now = nowIso()
  return {
    id: 'local-empty-session',
    title: 'New chat',
    titleSource: 'auto',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    messages: []
  }
}

function summarize(session: ConversationSession): ConversationSessionSummary {
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

function statsFor(session: ConversationSession, summaries: ConversationSessionSummary[]): ConversationStats {
  const summaryMessages = summaries.reduce((total, item) => total + item.messageCount, 0)
  const messageCount = Math.max(summaryMessages, session.messages.length)
  return {
    sessionCount: Math.max(summaries.length, 1),
    messageCount,
    activeSessionId: session.id,
    persistence: 'local'
  }
}

function sessionMessagesEqual(a: ConversationMessage[], b: ConversationMessage[]): boolean {
  if (a.length !== b.length) return false
  return a.every((message, index) => {
    const other = b[index]
    return (
      other?.id === message.id &&
      other.role === message.role &&
      other.text === message.text &&
      other.createdAt === message.createdAt
    )
  })
}

export function ConversationHistoryProvider({ children }: { children: ReactNode }) {
  const fallbackSessionRef = useRef<ConversationSession>(makeEmptySession())
  const [activeSession, setActiveSession] = useState<ConversationSession>(fallbackSessionRef.current)
  const [summaries, setSummaries] = useState<ConversationSessionSummary[]>([
    summarize(fallbackSessionRef.current)
  ])
  const [stats, setStats] = useState<ConversationStats>(
    statsFor(fallbackSessionRef.current, [summarize(fallbackSessionRef.current)])
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applySnapshot = useCallback(
    (
      nextSession: ConversationSession,
      nextSummaries: ConversationSessionSummary[],
      nextStats?: ConversationStats
    ) => {
      setActiveSession((current) =>
        current.id === nextSession.id && sessionMessagesEqual(current.messages, nextSession.messages)
          ? { ...nextSession, messages: current.messages }
          : nextSession
      )
      setSummaries(nextSummaries)
      setStats(nextStats ?? statsFor(nextSession, nextSummaries))
    },
    []
  )

  const refresh = useCallback(async () => {
    if (!window.api?.getActiveConversationSession || !window.api?.listConversationSessions) {
      const session = fallbackSessionRef.current
      const nextSummaries = [summarize(session)]
      applySnapshot(session, nextSummaries)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [session, sessionSummaries, sessionStats] = await Promise.all([
        window.api.getActiveConversationSession(),
        window.api.listConversationSessions(),
        window.api.getConversationStats?.()
      ])
      applySnapshot(session, sessionSummaries.length > 0 ? sessionSummaries : [summarize(session)], sessionStats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [applySnapshot])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const refreshFromSession = useCallback(
    async (session: ConversationSession): Promise<ConversationSession> => {
      if (window.api?.listConversationSessions) {
        const [nextSummaries, nextStats] = await Promise.all([
          window.api.listConversationSessions(),
          window.api.getConversationStats?.()
        ])
        applySnapshot(session, nextSummaries.length > 0 ? nextSummaries : [summarize(session)], nextStats)
      } else {
        applySnapshot(session, [summarize(session)])
      }
      setError(null)
      setLoading(false)
      return session
    },
    [applySnapshot]
  )

  const createSession = useCallback(async () => {
    const session = await window.api.createConversationSession()
    return refreshFromSession(session)
  }, [refreshFromSession])

  const selectSession = useCallback(async (id: string) => {
    const session = await window.api.selectConversationSession(id)
    return refreshFromSession(session)
  }, [refreshFromSession])

  const renameSession = useCallback(async (id: string, title: string) => {
    const session = await window.api.renameConversationSession(id, title)
    return refreshFromSession(session)
  }, [refreshFromSession])

  const deleteSession = useCallback(async (id: string) => {
    const session = await window.api.deleteConversationSession(id)
    return refreshFromSession(session)
  }, [refreshFromSession])

  const clearAll = useCallback(async () => {
    const session = await window.api.clearConversationHistory()
    return refreshFromSession(session)
  }, [refreshFromSession])

  const commitTurn = useCallback(async (input: CommitConversationTurnInput) => {
    const session = await window.api.commitConversationTurn(input)
    return refreshFromSession(session)
  }, [refreshFromSession])

  useEffect(
    () =>
      registerConversationTurnCommitter(async (input) => {
        try {
          return await commitTurn({ ...input, sessionId: input.sessionId ?? activeSession.id })
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
          return null
        }
      }),
    [activeSession.id, commitTurn]
  )

  const value = useMemo<ConversationHistoryValue>(
    () => ({
      activeSession,
      summaries,
      stats,
      loading,
      error,
      refresh,
      createSession,
      selectSession,
      renameSession,
      deleteSession,
      clearAll,
      commitTurn
    }),
    [
      activeSession,
      summaries,
      stats,
      loading,
      error,
      refresh,
      createSession,
      selectSession,
      renameSession,
      deleteSession,
      clearAll,
      commitTurn
    ]
  )

  return (
    <ConversationHistoryContext.Provider value={value}>
      {children}
    </ConversationHistoryContext.Provider>
  )
}

export function useConversationHistory(): ConversationHistoryValue {
  const ctx = useContext(ConversationHistoryContext)
  if (!ctx) throw new Error('useConversationHistory must be used within <ConversationHistoryProvider>')
  return ctx
}
