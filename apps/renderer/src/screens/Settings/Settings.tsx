/* SPEC §Settings IA — single long scroll, 16 sections, anchor pills.
 * Functional: §1 Connection, §5 TTS, §14 Appearance, §15 Diagnostics (partial), §16 About.
 * Placeholders: unfinished sections with "Coming in milestone-N. {body}" copy.
 *
 * Ported from prototype src/views/SettingsView.jsx (2026-05-06).
 */
import { useEffect, useRef, useState } from 'react'
import { Folder } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { useTheme, type ThemeMode, type LightAccent, type DarkBg, type DarkAccent } from '@/state/theme-provider'
import { mockStatus } from '@/dev/__mocks__/mock-backend'
import type { BodyMotionPluginSummary, StoredConfig } from '@preload-types'

// -------- Swatch resolvers ------------------------------------------------
function lightAccentSwatchColor(id: LightAccent): string {
  if (id === 'blush') return 'oklch(0.72 0.10 15)'
  if (id === 'sunrise') return 'oklch(0.72 0.12 55)'
  if (id === 'ember') return 'oklch(0.62 0.13 25)'
  return 'transparent'
}
function darkBgSwatchColor(id: DarkBg): string {
  if (id === 'midnight') return 'oklch(0.20 0.035 250)'
  if (id === 'onyx') return 'oklch(0.17 0.005 270)'
  return 'transparent'
}
function darkAccentSwatchColor(id: DarkAccent): string {
  if (id === 'sky') return 'oklch(0.78 0.08 240)'
  if (id === 'pewter') return 'oklch(0.75 0.005 270)'
  return 'transparent'
}

// -------- Generic radio row ---------------------------------------------
interface RadioRowProps {
  id: string
  label: string
  isDefault?: boolean
  checked: boolean
  disabled?: boolean
  onChange: (id: string) => void
  swatch?: string
  swatchSquare?: boolean
  tooltip?: string | null
}

function RadioRow({
  id,
  label,
  isDefault,
  checked,
  disabled,
  onChange,
  swatch,
  swatchSquare,
  tooltip
}: RadioRowProps) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={`radio-row${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}${tooltip ? ' tt' : ''}`}
      data-tt={tooltip || undefined}
      style={disabled ? { cursor: 'not-allowed' } : {}}
      onClick={() => {
        if (!disabled) onChange(id)
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault()
          onChange(id)
        }
      }}
    >
      <span className="dotwrap">
        <span className="inner" />
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {swatch && (
        <span
          className={`swatch${swatchSquare ? ' square' : ''}`}
          style={{ background: swatch }}
        />
      )}
      {isDefault && <span className="default-tag">(default)</span>}
    </div>
  )
}

// -------- Live preview --------------------------------------------------
function AppearancePreview() {
  return (
    <div className="preview-card" data-theme-surface>
      <div className="row">
        <span className="semibold tx-sm">Teto</span>
        <span className="tx-sm muted">10:42</span>
      </div>
      <div className="bubble assistant" style={{ alignSelf: 'flex-start' }}>
        <div className="body">
          On a quiet afternoon, the cat noticed a glint beneath the bookshelf.
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 13 }}>
          Test connection
        </button>
        <div className="row">
          <span className="dot green" />
          <span className="dot amber" />
          <span className="dot red" />
        </div>
      </div>
    </div>
  )
}

