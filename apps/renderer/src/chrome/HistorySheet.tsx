/* SPEC §Component Inventory + USERFLOW D — slide-in History sheet.
 * Phase 13 replaces placeholder threads with real local conversation sessions.
 */
import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Search } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { useConversationHistory } from '@/state/conversation-history'
import { useInputDisabled } from '@/screens/Chat/useStreamingMessages'
import type { ConversationSessionSummary } from '@preload-types'

function bucketFor(session: ConversationSessionSummary): string {
  const date = new Date(session.lastMessageAt ?? session.updatedAt)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startSession = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  if (startSession === startToday) return COPY.HISTORY.GROUP_TODAY
  if (startSession === startToday - dayMs) return COPY.HISTORY.GROUP_YESTERDAY
  if (startSession > startToday - 7 * dayMs) return COPY.HISTORY.GROUP_PREVIOUS_7
  return COPY.HISTORY.GROUP_OLDER
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function HistorySheet() {
  const { historyOpen, setHistoryOpen } = useStore()
  const {
    activeSession,
    summaries,
    loading,
    error,
    createSession,
    selectSession,
    renameSession,
    deleteSession
  } = useConversationHistory()
  const turnInFlight = useInputDisabled()
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!historyOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setHistoryOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [historyOpen, setHistoryOpen])

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery
      ? summaries.filter((session) =>
          `${session.title} ${session.preview}`.toLowerCase().includes(normalizedQuery)
        )
      : summaries
    return filtered.reduce<Record<string, ConversationSessionSummary[]>>((groups, session) => {
      const bucket = bucketFor(session)
      groups[bucket] = [...(groups[bucket] ?? []), session]
      return groups
    }, {})
  }, [query, summaries])

  const startRename = (session: ConversationSessionSummary): void => {
    setRenamingId(session.id)
    setRenameValue(session.title)
  }

  const submitRename = async (): Promise<void> => {
    if (!renamingId) return
    await renameSession(renamingId, renameValue)
    setRenamingId(null)
    setRenameValue('')
  }

  if (!historyOpen) return null

  const hasRows = Object.values(filteredGroups).some((items) => items.length > 0)

  return (
    <div
      className="sheet-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setHistoryOpen(false)
      }}
    >
      <div className="sheet" data-theme-surface role="dialog" aria-label={COPY.HISTORY.HEADER}>
        <div className="head">
          <h3>{COPY.HISTORY.HEADER}</h3>
          <button
            className="icon-btn"
            aria-label="Close"
            onClick={() => setHistoryOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <label className="history-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.HISTORY.SEARCH}
            aria-label={COPY.HISTORY.SEARCH_LABEL}
          />
        </label>

        <div className="grow history-list">
          {loading ? (
            <div className="placeholder-line muted">{COPY.HISTORY.LOADING}</div>
          ) : error ? (
            <div className="placeholder-line muted">{COPY.HISTORY.ERROR}</div>
          ) : hasRows ? (
            Object.entries(filteredGroups).map(([group, sessions]) => (
              <div key={group}>
                <div className="group-title">{group}</div>
                {sessions.map((session) => {
                  const isActive = session.id === activeSession.id
                  const isRenaming = renamingId === session.id
                  return (
                    <div
                      key={session.id}
                      className={`thread-row history-row${isActive ? ' active' : ''}`}
                    >
                      <button
                        className="history-row-main"
                        onClick={() => {
                          void selectSession(session.id).then(() => setHistoryOpen(false))
                        }}
                        disabled={turnInFlight}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="history-row-title">{session.title}</span>
                        <span className="history-row-preview">
                          {session.preview || COPY.HISTORY.EMPTY_PREVIEW}
                        </span>
                        <span className="history-row-meta">
                          {session.messageCount} {session.messageCount === 1 ? 'message' : 'messages'} ·{' '}
                          {formatTime(session.updatedAt)}
                        </span>
                      </button>
                      {isRenaming ? (
                        <div className="history-row-edit">
                          <input
                            className="input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            aria-label={COPY.HISTORY.RENAME_INPUT_LABEL}
                            autoFocus
                          />
                          <button className="btn btn-secondary" onClick={() => void submitRename()}>
                            {COPY.HISTORY.RENAME_SAVE}
                          </button>
                          <button className="btn btn-ghost" onClick={() => setRenamingId(null)}>
                            {COPY.HISTORY.RENAME_CANCEL}
                          </button>
                        </div>
                      ) : (
                        <div className="history-row-actions">
                          <button
                            className="btn btn-ghost"
                            onClick={() => startRename(session)}
                            disabled={turnInFlight}
                          >
                            {COPY.HISTORY.RENAME}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              if (window.confirm(COPY.HISTORY.DELETE_CONFIRM)) {
                                void deleteSession(session.id)
                              }
                            }}
                            disabled={turnInFlight}
                          >
                            {COPY.HISTORY.DELETE}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            <div className="empty-state grow">
              <h2>{COPY.HISTORY.EMPTY_HEAD}</h2>
              <p>{COPY.HISTORY.EMPTY_BODY}</p>
            </div>
          )}
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => {
            void createSession().then(() => setHistoryOpen(false))
          }}
          disabled={turnInFlight}
        >
          <Plus size={14} /> {COPY.HISTORY.NEW_THREAD}
        </button>
      </div>
      <div className="sheet-grab" onClick={() => setHistoryOpen(false)} />
    </div>
  )
}
