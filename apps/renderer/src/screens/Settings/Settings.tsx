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
import { saveCompletedSetupConfig, type Provider, type ProviderConfig } from '@/state/setup-store'
import { useTheme, type ThemeMode, type LightAccent, type DarkBg, type DarkAccent } from '@/state/theme-provider'
import type { BodyMotionPluginSummary, StoredConfig } from '@preload-types'
import { ProviderSelect } from '@/screens/LLMSetup/ProviderSelect'
import { TestLog } from '@/screens/LLMSetup/TestLog'
import type { AvatarImportPlan } from '@contracts/avatar-import-plan'
import type { LogLevel } from '@preload-types'

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']

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
function normalizeProvider(providerId: string): Provider {
  if (providerId === 'lmstudio') return 'lm_studio'
  if (providerId === 'custom') return 'custom_openai'
  if (
    providerId === 'lm_studio' ||
    providerId === 'custom_openai' ||
    providerId === 'openai' ||
    providerId === 'anthropic' ||
    providerId === 'gemini'
  ) return providerId
  return 'lm_studio'
}

function ConnectionSection() {
  const C = COPY.SETTINGS
  const { llmConfig, refreshStatus } = useStore()
  const [retesting, setRetesting] = useState(false)
  const [storedCfg, setStoredCfg] = useState<StoredConfig | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string>('')
  const [testPhase, setTestPhase] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [logKey, setLogKey] = useState(0)
  const [form, setForm] = useState<ProviderConfig>({
    provider: 'lm_studio',
    endpointUrl: 'http://localhost:1234/v1',
    apiKey: '',
    modelName: ''
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    let cancelled = false
    window.api
      .getStoredConfig()
      .then((cfg) => {
        if (cancelled) return
        if (cfg && cfg.hasCompletedSetup) {
          setStoredCfg(cfg)
          setForm(cfg.provider)
        }
      })
      .catch(() => {
        /* leave storedCfg null; render store fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const providerId = storedCfg?.provider.provider ?? llmConfig.provider
  const endpoint = storedCfg?.provider.endpointUrl ?? llmConfig.endpoint
  const model = storedCfg?.provider.modelName ?? llmConfig.model
  const providerLabel =
    providerId === 'lm_studio' || providerId === 'lmstudio'
      ? 'LM Studio'
      : providerId === 'custom_openai' || providerId === 'custom'
        ? 'Custom OpenAI-compat'
        : providerId

  const onRetest = async (): Promise<void> => {
    setRetesting(true)
    setNotice('')
    try {
      await refreshStatus()
    } finally {
      setRetesting(false)
    }
  }

  const onEdit = (): void => {
    setForm(
      storedCfg?.provider ?? {
        provider: normalizeProvider(providerId),
        endpointUrl: endpoint,
        apiKey: llmConfig.apiKey,
        modelName: model
      }
    )
    setNotice('')
    setTestPhase('idle')
    setEditing(true)
  }

  const onProviderChange = (provider: Provider): void => {
    setForm((cur) => ({
      ...cur,
      provider,
      endpointUrl:
        provider === 'lm_studio' && !cur.endpointUrl ? 'http://localhost:1234/v1' : cur.endpointUrl,
      apiKey: provider === 'lm_studio' ? '' : cur.apiKey
    }))
  }

  const onTest = (): void => {
    setLogKey((k) => k + 1)
    setNotice('')
    setTestPhase('testing')
  }

  const onSave = async (): Promise<void> => {
    setSaving(true)
    setNotice('')
    try {
      const nextCfg: StoredConfig = {
        ...(storedCfg ?? {}),
        provider: {
          ...form,
          endpointUrl: form.endpointUrl.trim(),
          modelName: form.modelName.trim()
        },
        plugin: storedCfg?.plugin ?? { activePluginName: 'default' },
        hasCompletedSetup: true,
        schemaVersion: 1
      }
      await saveCompletedSetupConfig(nextCfg)
      setStoredCfg(nextCfg)
      setEditing(false)
      setTestPhase('idle')
      await refreshStatus()
      setNotice(C.CONN_SAVED)
    } catch {
      setNotice(C.CONN_ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="section" id="sec-connection">
      <h2>{C.CONN_HEADER}</h2>
      {!editing ? (
        <>
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
          <div className="row mt-2" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={onRetest} disabled={retesting}>
              {retesting ? COPY.STATUS.REFRESHING : C.CONN_REFRESH}
            </button>
            <button className="btn btn-secondary" onClick={onEdit}>
              {C.CONN_CHANGE}
            </button>
          </div>
        </>
      ) : (
        <div className="settings-form">
          <div className="field">
            <label className="label" htmlFor="provider">
              {COPY.LLM_SETUP.PROVIDER_LABEL}
            </label>
            <ProviderSelect value={form.provider} onChange={onProviderChange} />
          </div>

          <div className="field">
            <div className="field-row">
              <label className="label" htmlFor="settings-endpoint">
                {COPY.LLM_SETUP.ENDPOINT_LABEL}
              </label>
              <span className="helper">{COPY.SETUP.ENDPOINT_HELP}</span>
            </div>
            <input
              id="settings-endpoint"
              className="input"
              value={form.endpointUrl}
              onChange={(e) => setForm((f) => ({ ...f, endpointUrl: e.target.value }))}
              placeholder={COPY.LLM_SETUP.ENDPOINT_PLACEHOLDER}
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label className="label" htmlFor="settings-model">
                {COPY.LLM_SETUP.MODEL_LABEL}
              </label>
              <span className="helper">{COPY.LLM_SETUP.MODEL_HELPER}</span>
            </div>
            <input
              id="settings-model"
              className="input"
              value={form.modelName}
              onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
              placeholder={COPY.LLM_SETUP.MODEL_PLACEHOLDER}
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label className="label" htmlFor="settings-api-key">
                {COPY.LLM_SETUP.APIKEY_LABEL}
              </label>
              {form.provider === 'lm_studio' && (
                <span className="helper">{COPY.LLM_SETUP.APIKEY_HELPER_LMSTUDIO}</span>
              )}
            </div>
            <input
              id="settings-api-key"
              type="password"
              className="input"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              disabled={form.provider === 'lm_studio'}
              placeholder={form.provider === 'lm_studio' ? COPY.SETUP.APIKEY_PLACEHOLDER : 'sk-...'}
            />
          </div>

          <div className="row mt-2" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? C.CONN_SAVING : C.CONN_SAVE}
            </button>
            <button className="btn btn-secondary" onClick={onTest} disabled={testPhase === 'testing'}>
              {testPhase === 'success' ? C.CONN_TEST_AGAIN : C.CONN_TEST}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditing(false)
                setTestPhase('idle')
                setNotice('')
              }}
              disabled={saving}
            >
              {C.CONN_CANCEL}
            </button>
          </div>

          {testPhase !== 'idle' && (
            <TestLog
              key={logKey}
              form={form}
              onResult={(success) => setTestPhase(success ? 'success' : 'error')}
            />
          )}
        </div>
      )}
      {notice && <div className="tx-sm muted mt-2">{notice}</div>}
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
      <div className="row mt-2" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void window.api?.openHud?.()
          }}
        >
          {COPY.HUD.OPEN_HUD_BUTTON}
        </button>
        <span className="tx-sm muted">{COPY.HUD.OPEN_HUD_HELP}</span>
      </div>
      {status && <div className="tx-sm muted mt-2">{status}</div>}
    </section>
  )
}

// -------- §2 Avatars ------------------------------------------------------
function voiceLabel(plan: AvatarImportPlan): string {
  const voice = plan.voice
  if (!voice) return COPY.SETTINGS.AVATARS_NO_VOICE
  return [voice.backend, voice.model].filter(Boolean).join(' · ') || COPY.SETTINGS.AVATARS_NO_VOICE
}

function AvatarsSection() {
  const C = COPY.SETTINGS
  const { setAvatarImportPlan, setView, status } = useStore()
  const [currentId, setCurrentId] = useState<string>('')
  const [plan, setPlan] = useState<AvatarImportPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const hasSeenGreenSidecar = useRef(false)

  const loadCurrent = async (options: { showSpinner?: boolean } = {}): Promise<AvatarImportPlan | null> => {
    const showSpinner = options.showSpinner ?? true
    if (!window.api?.getCurrentAvatarId || !window.api?.getCurrentAvatarPlan) {
      setLoading(false)
      setCurrentId('')
      setPlan(null)
      return null
    }

    if (showSpinner) setLoading(true)

    try {
      const id = await window.api.getCurrentAvatarId()
      const normalizedId = id.trim()
      setCurrentId(normalizedId)
      if (!normalizedId) {
        setPlan(null)
        if (showSpinner) setLoading(false)
        return null
      }
    } catch {
      setCurrentId('')
      setPlan(null)
      if (showSpinner) setLoading(false)
      return null
    }

    try {
      const currentPlan = await window.api.getCurrentAvatarPlan()
      setPlan(currentPlan)
      if (currentPlan) setNotice('')
      return currentPlan
    } catch {
      setPlan(null)
      return null
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    void loadCurrent()
  }, [])

  useEffect(() => {
    if (status.sidecar !== 'green') {
      hasSeenGreenSidecar.current = false
      return
    }
    if (!hasSeenGreenSidecar.current) {
      hasSeenGreenSidecar.current = true
      return
    }
    if (!plan) void loadCurrent({ showSpinner: false })
  }, [status.sidecar, status.sidecarDetail, plan])

  const openImport = (): void => {
    setAvatarImportPlan(null)
    setView('avatar-import')
  }

  const editCurrent = async (): Promise<void> => {
    setNotice('')
    const currentPlan = plan ?? await loadCurrent({ showSpinner: false })
    if (!currentPlan) {
      setNotice(C.AVATARS_EDIT_UNAVAILABLE)
      return
    }
    setAvatarImportPlan(currentPlan)
    setView('avatar-import')
  }

  const hasCurrentId = currentId.trim().length > 0

  return (
    <section className="section" id="sec-avatars">
      <h2>{C.AVATARS_HEADER}</h2>
      <div className="group-help">{C.AVATARS_HELP}</div>
      {loading ? (
        <div className="placeholder-line muted">{C.AVATARS_LOADING}</div>
      ) : plan ? (
        <>
          <div className="kv-row">
            <span className="k">{C.AVATARS_ID}</span>
            <span className="v">{plan.avatar_id}</span>
          </div>
          <div className="kv-row">
            <span className="k">{C.AVATARS_NAME}</span>
            <span className="v">{plan.avatar_name}</span>
          </div>
          <div className="kv-row" style={{ alignItems: 'flex-start' }}>
            <span className="k">{C.AVATARS_SOURCE}</span>
            <span className="v mono tx-sm">{plan.source_rig_path}</span>
          </div>
          <div className="kv-row">
            <span className="k">{C.AVATARS_VARIANTS}</span>
            <span className="v">{plan.variants.length}</span>
          </div>
          <div className="kv-row">
            <span className="k">{C.AVATARS_EVENTS}</span>
            <span className="v">{plan.events.length}</span>
          </div>
          <div className="kv-row">
            <span className="k">{C.AVATARS_VOICE}</span>
            <span className="v">{voiceLabel(plan)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="kv-row">
            <span className="k">{C.AVATARS_ID}</span>
            <span className="v">{hasCurrentId ? currentId : C.AVATARS_UNKNOWN_ID}</span>
          </div>
          <div className="placeholder-line muted">
            {hasCurrentId ? C.AVATARS_DEGRADED : C.AVATARS_DEGRADED_UNKNOWN}
          </div>
        </>
      )}
      <div className="row mt-2" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={editCurrent} disabled={!hasCurrentId || loading}>
          {C.AVATARS_EDIT_CURRENT}
        </button>
        <button className="btn btn-secondary" onClick={openImport}>
          {C.AVATARS_IMPORT_REPLACE}
        </button>
      </div>
      {notice && <div className="tx-sm muted mt-2">{notice}</div>}
    </section>
  )
}

// -------- §4 VTube Studio -------------------------------------------------
function VTubeStudioSection() {
  const C = COPY.SETTINGS
  const { refreshStatus, restartSidecar, status } = useStore()
  const [busy, setBusy] = useState<'restart' | 'reset' | null>(null)
  const [notice, setNotice] = useState('')

  const onRestart = async (): Promise<void> => {
    setBusy('restart')
    setNotice('')
    try {
      await restartSidecar()
      setNotice(C.VTS_ACTION_DONE)
    } catch {
      setNotice(C.VTS_ACTION_ERROR)
    } finally {
      setBusy(null)
    }
  }

  const onResetAuth = async (): Promise<void> => {
    setBusy('reset')
    setNotice('')
    try {
      await window.api.resetVtsAuth()
      await refreshStatus()
      setNotice(C.VTS_ACTION_DONE)
    } catch {
      setNotice(C.VTS_ACTION_ERROR)
    } finally {
      setBusy(null)
    }
  }

  const isGreen = status.vts === 'green'

  return (
    <section className="section" id="sec-vts">
      <h2>{C.VTS_HEADER}</h2>
      <div className="group-help">{C.VTS_HELP}</div>
      <div className="kv-row">
        <span className="k">{C.VTS_STATUS}</span>
        <span className="v">
          <span className={`dot ${isGreen ? 'green' : status.vts === 'red' ? 'red' : 'amber'}`} /> {status.vtsDetail}
        </span>
      </div>
      <div className="kv-row">
        <span className="k">{C.VTS_WINDOW}</span>
        <span className="v">{isGreen ? C.VTS_WINDOW_DETECTED : C.VTS_WINDOW_MISSING}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.VTS_AUTH}</span>
        <span className="v">{isGreen ? C.VTS_AUTHENTICATED : C.VTS_NOT_AUTHENTICATED}</span>
      </div>
      <details className="mt-2">
        <summary className="v">{C.VTS_TROUBLESHOOTING}</summary>
        <div className="tx-sm muted mt-2">{C.VTS_RESET_HELP}</div>
        <div className="row mt-2" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onRestart} disabled={busy !== null}>
            {C.VTS_RESTART}
          </button>
          <button className="btn btn-secondary" onClick={onResetAuth} disabled={busy !== null}>
            {C.VTS_RESET_AUTH}
          </button>
        </div>
      </details>
      {notice && <div className="tx-sm muted mt-2">{notice}</div>}
    </section>
  )
}

// -------- §7 Conversation -------------------------------------------------
function ConversationSection() {
  const C = COPY.SETTINGS
  return (
    <section className="section" id="sec-conversation">
      <h2>{C.CONVERSATION_HEADER}</h2>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_MODE}</span>
        <span className="v">{C.CONVERSATION_MODE_VAL}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_RESET}</span>
        <span className="v">{C.CONVERSATION_RESET_VAL}</span>
      </div>
      <div className="tx-sm muted mt-2">{C.CONVERSATION_HELP}</div>
    </section>
  )
}

// -------- §8 Memory -------------------------------------------------------
function MemorySection() {
  const C = COPY.SETTINGS
  return (
    <section className="section" id="sec-memory" aria-disabled="true">
      <h2>{C.MEMORY_HEADER}</h2>
      <div className="kv-row">
        <span className="k">{C.MEMORY_STATUS}</span>
        <span className="v">{C.MEMORY_STATUS_VAL}</span>
      </div>
      <div className="placeholder-line muted">{C.MEMORY_HELP}</div>
    </section>
  )
}

// -------- §15 Diagnostics ------------------------------------------------
function DiagnosticsSection({ onResetClick }: { onResetClick: () => void }) {
  const C = COPY.SETTINGS
  const { logsDrawer, setLogsDrawer } = useStore()
  const [logLevel, setLogLevel] = useState<LogLevel>('info')
  const [logLevelStatus, setLogLevelStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    window.api
      ?.getLogLevel?.()
      .then((level) => {
        if (!cancelled) setLogLevel(level)
      })
      .catch(() => {
        /* keep default */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onLogLevelChange = async (level: LogLevel): Promise<void> => {
    setLogLevel(level)
    setLogLevelStatus('')
    try {
      await window.api.saveLogLevel(level)
    } catch {
      setLogLevelStatus(C.VTS_ACTION_ERROR)
    }
  }

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
          <div
            className="tx-sm muted"
            style={{ marginTop: 8, display: 'grid', gap: 4 }}
            aria-label={C.DIAG_LOG_LEVEL_DESCRIPTIONS_LABEL}
          >
            {C.DIAG_LOG_LEVEL_DESCRIPTIONS.map((item) => (
              <div key={item.id}>{item.label}: {item.description}</div>
            ))}
          </div>
        </div>
        <select
          className="select"
          style={{ width: 120 }}
          aria-label={C.DIAG_LOG_LEVEL}
          value={logLevel}
          onChange={(e) => void onLogLevelChange(e.target.value as LogLevel)}
        >
          {LOG_LEVELS.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>
      {logLevelStatus && <div className="tx-sm muted mt-2">{logLevelStatus}</div>}

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
  const { resetAll } = useStore()
  const [resetOpen, setResetOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  const anchors = [
    { id: 'sec-connection', label: 'Connection' },
    { id: 'sec-avatars', label: 'Avatars' },
    { id: 'sec-plugins', label: 'Plugins' },
    { id: 'sec-vts', label: 'VTube Studio' },
    { id: 'sec-tts', label: 'TTS' },
    { id: 'sec-conversation', label: 'Conversation' },
    { id: 'sec-memory', label: 'Memory' },
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

        <AvatarsSection />
        <PluginSection />
        <VTubeStudioSection />
        <TTSSection />
        {C.PLACEHOLDERS.filter((p) => p.num === 6).map((p) => (
          <PlaceholderSection
            key={p.num}
            num={p.num}
            title={p.title}
            milestone={p.milestone}
            body={p.body}
          />
        ))}
        <ConversationSection />
        <MemorySection />
        {C.PLACEHOLDERS.filter((p) => p.num > 8).map((p) => (
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
