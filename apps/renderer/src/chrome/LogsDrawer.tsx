/* SPEC §Component Inventory + USERFLOW K — collapsible logs drawer.
 * Drag-to-resize handle (hand-rolled with mousedown/move/up listeners —
 * intentional per DELTA conversion rule, NOT Radix Drawer).
 * Ported verbatim from prototype src/shell.jsx LogsDrawer (lines 185–242).
 *
 * Lines come from window.api.onSidecarLog (real sidecar stdout in dev) — when
 * running outside Electron the prop `logLines` may be empty.
 */
import { useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, Folder } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'

interface LogsDrawerProps {
  logLines: string[]
}

export function LogsDrawer({ logLines }: LogsDrawerProps) {
  const { logsDrawer, setLogsDrawer } = useStore()

  const dragRef = useRef<{ active: boolean; startY: number; startH: number }>({
    active: false,
    startY: 0,
    startH: 200
  })

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    dragRef.current = {
      active: true,
      startY: e.clientY,
      startH: logsDrawer.height || 200
    }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!dragRef.current.active) return
      const dy = dragRef.current.startY - e.clientY
      const next = Math.max(80, Math.min(500, dragRef.current.startH + dy))
      setLogsDrawer({ height: next })
    }
    const onUp = (): void => {
      dragRef.current.active = false
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [setLogsDrawer])

  if (!logsDrawer.enabled) return null

  if (!logsDrawer.open) {
    return (
      <div
        className="logs-strip"
        data-theme-surface
        onClick={() => setLogsDrawer({ open: true })}
      >
        <span>{COPY.LOGS.COLLAPSED}</span>
        <ChevronUp size={14} />
      </div>
    )
  }

  return (
    <div
      className="logs-drawer"
      data-theme-surface
      style={{ height: logsDrawer.height || 200 }}
    >
      <div className="grab" onMouseDown={onMouseDown} />
      <div className="header">
        <button
          className="btn btn-ghost"
          style={{ height: 24, padding: '0 6px' }}
          onClick={() => setLogsDrawer({ open: false })}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>{COPY.LOGS.COLLAPSED}</span>
          <ChevronDown size={14} />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ height: 24, padding: '0 8px', fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('logs:clear'))
            }}
          >
            {COPY.LOGS.CLEAR}
          </button>
          <button
            className="btn btn-ghost"
            style={{ height: 24, padding: '0 8px', fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation()
              alert('(mock) Would open: ~/Library/Logs/AgenticLLMVTuber')
            }}
          >
            <Folder size={12} /> {COPY.LOGS.OPEN_FOLDER}
          </button>
        </div>
      </div>
      <div className="body">
        {logLines.map((line, i) => {
          // UI-SPEC IP-4 (plan 02-03): lines starting with [INTENT] get the
          // prefix span styled --success so SC #2 verification can scan the
          // drawer at a glance. [STUB-TTS], [INFO], [READY], [ERROR], etc.
          // stay in default --foreground (IP-5).
          if (line.startsWith('[INTENT]')) {
            return (
              <div key={i} className="line">
                <span style={{ color: 'var(--success)' }}>[INTENT]</span>
                <span>{line.slice('[INTENT]'.length)}</span>
              </div>
            )
          }
          return (
            <div key={i} className="line">
              {line}
            </div>
          )
        })}
      </div>
    </div>
  )
}
