/* SPEC §Component Inventory + USERFLOW G — composite ⬢ status icon + popover.
 *
 * Ported verbatim from prototype src/shell.jsx StatusIcon (lines 5–71).
 * Replaced window.ICONS / window.useStore / window.COPY with ESM imports
 * (DELTA conversion rule 3).
 *
 * Phase 11 uses real persisted setup, sidecar lifecycle, and VTS status APIs.
 */
import { useEffect, useRef, useState } from 'react'
import { Hexagon } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'

export function StatusIcon() {
  const { status, statusOpen, setStatusOpen, statusOverall, refreshStatus } = useStore()
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!statusOpen) return
    void refreshStatus()
    const onDoc = (e: MouseEvent): void => {
      if (!popoverRef.current) return
      const target = e.target as Element | null
      if (
        target &&
        !popoverRef.current.contains(target) &&
        !target.closest('.status-hex-btn')
      ) {
        setStatusOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setStatusOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [statusOpen, setStatusOpen, refreshStatus])

  const color =
    statusOverall === 'green'
      ? 'var(--success)'
      : statusOverall === 'amber'
        ? 'var(--warning)'
        : 'var(--destructive)'

  const [retesting, setRetesting] = useState(false)
  const onRetest = async (): Promise<void> => {
    setRetesting(true)
    try {
      await refreshStatus()
    } finally {
      setRetesting(false)
    }
  }

  return (
    <div className="relative" style={{ display: 'inline-flex' }}>
      <button
        className="icon-btn status-hex-btn"
        title={`Status: ${statusOverall}`}
        aria-label={`${COPY.STATUS.HEADER}: ${statusOverall}`}
        onClick={() => setStatusOpen(!statusOpen)}
      >
        <span className="status-hex" style={{ color }}>
          <Hexagon size={18} fill={color} strokeWidth={1.25} />
        </span>
      </button>
      {statusOpen && (
        <div className="popover" ref={popoverRef} role="dialog" data-theme-surface>
          <div className="head">
            <h3>{COPY.STATUS.HEADER}</h3>
          </div>
          <div className="row">
            <span
              className={`dot ${
                status.llm === 'green' ? 'green' : status.llm === 'amber' ? 'amber' : 'red'
              }`}
            />
            <span className="label">{COPY.STATUS.LLM}</span>
            <span className="detail">{status.llmDetail}</span>
          </div>
          <div className="row">
            <span
              className={`dot ${
                status.vts === 'green' ? 'green' : status.vts === 'amber' ? 'amber' : 'red'
              }`}
            />
            <span className="label">{COPY.STATUS.VTS}</span>
            <span className="detail">{status.vtsDetail}</span>
          </div>
          <div className="row">
            <span
              className={`dot ${
                status.sidecar === 'green'
                  ? 'green'
                  : status.sidecar === 'amber'
                    ? 'amber'
                    : 'red'
              }`}
            />
            <span className="label">{COPY.STATUS.SIDECAR}</span>
            <span className="detail">{status.sidecarDetail}</span>
          </div>
          <div className="row">
            <span
              className={`dot ${
                status.plugin === 'green'
                  ? 'green'
                  : status.plugin === 'amber'
                    ? 'amber'
                    : 'red'
              }`}
            />
            <span className="label">{COPY.STATUS.PLUGIN}</span>
            <span className="detail">{status.pluginDetail}</span>
          </div>
          {status.pluginDeveloperDetails && (
            <details className="tx-sm muted" style={{ marginTop: 4 }}>
              <summary>{COPY.STATUS.PLUGIN_DETAILS}</summary>
              <pre className="tx-sm" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                {status.pluginDeveloperDetails}
              </pre>
            </details>
          )}
          <button
            className="btn btn-primary"
            disabled={retesting}
            onClick={onRetest}
            style={{ marginTop: 4 }}
          >
            {retesting ? COPY.STATUS.REFRESHING : COPY.STATUS.REFRESH}
          </button>
        </div>
      )}
    </div>
  )
}