// -------- §14 Appearance (functional) -----------------------------------
function AppearanceSection() {
  const C = COPY.SETTINGS
  const { prefs, setPrefs, prefersDark } = useTheme()
  const resolvedMode = prefs.mode === 'auto' ? (prefersDark ? 'dark' : 'light') : prefs.mode
  const lightDisabled = resolvedMode === 'dark'
  const darkDisabled = resolvedMode === 'light'

  return (
    <section className="section" id="sec-appearance">
      <h2>{C.APPEARANCE_HEADER}</h2>

      <div className="group-label">{C.MODE_LABEL}</div>
      <div className="radio-group" role="radiogroup" aria-label={C.MODE_LABEL}>
        {C.MODE_OPTIONS.map((o) => (
          <RadioRow
            key={o.id}
            id={o.id}
            label={o.label}
            isDefault={'isDefault' in o ? o.isDefault : undefined}
            checked={prefs.mode === o.id}
            onChange={(id) => setPrefs({ mode: id as ThemeMode })}
          />
        ))}
      </div>

      <div className="group-label">{C.LIGHT_ACCENT_LABEL}</div>
      <div className="group-help">{C.LIGHT_ACCENT_HELP}</div>
      <div
        className="radio-group"
        role="radiogroup"
        aria-label={C.LIGHT_ACCENT_LABEL}
        aria-disabled={lightDisabled}
      >
        {C.LIGHT_ACCENT_OPTIONS.map((o) => (
          <RadioRow
            key={o.id}
            id={o.id}
            label={o.label}
            isDefault={'isDefault' in o ? o.isDefault : undefined}
            checked={prefs.lightAccent === o.id}
            disabled={lightDisabled}
            onChange={(id) => setPrefs({ lightAccent: id as LightAccent })}
            swatch={lightAccentSwatchColor(o.id as LightAccent)}
            tooltip={lightDisabled ? C.DISABLED_LIGHT_TT : null}
          />
        ))}
      </div>

      <div className="group-label">{C.DARK_BG_LABEL}</div>
      <div className="group-help">{C.DARK_BG_HELP}</div>
      <div
        className="radio-group"
        role="radiogroup"
        aria-label={C.DARK_BG_LABEL}
        aria-disabled={darkDisabled}
      >
        {C.DARK_BG_OPTIONS.map((o) => (
          <RadioRow
            key={o.id}
            id={o.id}
            label={o.label}
            isDefault={'isDefault' in o ? o.isDefault : undefined}
            checked={prefs.darkBg === o.id}
            disabled={darkDisabled}
            onChange={(id) => setPrefs({ darkBg: id as DarkBg })}
            swatch={darkBgSwatchColor(o.id as DarkBg)}
            swatchSquare
            tooltip={darkDisabled ? C.DISABLED_DARK_TT : null}
          />
        ))}
      </div>

      <div className="group-label">{C.DARK_ACCENT_LABEL}</div>
      <div className="group-help">{C.DARK_ACCENT_HELP}</div>
      <div
        className="radio-group"
        role="radiogroup"
        aria-label={C.DARK_ACCENT_LABEL}
        aria-disabled={darkDisabled}
      >
        {C.DARK_ACCENT_OPTIONS.map((o) => (
          <RadioRow
            key={o.id}
            id={o.id}
            label={o.label}
            isDefault={'isDefault' in o ? o.isDefault : undefined}
            checked={prefs.darkAccent === o.id}
            disabled={darkDisabled}
            onChange={(id) => setPrefs({ darkAccent: id as DarkAccent })}
            swatch={darkAccentSwatchColor(o.id as DarkAccent)}
            tooltip={darkDisabled ? C.DISABLED_DARK_TT : null}
          />
        ))}
      </div>

      <div className="group-label mt-4">{C.PREVIEW_HEADER}</div>
      <AppearancePreview />
    </section>
  )
}

