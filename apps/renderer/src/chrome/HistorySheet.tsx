/* SPEC §Component Inventory + USERFLOW D — slide-in History sheet.
 * 80% width capped at 360px. Esc + dimmed strip dismiss.
 * Ported verbatim from prototype src/shell.jsx HistorySheet (lines 131–182).
 */
import { useEffect } from 'react'
import { X, Plus, Search } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { PLACEHOLDER_THREADS } from '@/dev/__mocks__/mock-backend'

export function HistorySheet() {
  const { historyOpen, setHistoryOpen, showThreadList, setChatMessages } = useStore()

  useEffect(() => {
    if (!historyOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setHistoryOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [historyOpen, setHistoryOpen])

  if (!historyOpen) return null

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

        <div
          className="input"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: showThreadList ? 1 : 0.5,
            cursor: showThreadList ? 'text' : 'not-allowed'
          }}
        >
          <Search size={14} />
          <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            {COPY.HISTORY.SEARCH}
          </span>
        </div>

        {showThreadList ? (
          <div className="grow" style={{ overflow: 'auto' }}>
            {Object.entries(PLACEHOLDER_THREADS).map(([group, threads]) => (
              <div key={group}>
                <div className="group-title">{group}</div>
                {threads.map((t, i) => (
                  <div
                    key={i}
                    className="thread-row"
                    onClick={() => setHistoryOpen(false)}
                  >
                    · {t.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state grow">
            <h2>{COPY.HISTORY.PLACEHOLDER_HEAD}</h2>
            <p>{COPY.HISTORY.PLACEHOLDER_BODY}</p>
          </div>
        )}

        <button
          className="btn btn-secondary"
          onClick={() => {
            setChatMessages([])
            setHistoryOpen(false)
          }}
        >
          <Plus size={14} /> {COPY.HISTORY.NEW_THREAD.replace('+ ', '')}
        </button>
      </div>
      <div className="sheet-grab" onClick={() => setHistoryOpen(false)} />
    </div>
  )
}
