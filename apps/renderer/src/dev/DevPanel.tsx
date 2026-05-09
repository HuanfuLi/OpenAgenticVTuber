/* DevPanel — design-review affordance. Mounted only in DEV builds via
 * `import.meta.env.DEV` gate in App.tsx; production tree-shakes this out.
 *
 * Ported from prototype src/dev/DevPanel.jsx (2026-05-06).
 */
import { useState } from 'react'
import { useStore } from '@/state/app-store'
import { useTheme, type ThemePrefs } from '@/state/theme-provider'
import type { StatusValue } from '@/state/status-types'
import { COPY } from '@/lib/copy'
import { send } from '@/ws/client'

interface ThemeChoice {
  name: string
  prefs: Partial<ThemePrefs>
}

const THEMES: ThemeChoice[] = [
  { name: 'Blush', prefs: { mode: 'light', lightAccent: 'blush' } },
  { name: 'Sunrise', prefs: { mode: 'light', lightAccent: 'sunrise' } },
  { name: 'Ember', prefs: { mode: 'light', lightAccent: 'ember' } },
  { name: 'Mid·Sky', prefs: { mode: 'dark', darkBg: 'midnight', darkAccent: 'sky' } },
  { name: 'Mid·Pewter', prefs: { mode: 'dark', darkBg: 'midnight', darkAccent: 'pewter' } },
  { name: 'Onyx·Sky', prefs: { mode: 'dark', darkBg: 'onyx', darkAccent: 'sky' } },
  { name: 'Onyx·Pewt', prefs: { mode: 'dark', darkBg: 'onyx', darkAccent: 'pewter' } }
]

export function DevPanel() {
  const [open, setOpen] = useState(false)
  const [bodySwayStrategy, setBodySwayStrategy] = useState('head_only')
  const {
    status,
    banners,
    resetAll,
    showThreadList,
    setShowThreadList,
    setHistoryOpen,
    setBanners,
    pushToast,
    setStatusForDev
  } = useStore()
  const { prefs, setPrefs } = useTheme()

  const isActive = (t: ThemeChoice): boolean => {
    if (t.prefs.mode !== prefs.mode) return false
    if (t.prefs.mode === 'light') return prefs.lightAccent === t.prefs.lightAccent
    return prefs.darkBg === t.prefs.darkBg && prefs.darkAccent === t.prefs.darkAccent
  }

  const cycle = (current: StatusValue): StatusValue => {
    const seq: StatusValue[] = ['green', 'amber', 'red']
    const i = seq.indexOf(current)
    return seq[(i + 1) % seq.length]!
  }

  const setStatusFor = (key: 'llm' | 'vts' | 'sidecar'): void => {
    const next = cycle(status[key])
    const detailMap = {
      llm: {
        green: 'qwen2.5-7b · LM Studio · last reply 423ms',
        amber: 'reconnecting…',
        red: 'Connection refused at http://localhost:1234/v1'
      },
      vts: {
        green: 'rig=teto · @60Hz',
        amber: 'handshake pending',
        red: 'VTube Studio not running'
      },
      sidecar: {
        green: 'ws://127.0.0.1:53811/ws · pid 21340',
        amber: 'starting…',
        red: 'exited code 137'
      }
    } as const
    setStatusForDev({ [key]: next, [`${key}Detail`]: detailMap[key][next] })
  }

  const triggerToast = (text: string): void => {
    pushToast({ text, ttlMs: 4000 })
  }

  const setBodySway = (name: string): void => {
    setBodySwayStrategy(name)
    send({ type: 'control', text: `set-body-sway-strategy:${name}` })
  }

  if (!open) {
    return (
      <button className="dev-fab" onClick={() => setOpen(true)} title="Dev panel">
        🛠
      </button>
    )
  }

  return (
    <div className="dev-panel">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>Design-review panel</h4>
        <button className="dev-btn" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      <h4>Connection state</h4>
      <div className="dev-grid">
        <span>LLM</span>
        <button
          className={`dev-btn ${status.llm === 'green' ? 'active' : status.llm === 'amber' ? 'amber' : 'red'}`}
          onClick={() => setStatusFor('llm')}
        >
          {status.llm}
        </button>
        <span>VTS</span>
        <button
          className={`dev-btn ${status.vts === 'green' ? 'active' : status.vts === 'amber' ? 'amber' : 'red'}`}
          onClick={() => setStatusFor('vts')}
        >
          {status.vts}
        </button>
        <span>Sidecar</span>
        <button
          className={`dev-btn ${status.sidecar === 'green' ? 'active' : status.sidecar === 'amber' ? 'amber' : 'red'}`}
          onClick={() => setStatusFor('sidecar')}
        >
          {status.sidecar}
        </button>
      </div>

      <h4>Trigger flows</h4>
      <div className="row">
        <button className="dev-btn" onClick={resetAll}>
          Reset cold launch
        </button>
        <button className="dev-btn" onClick={() => setBanners({ llm: !banners.llm })}>
          Force LLM unreachable
        </button>
        <button className="dev-btn" onClick={() => setBanners({ vts: !banners.vts })}>
          Force VTS disconnected
        </button>
        <button className="dev-btn" onClick={() => setBanners({ vtsAuth: !banners.vtsAuth })}>
          Force VTS auth denied
        </button>
        <button className="dev-btn" onClick={() => triggerToast(COPY.ERRORS.SIDECAR_TOAST)}>
          Sidecar crash + restart
        </button>
        <button className="dev-btn" onClick={() => setBanners({ tts: !banners.tts })}>
          Force TTS unavailable
        </button>
        <button
          className="dev-btn"
          onClick={() => {
            setShowThreadList(!showThreadList)
            setHistoryOpen(true)
          }}
        >
          Toggle thread list ({showThreadList ? 'v2 mock' : 'empty'})
        </button>
      </div>

      <h4>{COPY['dev.bodySway.title']}</h4>
      <div className="dev-grid">
        {[
          ['head_only', COPY['dev.bodySway.headOnly']]
        ].map(([value, label]) => (
          <label key={value} className="row" style={{ gap: 6 }}>
            <input
              type="radio"
              name="body-sway-strategy"
              checked={bodySwayStrategy === value}
              onChange={() => setBodySway(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <h4>Theme cycler</h4>
      <div className="row">
        {THEMES.map((t) => (
          <button
            key={t.name}
            className={`dev-btn${isActive(t) ? ' active' : ''}`}
            onClick={() => setPrefs(t.prefs)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="dev-btn" onClick={() => setPrefs({ mode: 'auto' })}>
          Mode: auto
        </button>
      </div>
    </div>
  )
}