// -------- §1 Connection --------------------------------------------------
// 01-02: read the real persisted config via window.api.getStoredConfig()
// (DPAPI on Windows). Falls back to llmConfig from the legacy app-store on
// the loading frame. The prototype's "lmstudio" id maps to safeStorage's
// "lm_studio" Provider type.
function ConnectionSection() {
  const C = COPY.SETTINGS
  const { llmConfig } = useStore()
  const [retesting, setRetesting] = useState(false)
  const [storedCfg, setStoredCfg] = useState<{
    provider: string
    endpointUrl: string
    modelName: string
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    let cancelled = false
    window.api
      .getStoredConfig()
      .then((cfg) => {
        if (cancelled) return
        if (cfg && cfg.hasCompletedSetup) {
          setStoredCfg({
            provider: cfg.provider.provider,
            endpointUrl: cfg.provider.endpointUrl,
            modelName: cfg.provider.modelName
          })
        }
      })
      .catch(() => {
        /* leave storedCfg null; render mock fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const providerId = storedCfg?.provider ?? llmConfig.provider
  const endpoint = storedCfg?.endpointUrl ?? llmConfig.endpoint
  const model = storedCfg?.modelName ?? llmConfig.model
  const providerLabel =
    providerId === 'lm_studio' || providerId === 'lmstudio'
      ? 'LM Studio'
      : providerId === 'custom_openai'
        ? 'Custom OpenAI-compat'
        : providerId

  const onRetest = async (): Promise<void> => {
    setRetesting(true)
    mockStatus.set({ llm: 'amber', llmDetail: 'reconnecting…' })
    await new Promise((r) => setTimeout(r, 600))
    mockStatus.set({ llm: 'green', llmDetail: 'qwen2.5-7b · LM Studio · last reply 423ms' })
    setRetesting(false)
  }
  return (
    <section className="section" id="sec-connection">
      <h2>{C.CONN_HEADER}</h2>
      <div className="kv-row">
        <span className="k">Provider</span>
        <span className="v">{providerLabel}</span>
      </div>
      <div className="kv-row">
        <span className="k">Endpoint</span>
        <span className="v">{endpoint}</span>
      </div>
      <div className="kv-row">
        <span className="k">Model</span>
        <span className="v">{model || 'auto-detect'}</span>
      </div>
      <div className="row mt-2" style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onRetest} disabled={retesting}>
          {retesting ? COPY.STATUS.TESTING : C.CONN_RETEST}
        </button>
        <span className="tt" data-tt={C.CONN_CHANGE_DISABLED_TT} style={{ display: 'inline-flex' }}>
          <button className="btn btn-secondary" disabled style={{ pointerEvents: 'none' }}>
            {C.CONN_CHANGE}
          </button>
        </span>
      </div>
    </section>
  )
}

// -------- Body motion plugins --------------------------------------------
function PluginSection() {
  const C = COPY.SETTINGS
  const [plugins, setPlugins] = useState<BodyMotionPluginSummary[]>([])
  const [storedCfg, setStoredCfg] = useState<StoredConfig | null>(null)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    let cancelled = false
    Promise.all([window.api.getStoredConfig(), window.api.listBodyMotionPlugins()])
      .then(([cfg, discovered]) => {
        if (cancelled) return
        setStoredCfg(cfg)
        setPlugins(discovered)
      })
      .catch(() => {
        if (!cancelled) setPlugins([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activePlugin = storedCfg?.plugin?.activePluginName || 'default'

  const selectPlugin = async (name: string): Promise<void> => {
    if (!storedCfg || name === activePlugin) return
    const nextCfg: StoredConfig = {
      ...storedCfg,
      plugin: { activePluginName: name }
    }
    setStoredCfg(nextCfg)
    setStatus(C.PLUGINS_SAVING)
    try {
      await window.api.saveStoredConfig(nextCfg)
      setStatus(C.PLUGINS_SAVED)
    } catch {
      setStoredCfg(storedCfg)
      setStatus(C.PLUGINS_ERROR)
    }
  }

  return (
    <section className="section" id="sec-plugins">
      <h2>{C.PLUGINS_HEADER}</h2>
      <div className="group-help">{C.PLUGINS_HELP}</div>
      {plugins.length === 0 ? (
        <div className="placeholder-line muted">{C.PLUGINS_EMPTY}</div>
      ) : (
        <div className="radio-group" role="radiogroup" aria-label={C.PLUGINS_HEADER}>
          {plugins.map((plugin) => (
            <RadioRow
              key={`${plugin.source}:${plugin.name}`}
              id={plugin.name}
              label={`${plugin.name}${plugin.version ? ` v${plugin.version}` : ''}`}
              isDefault={plugin.name === 'default'}
              checked={activePlugin === plugin.name}
              onChange={selectPlugin}
            />
          ))}
        </div>
      )}
      {status && <div className="tx-sm muted mt-2">{status}</div>}
    </section>
  )
}

// -------- §15 Diagnostics ------------------------------------------------
function DiagnosticsSection({ onResetClick }: { onResetClick: () => void }) {
  const C = COPY.SETTINGS
  const { logsDrawer, setLogsDrawer } = useStore()
  return (
    <section className="section" id="sec-diagnostics">
      <h2>{C.DIAG_HEADER}</h2>
      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="v">{C.DIAG_SHOW_LOGS}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>
            {C.DIAG_SHOW_LOGS_HINT}
          </div>
        </div>
        <button
          className={`switch${logsDrawer.enabled ? ' on' : ''}`}
          aria-label={C.DIAG_SHOW_LOGS}
          aria-checked={logsDrawer.enabled}
          role="switch"
          onClick={() =>
            setLogsDrawer({
              enabled: !logsDrawer.enabled,
              open: !logsDrawer.enabled ? true : logsDrawer.open
            })
          }
        />
      </div>

      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="v">{C.DIAG_LOG_LEVEL}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>
            {C.DIAG_LOG_LEVEL_HELP}
          </div>
        </div>
        <select className="select" disabled style={{ width: 120 }} value="info" onChange={() => {}}>
          <option>info</option>
        </select>
      </div>

      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="v">{C.DIAG_TELEMETRY}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>
            {C.DIAG_TELEMETRY_HELP}
          </div>
        </div>
        <button className="switch" aria-label={C.DIAG_TELEMETRY} disabled />
      </div>

      <div className="row mt-4" style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={() => alert('(mock) Would open: ~/Library/Logs/AgenticLLMVTuber')}
        >
          <Folder size={14} /> {C.DIAG_OPEN_FOLDER}
        </button>
        <button className="btn btn-destructive" onClick={onResetClick}>
          {C.DIAG_RESET}
        </button>
      </div>
    </section>
  )
}

// -------- §5 TTS / Voice out ---------------------------------------------
function TTSSection() {
  const C = COPY.SETTINGS
  return (
    <section className="section" id="sec-tts">
      <h2>{C.TTS_HEADER}</h2>
      <div className="kv-row">
        <span className="k">{C.TTS_ENGINE}</span>
        <span className="v">{C.TTS_ENGINE_VAL}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.TTS_VOICE}</span>
        <span className="v">{C.TTS_VOICE_VAL}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.TTS_OUTPUT}</span>
        <span className="v">{C.TTS_OUTPUT_VAL}</span>
      </div>
      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <span className="k">{C.TTS_LIPSYNC}</span>
        <span className="v">{C.TTS_LIPSYNC_VAL}</span>
      </div>
      <div className="tx-sm muted mt-2">{C.TTS_HELP}</div>
    </section>
  )
}

// -------- §16 About ------------------------------------------------------
function AboutSection() {
  const C = COPY.SETTINGS
  return (
    <section className="section" id="sec-about">
      <h2>{C.ABOUT_HEADER}</h2>
      <div className="kv-row">
        <span className="k">{C.ABOUT_VERSION}</span>
        <span className="v mono">{C.ABOUT_VERSION_VAL}</span>
      </div>
      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <span className="k">{C.ABOUT_CHANNEL}</span>
        <span className="v muted tx-sm">{C.ABOUT_CHANNEL_VAL}</span>
      </div>
      <div className="kv-row">
        <span className="k">Links</span>
        <span className="v">{C.ABOUT_LINKS}</span>
      </div>
    </section>
  )
}

// -------- §2-§13 placeholders -------------------------------------------
function PlaceholderSection({
  num,
  title,
  milestone,
  body
}: {
  num: number
  title: string
  milestone: number
  body: string
}) {
  return (
    <section className="section" id={`sec-${num}`}>
      <h2>{title}</h2>
      <div className="placeholder-line muted">
        Coming in milestone-{milestone}. {body}
      </div>
    </section>
  )
}

// -------- Reset confirmation dialog -------------------------------------
function ResetDialog({
  open,
  onCancel,
  onConfirm
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  const C = COPY.RESET
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="reset-title">
        <h3 id="reset-title">{C.TITLE}</h3>
        <p>{C.BODY}</p>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {C.CANCEL}
          </button>
          <button className="btn btn-destructive" onClick={onConfirm}>
            {C.CONFIRM}
          </button>
        </div>
      </div>
    </div>
  )
}

// -------- Settings root --------------------------------------------------
export function Settings() {
  const C = COPY.SETTINGS
  const { resetAll, setView } = useStore()
  const [resetOpen, setResetOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  const anchors = [
    { id: 'sec-connection', label: 'Connection' },
    { id: 'sec-2', label: 'Avatars' },
    { id: 'sec-plugins', label: 'Plugins' },
    { id: 'sec-4', label: 'VTube Studio' },
    { id: 'sec-tts', label: 'TTS' },
    { id: 'sec-appearance', label: 'Appearance' },
    { id: 'sec-diagnostics', label: 'Diagnostics' },
    { id: 'sec-about', label: 'About' }
  ]

  const [activeAnchor, setActiveAnchor] = useState<string>('sec-connection')
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const onScroll = (): void => {
      const y = root.scrollTop + 24
      let best = anchors[0]!.id
      for (const a of anchors) {
        const el = root.querySelector(`#${a.id}`) as HTMLElement | null
        if (el && el.offsetTop <= y) best = a.id
      }
      setActiveAnchor(best)
    }
    root.addEventListener('scroll', onScroll)
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (id: string): void => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector(`#${id}`) as HTMLElement | null
    if (el) root.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  }

  return (
    <div className="view">
      <div className="settings-scroll" ref={scrollRef}>
        <h1>{C.HEADER}</h1>
        <div className="anchor-pills">
          {anchors.map((a) => (
            <button
              key={a.id}
              className={`anchor-pill${activeAnchor === a.id ? ' active' : ''}`}
              onClick={() => goTo(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <ConnectionSection />

        <section className="section" id="sec-avatar-catalogs">
          <h2>{C.AVATAR_CATALOGS_HEADER}</h2>
          <div className="tx-sm muted mt-2">{C.AVATAR_CATALOGS_HELP}</div>
          <div className="row mt-2" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setView('avatar-import')}>
              {COPY.AVATAR_IMPORT.SETTINGS_BUTTON_LABEL}
            </button>
          </div>
        </section>

        <PluginSection />

        {C.PLACEHOLDERS.filter((p) => p.num < 5).map((p) => (
          <PlaceholderSection
            key={p.num}
            num={p.num}
            title={p.title}
            milestone={p.milestone}
            body={p.body}
          />
        ))}

        <TTSSection />
        {C.PLACEHOLDERS.filter((p) => p.num > 5).map((p) => (
          <PlaceholderSection
            key={p.num}
            num={p.num}
            title={p.title}
            milestone={p.milestone}
            body={p.body}
          />
        ))}
        <AppearanceSection />
        <DiagnosticsSection onResetClick={() => setResetOpen(true)} />
        <AboutSection />
      </div>
      <ResetDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetAll()
          setResetOpen(false)
        }}
      />
    </div>
  )
}
