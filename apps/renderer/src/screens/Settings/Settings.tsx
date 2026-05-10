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
import { useConversationHistory } from '@/state/conversation-history'
import { defaultAudioConfig, saveCompletedSetupConfig, type Provider, type ProviderConfig } from '@/state/setup-store'
import { useTheme, type ThemeMode, type LightAccent, type DarkBg, type DarkAccent } from '@/state/theme-provider'
import type { AudioProviderHealth, BodyMotionPluginSummary, PluginRuntimeStatus, StoredConfig } from '@preload-types'
import { ProviderSelect } from '@/screens/LLMSetup/ProviderSelect'
import { TestLog } from '@/screens/LLMSetup/TestLog'
import type { AvatarImportPlan } from '@contracts/avatar-import-plan'
import type { GptSoVitsProviderConfig, GptSoVitsTestSynthesisResult } from '@contracts/audio-provider'
import type { ReferenceAudioAsset, VoicePreset } from '@contracts/voice-preset'
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
        schemaVersion: 2,
        audio: storedCfg?.audio ?? defaultAudioConfig(),
        voicePresets: storedCfg?.voicePresets ?? [],
        referenceAudioAssets: storedCfg?.referenceAudioAssets ?? [],
        activePresetByAvatarSession: storedCfg?.activePresetByAvatarSession ?? {}
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
  const { markPluginRestartPending, refreshStatus, status: appStatus } = useStore()
  const [plugins, setPlugins] = useState<BodyMotionPluginSummary[]>([])
  const [storedCfg, setStoredCfg] = useState<StoredConfig | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<PluginRuntimeStatus | null>(null)
  const [status, setStatus] = useState<string>('')

  const refreshPlugins = async (): Promise<void> => {
    const [cfg, discovered, runtime] = await Promise.all([
      window.api.getStoredConfig(),
      window.api.listBodyMotionPlugins(),
      window.api.getPluginStatus?.().catch(() => null) ?? Promise.resolve(null)
    ])
    setStoredCfg(cfg)
    setPlugins(discovered)
    setRuntimeStatus(runtime)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    let cancelled = false
    refreshPlugins()
      .then(() => {
        if (cancelled) return
      })
      .catch(() => {
        if (!cancelled) setPlugins([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activePlugin = storedCfg?.plugin?.activePluginName || 'default'
  const cursorTrackingEnabled = storedCfg?.plugin?.cursorTrackingEnabled !== false

  const selectPlugin = async (name: string): Promise<void> => {
    if (!storedCfg || name === activePlugin) return
    const selected = plugins.find((plugin) => plugin.name === name)
    const nextCfg: StoredConfig = {
      ...storedCfg,
      plugin: { ...(storedCfg.plugin ?? { activePluginName: 'default' }), activePluginName: name }
    }
    setStoredCfg(nextCfg)
    setStatus(C.PLUGINS_SAVING)
    markPluginRestartPending(name)
    try {
      await window.api.saveStoredConfig(nextCfg)
      await refreshStatus()
      await refreshPlugins()
      setStatus(C.PLUGINS_SAVED)
    } catch {
      setStoredCfg(storedCfg)
      setStatus(
        selected?.valid === false
          ? `${C.PLUGINS_ERROR} ${selected.statusSummary ?? ''}`.trim()
          : C.PLUGINS_ERROR
      )
    }
  }

  const setCursorTracking = async (enabled: boolean): Promise<void> => {
    if (!storedCfg || enabled === cursorTrackingEnabled) return
    const nextCfg: StoredConfig = {
      ...storedCfg,
      plugin: {
        ...(storedCfg.plugin ?? { activePluginName: activePlugin }),
        activePluginName: activePlugin,
        cursorTrackingEnabled: enabled
      }
    }
    setStoredCfg(nextCfg)
    setStatus(C.PLUGINS_SAVING)
    try {
      await window.api.saveStoredConfig(nextCfg)
      await refreshStatus()
      await refreshPlugins()
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
          {plugins.map((plugin) => {
            const pluginValid = plugin.valid !== false
            return (
            <div key={`${plugin.source}:${plugin.name}`}>
              <RadioRow
                id={plugin.name}
                label={`${plugin.name}${plugin.version ? ` v${plugin.version}` : ''}${pluginValid ? '' : ' - invalid'}`}
                isDefault={plugin.name === 'default'}
                checked={activePlugin === plugin.name}
                disabled={plugin.selectable === false}
                onChange={selectPlugin}
                tooltip={pluginValid ? null : plugin.statusSummary ?? 'Plugin manifest is invalid.'}
              />
              {!pluginValid && (
                <details className="tx-sm muted" style={{ margin: '4px 0 8px 32px' }}>
                  <summary>{plugin.statusSummary ?? 'Invalid manifest'}</summary>
                  <div className="mono tx-sm" style={{ marginTop: 4 }}>{plugin.developerDetails}</div>
                </details>
              )}
            </div>
          )})}
        </div>
      )}
      <div className="kv-row">
        <span className="k">Runtime</span>
        <span className="v">
          <span className={`dot ${appStatus.plugin === 'green' ? 'green' : appStatus.plugin === 'amber' ? 'amber' : 'red'}`} />{' '}
          {runtimeStatus?.lifecycleState ?? appStatus.pluginLifecycleState}
        </span>
      </div>
      <div className="tx-sm muted mt-2">{runtimeStatus?.summary ?? appStatus.pluginDetail}</div>
      {(runtimeStatus?.developerDetails || appStatus.pluginDeveloperDetails) && (
        <details className="tx-sm muted mt-2">
          <summary>{COPY.STATUS.PLUGIN_DETAILS}</summary>
          <div className="mono tx-sm" style={{ marginTop: 4 }}>
            {runtimeStatus?.developerDetails ?? appStatus.pluginDeveloperDetails}
          </div>
        </details>
      )}
      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="v">{C.PLUGINS_CURSOR_TRACKING}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>
            {C.PLUGINS_CURSOR_TRACKING_HELP}
          </div>
        </div>
        <button
          className={`switch${cursorTrackingEnabled ? ' on' : ''}`}
          aria-label={C.PLUGINS_CURSOR_TRACKING}
          aria-checked={cursorTrackingEnabled}
          role="switch"
          onClick={() => void setCursorTracking(!cursorTrackingEnabled)}
          disabled={!storedCfg}
        />
      </div>
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
  const { activeSession, stats, clearAll } = useConversationHistory()
  const [clearOpen, setClearOpen] = useState(false)
  const [notice, setNotice] = useState('')
  return (
    <section className="section" id="sec-conversation">
      <h2>{C.CONVERSATION_HEADER}</h2>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_MODE}</span>
        <span className="v">{C.CONVERSATION_MODE_VAL}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_ACTIVE}</span>
        <span className="v">{activeSession.title}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_SESSIONS}</span>
        <span className="v">{stats.sessionCount}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_MESSAGES}</span>
        <span className="v">{stats.messageCount}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.CONVERSATION_RESET}</span>
        <span className="v">{C.CONVERSATION_RESET_VAL}</span>
      </div>
      <div className="tx-sm muted mt-2">{C.CONVERSATION_HELP}</div>
      <button className="btn btn-destructive mt-2" onClick={() => setClearOpen(true)}>
        {C.CONVERSATION_CLEAR}
      </button>
      {notice && <div className="tx-sm muted mt-2">{notice}</div>}
      <ConversationClearDialog
        open={clearOpen}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          void clearAll().then(() => {
            setNotice(C.CONVERSATION_CLEAR_DONE)
            setClearOpen(false)
          })
        }}
      />
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
          onClick={() => void window.api?.openLogFolder?.()}
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
type TtsProviderChoice = 'piper' | 'gpt_sovits'

function defaultGptSoVitsConfig(): GptSoVitsProviderConfig {
  return {
    provider_id: 'gpt_sovits',
    enabled: true,
    base_url: 'http://127.0.0.1:9880',
    request_timeout_ms: 30_000,
    launch: {
      mode: 'external',
      command: null,
      working_directory: null,
      auto_start: false
    },
    activation: {
      active_allowed: false,
      health_check_passed: false,
      test_synthesis_passed: false,
      last_health_checked_at: null,
      last_test_synthesis_at: null
    }
  }
}

function isNonLocalGptSoVitsUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '[::1]'
  } catch {
    return false
  }
}

function avatarSessionPresetKey(avatarId: string | null, sessionId: string | null): string {
  const avatar = avatarId && avatarId.trim().length > 0 ? avatarId.trim() : 'global'
  const session = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'global'
  return `avatar:${avatar}|session:${session}`
}

function createDraftVoicePreset(name: string, existing?: VoicePreset | null): VoicePreset {
  const now = new Date().toISOString()
  return {
    preset_id: existing?.preset_id ?? `preset-${Date.now()}`,
    name: name.trim() || 'Untitled voice preset',
    provider_id: 'gpt_sovits',
    piper_voice_model: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    gpt_sovits: existing?.gpt_sovits ?? {
      prompt_text: '',
      prompt_lang: 'auto',
      text_lang: 'auto',
      reference_audio_id: null,
      top_k: 15,
      top_p: 1,
      temperature: 1,
      speed_factor: 1,
      repetition_penalty: 1.35,
      text_split_method: 'cut5',
      batch_size: 1,
      media_type: 'wav',
      streaming_mode: false
    }
  }
}

function withSelectedReferenceAsset(preset: VoicePreset | null, asset: ReferenceAudioAsset | null): VoicePreset | null {
  if (!preset || !asset) return preset
  if (
    preset.gpt_sovits.reference_audio_id === asset.asset_id &&
    preset.gpt_sovits.prompt_text === asset.transcript_text &&
    preset.gpt_sovits.prompt_lang === asset.language
  ) {
    return preset
  }
  return {
    ...preset,
    gpt_sovits: {
      ...preset.gpt_sovits,
      reference_audio_id: asset.asset_id,
      prompt_text: asset.transcript_text,
      prompt_lang: asset.language
    }
  }
}

function playSynthesisPreview(result: GptSoVitsTestSynthesisResult): string | null {
  if (!result.ok || !result.audio_base64) return null
  const binary = atob(result.audio_base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  void audio.play().catch(() => undefined)
  return url
}

function TTSSection() {
  const C = COPY.SETTINGS
  const { activeSession } = useConversationHistory()
  const [audioStatus, setAudioStatus] = useState<AudioProviderHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [storedCfg, setStoredCfg] = useState<StoredConfig | null>(null)
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([])
  const [referenceAudioAssets, setReferenceAudioAssets] = useState<ReferenceAudioAsset[]>([])
  const [currentAvatarId, setCurrentAvatarId] = useState<string | null>(null)
  const [providerChoice, setProviderChoice] = useState<TtsProviderChoice>('piper')
  const [candidate, setCandidate] = useState<GptSoVitsProviderConfig>(defaultGptSoVitsConfig)
  const [healthPassed, setHealthPassed] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [activePresetByAvatarSession, setActivePresetByAvatarSession] = useState<Record<string, string>>({})
  const [presetName, setPresetName] = useState('')
  const [blockedDeletePreset, setBlockedDeletePreset] = useState<VoicePreset | null>(null)
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<VoicePreset | null>(null)
  const [referenceTranscript, setReferenceTranscript] = useState('')
  const [referenceLanguage, setReferenceLanguage] = useState<ReferenceAudioAsset['language'] | ''>('')
  const [selectedReferenceAssetId, setSelectedReferenceAssetId] = useState('')
  const [blockedReferenceDeleteCount, setBlockedReferenceDeleteCount] = useState<number | null>(null)
  const [confirmStopGptSoVits, setConfirmStopGptSoVits] = useState(false)
  const [statusText, setStatusText] = useState<string>(C.GPT_SOVITS_PROVIDER_NOT_READY)
  const [healthUrl, setHealthUrl] = useState('')
  const previewUrlRef = useRef<string | null>(null)

  const refreshAudioStatus = async (): Promise<void> => {
    setLoading(true)
    try {
      const status = await window.api.getAudioStatus()
      setAudioStatus(status)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAudioStatus()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    let cancelled = false
    Promise.all([
      window.api.getStoredConfig(),
      window.api.listVoicePresets?.() ?? Promise.resolve([]),
      window.api.getCurrentAvatarId?.().catch(() => null) ?? Promise.resolve(null),
      window.api.getGptSoVitsProcessStatus?.().catch(() => null) ?? Promise.resolve(null)
    ])
      .then(([cfg, presets, avatarId, processStatus]) => {
        if (cancelled) return
        setStoredCfg(cfg)
        const loadedPresets = presets.length > 0 ? presets : cfg?.voicePresets ?? []
        setVoicePresets(loadedPresets)
        setReferenceAudioAssets(cfg?.referenceAudioAssets ?? [])
        setActivePresetByAvatarSession(cfg?.activePresetByAvatarSession ?? {})
        setCurrentAvatarId(avatarId)
        const configuredGpt = cfg?.audio?.tts?.gpt_sovits ?? defaultGptSoVitsConfig()
        setCandidate(configuredGpt)
        setProviderChoice(cfg?.audio?.tts?.active_provider ?? 'piper')
        setHealthPassed(configuredGpt.activation.health_check_passed)
        setTestPassed(configuredGpt.activation.test_synthesis_passed)
        setSelectedPresetId(loadedPresets[0]?.preset_id ?? '')
        setPresetName(loadedPresets[0]?.name ?? '')
        const firstReferenceId = loadedPresets[0]?.gpt_sovits.reference_audio_id ?? cfg?.referenceAudioAssets?.[0]?.asset_id ?? ''
        setSelectedReferenceAssetId(firstReferenceId)
        const selectedReference = cfg?.referenceAudioAssets?.find((asset) => asset.asset_id === firstReferenceId)
        setReferenceTranscript(selectedReference?.transcript_text ?? loadedPresets[0]?.gpt_sovits.prompt_text ?? '')
        setReferenceLanguage(selectedReference?.language ?? loadedPresets[0]?.gpt_sovits.prompt_lang ?? '')
        setHealthUrl(processStatus?.healthUrl ?? '')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  const healthState = audioStatus?.state ?? 'unavailable'
  const healthClass = healthState === 'ok' ? 'green' : healthState === 'unavailable' ? 'amber' : 'red'
  const selectedPreset = voicePresets.find((preset) => preset.preset_id === selectedPresetId) ?? voicePresets[0] ?? null
  const selectedReferenceAsset = referenceAudioAssets.find((asset) => asset.asset_id === selectedReferenceAssetId) ?? null
  const testCandidatePreset = withSelectedReferenceAsset(selectedPreset, selectedReferenceAsset)
  const hasReferenceForTest = testCandidatePreset?.gpt_sovits.reference_audio_id !== null && testCandidatePreset?.gpt_sovits.reference_audio_id !== undefined
  const testSynthesisReady = healthPassed && testCandidatePreset !== null && hasReferenceForTest
  const activationReady = healthPassed && testPassed && testCandidatePreset !== null && hasReferenceForTest

  const saveConfig = async (nextCfg: StoredConfig): Promise<void> => {
    await window.api.saveStoredConfig(nextCfg)
    setStoredCfg(nextCfg)
  }

  const selectProvider = async (id: string): Promise<void> => {
    const provider = id as TtsProviderChoice
    setProviderChoice(provider)
    if (provider === 'piper') {
      const cfg = storedCfg ?? await window.api.getStoredConfig()
      if (!cfg) return
      const nextCfg: StoredConfig = {
        ...cfg,
        audio: {
          ...cfg.audio,
          tts: {
            ...cfg.audio.tts,
            active_provider: 'piper'
          }
        }
      }
      await saveConfig(nextCfg)
      setHealthPassed(false)
      setTestPassed(false)
      setStatusText(C.GPT_SOVITS_PROVIDER_NOT_READY)
    } else {
      setHealthPassed(false)
      setTestPassed(false)
      setStatusText(C.GPT_SOVITS_PROVIDER_NOT_READY)
    }
  }

  const updateCandidate = (patch: Partial<GptSoVitsProviderConfig>): void => {
    setCandidate((cur) => ({ ...cur, ...patch }))
    setHealthPassed(false)
    setTestPassed(false)
    setStatusText(C.GPT_SOVITS_PROVIDER_NOT_READY)
  }

  const runHealthCheck = async (): Promise<void> => {
    const status = await window.api.checkGptSoVitsHealth({ config: candidate })
    const passed = status.state === 'ok'
    setAudioStatus(status)
    setHealthPassed(passed)
    setTestPassed(false)
    setStatusText(passed ? C.GPT_SOVITS_HEALTH_PASSED_TEST_PENDING : C.GPT_SOVITS_CANDIDATE_FAILURE)
  }

  const runTestSynthesis = async (): Promise<void> => {
    if (!testCandidatePreset || !testCandidatePreset.gpt_sovits.reference_audio_id) {
      setTestPassed(false)
      setStatusText(C.GPT_SOVITS_REFERENCE_PATH_FAILURE)
      return
    }
    const result = await window.api.testGptSoVitsSynthesis({
      config: candidate,
      preset: testCandidatePreset,
      text: 'This is a GPT-SoVITS test synthesis.'
    })
    if (!result.ok) {
      setTestPassed(false)
      setStatusText(
        result.failure?.state === 'misconfigured'
          ? C.GPT_SOVITS_REFERENCE_PATH_FAILURE
          : C.GPT_SOVITS_CANDIDATE_FAILURE
      )
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = playSynthesisPreview(result)
    setTestPassed(true)
    setStatusText(C.GPT_SOVITS_PREVIEW_READY)
  }

  const activateGptSoVits = async (): Promise<void> => {
    if (!activationReady || !testCandidatePreset) return
    const cfg = storedCfg ?? await window.api.getStoredConfig()
    if (!cfg) return
    const presetToActivate = testCandidatePreset
    if (selectedPreset && presetToActivate !== selectedPreset) {
      const nextPresets = await window.api.saveVoicePreset(presetToActivate)
      setVoicePresets(nextPresets)
    }
    const activatedCandidate: GptSoVitsProviderConfig = {
      ...candidate,
      activation: {
        active_allowed: true,
        health_check_passed: true,
        test_synthesis_passed: true,
        last_health_checked_at: new Date().toISOString(),
        last_test_synthesis_at: new Date().toISOString()
      }
    }
    const activePresetKey = avatarSessionPresetKey(currentAvatarId, activeSession.id)
    const nextActivePresetByAvatarSession = {
      ...(cfg.activePresetByAvatarSession ?? {}),
      [activePresetKey]: presetToActivate.preset_id
    }
    const nextCfg: StoredConfig = {
      ...cfg,
      activePresetByAvatarSession: nextActivePresetByAvatarSession,
      audio: {
        ...cfg.audio,
        tts: {
          ...cfg.audio.tts,
          active_provider: 'gpt_sovits',
          gpt_sovits: activatedCandidate
        }
      }
    }
    await saveConfig(nextCfg)
    setActivePresetByAvatarSession(nextActivePresetByAvatarSession)
    await window.api.setActiveVoicePresetForAvatarSession?.(currentAvatarId, activeSession.id, presetToActivate.preset_id)
    setCandidate(activatedCandidate)
    setStatusText(C.GPT_SOVITS_ACTIVATION_SUCCESS)
  }

  const runStart = async (): Promise<void> => {
    await window.api.startGptSoVits?.({
      command: candidate.launch.command,
      workingDirectory: candidate.launch.working_directory,
      healthUrl: healthUrl || null
    })
  }

  const savePreset = async (): Promise<void> => {
    const draftPreset = createDraftVoicePreset(presetName, selectedPreset)
    const nextPreset = selectedReferenceAsset
      ? {
          ...draftPreset,
          gpt_sovits: {
            ...draftPreset.gpt_sovits,
            reference_audio_id: selectedReferenceAsset.asset_id,
            prompt_text: selectedReferenceAsset.transcript_text,
            prompt_lang: selectedReferenceAsset.language
          }
        }
      : draftPreset
    try {
      const savedPresets = await window.api.saveVoicePreset(nextPreset)
      const persistedPresets = await (window.api.listVoicePresets?.().catch(() => savedPresets) ?? Promise.resolve(savedPresets))
      const nextPresets = persistedPresets.length > 0 ? persistedPresets : savedPresets
      setVoicePresets(nextPresets)
      setStoredCfg((cur) => cur ? { ...cur, voicePresets: nextPresets } : cur)
      setSelectedPresetId(nextPreset.preset_id)
      setPresetName(nextPreset.name)
      setStatusText(
        nextPresets.some((preset) => preset.preset_id === nextPreset.preset_id)
          ? C.VOICE_PRESET_SAVE_SUCCESS
          : C.VOICE_PRESET_SAVE_FAILURE
      )
    } catch {
      setStatusText(C.VOICE_PRESET_SAVE_FAILURE)
    }
  }

  const selectVoicePreset = async (presetId: string): Promise<void> => {
    const preset = voicePresets.find((item) => item.preset_id === presetId)
    setSelectedPresetId(presetId)
    setPresetName(preset?.name ?? '')
    setSelectedReferenceAssetId(preset?.gpt_sovits.reference_audio_id ?? '')
    const referenceAsset = referenceAudioAssets.find((asset) => asset.asset_id === preset?.gpt_sovits.reference_audio_id)
    setReferenceTranscript(referenceAsset?.transcript_text ?? preset?.gpt_sovits.prompt_text ?? '')
    setReferenceLanguage(referenceAsset?.language ?? preset?.gpt_sovits.prompt_lang ?? '')
    const map = await window.api.setActiveVoicePresetForAvatarSession?.(currentAvatarId, activeSession.id, presetId)
    if (map) setActivePresetByAvatarSession(map)
  }

  const requestDeletePreset = (): void => {
    if (!selectedPreset) return
    const key = avatarSessionPresetKey(currentAvatarId, activeSession.id)
    if (activePresetByAvatarSession[key] === selectedPreset.preset_id) {
      setBlockedDeletePreset(selectedPreset)
      return
    }
    setConfirmDeletePreset(selectedPreset)
  }

  const confirmDeleteSelectedPreset = async (): Promise<void> => {
    if (!confirmDeletePreset) return
    const nextPresets = await window.api.deleteVoicePreset(confirmDeletePreset.preset_id)
    setVoicePresets(nextPresets)
    setSelectedPresetId(nextPresets[0]?.preset_id ?? '')
    setPresetName(nextPresets[0]?.name ?? '')
    setConfirmDeletePreset(null)
  }

  const importReferenceAudio = async (): Promise<void> => {
    if (!referenceTranscript.trim() || !referenceLanguage) return
    const asset = await window.api.pickAndImportReferenceAudio?.({
      transcriptText: referenceTranscript.trim(),
      language: referenceLanguage as ReferenceAudioAsset['language']
    })
    if (!asset) return
    setReferenceAudioAssets((assets) => [...assets.filter((item) => item.asset_id !== asset.asset_id), asset])
    setSelectedReferenceAssetId(asset.asset_id)
    if (selectedPreset) {
      const nextPreset = {
        ...selectedPreset,
        gpt_sovits: {
          ...selectedPreset.gpt_sovits,
          reference_audio_id: asset.asset_id,
          prompt_text: asset.transcript_text,
          prompt_lang: asset.language
        }
      }
      const nextPresets = await window.api.saveVoicePreset(nextPreset)
      setVoicePresets(nextPresets)
    }
  }

  const confirmStopAppLaunchedGptSoVits = async (): Promise<void> => {
    await window.api.stopGptSoVits?.()
    setConfirmStopGptSoVits(false)
  }

  const requestDeleteReferenceAudio = async (asset: ReferenceAudioAsset): Promise<void> => {
    const inUseCount = voicePresets.filter((preset) => preset.gpt_sovits.reference_audio_id === asset.asset_id).length
    if (inUseCount > 0) {
      setBlockedReferenceDeleteCount(inUseCount)
      return
    }
    const nextAssets = await window.api.deleteReferenceAudio?.(asset.asset_id)
    if (nextAssets) setReferenceAudioAssets(nextAssets)
  }

  return (
    <section className="section" id="sec-tts">
      <h2>{C.TTS_HEADER}</h2>
      <div className="group-label">{C.TTS_PROVIDER_GROUP}</div>
      <div className="radio-group" role="radiogroup" aria-label={C.TTS_PROVIDER_GROUP}>
        <RadioRow
          id="piper"
          label={`${C.TTS_PROVIDER_PIPER} — ${C.TTS_PROVIDER_PIPER_HELP}`}
          checked={providerChoice === 'piper'}
          onChange={(id) => void selectProvider(id)}
        />
        <RadioRow
          id="gpt_sovits"
          label={`${C.TTS_PROVIDER_GPT_SOVITS} — ${C.TTS_PROVIDER_GPT_HELP}`}
          checked={providerChoice === 'gpt_sovits'}
          onChange={(id) => void selectProvider(id)}
        />
      </div>
      <div className="kv-row">
        <span className="k">{C.TTS_ENGINE}</span>
        <span className="v">{providerChoice === 'gpt_sovits' ? C.TTS_PROVIDER_GPT_SOVITS : C.TTS_ENGINE_VAL}</span>
      </div>
      {providerChoice === 'gpt_sovits' && (
        <div className="settings-form tts-setup-panel">
          <div className="group-label">{C.GPT_SOVITS_SETUP_HEADER}</div>
          <div className="field">
            <label className="label" htmlFor="gpt-sovits-base-url">{C.GPT_SOVITS_BASE_URL}</label>
            <input
              id="gpt-sovits-base-url"
              className="input"
              value={candidate.base_url}
              onChange={(e) => updateCandidate({ base_url: e.target.value })}
            />
          </div>
          {isNonLocalGptSoVitsUrl(candidate.base_url) && <div className="banner warn tts-inline-banner">{C.GPT_SOVITS_NON_LOCAL_WARNING}</div>}
          <div className="field">
            <label className="label" htmlFor="gpt-sovits-mode">{C.GPT_SOVITS_CONNECTION_MODE}</label>
            <select
              id="gpt-sovits-mode"
              className="select"
              value={candidate.launch.mode}
              onChange={(e) => updateCandidate({
                launch: { ...candidate.launch, mode: e.target.value as 'external' | 'app_managed' }
              })}
            >
              <option value="external">{C.GPT_SOVITS_EXTERNAL_MODE}</option>
              <option value="app_managed">{C.GPT_SOVITS_APP_MANAGED_MODE}</option>
            </select>
          </div>
          {candidate.launch.mode === 'app_managed' ? (
            <>
              <div className="field">
                <label className="label" htmlFor="gpt-sovits-command">{C.GPT_SOVITS_COMMAND}</label>
                <input id="gpt-sovits-command" className="input" value={candidate.launch.command ?? ''} onChange={(e) => updateCandidate({ launch: { ...candidate.launch, command: e.target.value } })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="gpt-sovits-cwd">{C.GPT_SOVITS_WORKING_DIRECTORY}</label>
                <input id="gpt-sovits-cwd" className="input" value={candidate.launch.working_directory ?? ''} onChange={(e) => updateCandidate({ launch: { ...candidate.launch, working_directory: e.target.value } })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="gpt-sovits-health-url">{C.GPT_SOVITS_HEALTH_URL}</label>
                <input id="gpt-sovits-health-url" className="input" value={healthUrl} onChange={(e) => setHealthUrl(e.target.value)} />
              </div>
              <div className="row mt-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" type="button" onClick={() => void runStart()}>{C.GPT_SOVITS_START}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setConfirmStopGptSoVits(true)}>{C.GPT_SOVITS_STOP_APP_LAUNCHED}</button>
                <button className="btn btn-secondary" type="button" onClick={() => void window.api.restartGptSoVits?.({ command: candidate.launch.command, workingDirectory: candidate.launch.working_directory, healthUrl: healthUrl || null })}>{C.GPT_SOVITS_RESTART_APP_LAUNCHED}</button>
              </div>
            </>
          ) : (
            <div className="tx-sm muted mt-2">{C.GPT_SOVITS_EXTERNAL_STOP_HELP}</div>
          )}
          <div className="row mt-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" type="button" onClick={() => void runHealthCheck()}>{C.GPT_SOVITS_HEALTH_CHECK}</button>
            <button className="btn btn-primary" type="button" onClick={() => void runTestSynthesis()} disabled={!testSynthesisReady}>{C.GPT_SOVITS_TEST_SYNTHESIS}</button>
            <button className="btn btn-primary" type="button" onClick={() => void activateGptSoVits()} disabled={!activationReady}>{C.GPT_SOVITS_ACTIVATE_PRESET}</button>
          </div>
          <div className="tx-sm muted mt-2">{statusText}</div>
          <div className="group-label mt-4">{C.VOICE_PRESETS_HEADER}</div>
          {voicePresets.length === 0 ? (
            <div className="preset-card">
              <div className="semibold">{C.VOICE_PRESETS_EMPTY_HEAD}</div>
              <div className="tx-sm muted">{C.VOICE_PRESETS_EMPTY_BODY}</div>
            </div>
          ) : (
            <div className="radio-group" role="radiogroup" aria-label={C.VOICE_PRESETS_HEADER}>
              {voicePresets.map((preset) => (
                <RadioRow
                  key={preset.preset_id}
                  id={preset.preset_id}
                  label={`${preset.name} — ${preset.provider_id} · ${preset.gpt_sovits.text_lang}`}
                  checked={selectedPreset?.preset_id === preset.preset_id}
                  onChange={(id) => void selectVoicePreset(id)}
                />
              ))}
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="voice-preset-name">{C.VOICE_PRESET_NAME}</label>
            <input id="voice-preset-name" className="input" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          </div>
          <div className="row mt-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" type="button" onClick={() => void savePreset()}>{C.VOICE_PRESET_SAVE}</button>
            <button className="btn btn-destructive" type="button" onClick={requestDeletePreset} disabled={!selectedPreset}>{C.VOICE_PRESET_DELETE}</button>
          </div>
          <div className="tx-sm muted mt-2">{C.VOICE_PRESET_ACTIVE_NOTE}</div>
          <div className="group-label mt-4">{C.REFERENCE_AUDIO_HEADER}</div>
          <div className="field">
            <label className="label" htmlFor="reference-audio-transcript">{C.REFERENCE_AUDIO_TRANSCRIPT}</label>
            <textarea id="reference-audio-transcript" className="input" value={referenceTranscript} onChange={(e) => setReferenceTranscript(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="reference-audio-language">{C.REFERENCE_AUDIO_LANGUAGE}</label>
            <select id="reference-audio-language" className="select" value={referenceLanguage} onChange={(e) => setReferenceLanguage(e.target.value as ReferenceAudioAsset['language'])}>
              <option value="">Select language</option>
              <option value="auto">auto</option>
              <option value="en">en</option>
              <option value="ja">ja</option>
              <option value="zh">zh</option>
              <option value="ko">ko</option>
              <option value="yue">yue</option>
            </select>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void importReferenceAudio()}
            disabled={!referenceTranscript.trim() || !referenceLanguage}
          >
            {C.REFERENCE_AUDIO_IMPORT}
          </button>
          <div className="reference-audio-list mt-2">
            {referenceAudioAssets.map((asset) => (
              <div className="preset-card" key={asset.asset_id}>
                <div className="between">
                  <div>
                    <label className="radio-row" htmlFor={`reference-audio-${asset.asset_id}`}>
                      <input
                        id={`reference-audio-${asset.asset_id}`}
                        type="radio"
                        name="reference-audio-selection"
                        checked={selectedReferenceAssetId === asset.asset_id}
                        onChange={() => {
                          setSelectedReferenceAssetId(asset.asset_id)
                          setReferenceTranscript(asset.transcript_text)
                          setReferenceLanguage(asset.language)
                        }}
                      />
                      <span>{asset.display_basename}</span>
                    </label>
                    <div className="tx-sm muted">{asset.managed_path_token}</div>
                  </div>
                  <button className="btn btn-destructive" type="button" onClick={() => void requestDeleteReferenceAudio(asset)}>{C.REFERENCE_AUDIO_DELETE}</button>
                </div>
                <div className="validation-grid mt-2" aria-label="Reference audio validation">
                  <span>{C.REFERENCE_AUDIO_VALIDATION_FORMAT}</span><span>{asset.format}</span>
                  <span>{C.REFERENCE_AUDIO_VALIDATION_DURATION}</span><span>{Math.round(asset.duration_ms / 1000)}s</span>
                  <span>{C.REFERENCE_AUDIO_VALIDATION_METADATA}</span><span>{asset.language}</span>
                  <span>{C.REFERENCE_AUDIO_VALIDATION_SERVER_ACCESS}</span><span>{testPassed ? 'ok' : C.GPT_SOVITS_PROVIDER_NOT_READY}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="kv-row">
        <span className="k">{C.TTS_VOICE}</span>
        <span className="v">{selectedPreset?.name ?? audioStatus?.detail?.replace(/^voice=/, '') ?? C.TTS_VOICE_VAL}</span>
      </div>
      <div className="kv-row">
        <span className="k">Health</span>
        <span className="v">
          <span className={`dot ${healthClass}`} /> {healthState}
        </span>
      </div>
      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <span className="k">Summary</span>
        <span className="v">{audioStatus?.summary ?? 'Audio status unavailable.'}</span>
      </div>
      <div className="kv-row">
        <span className="k">{C.TTS_OUTPUT}</span>
        <span className="v">{C.TTS_OUTPUT_VAL}</span>
      </div>
      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <span className="k">{C.TTS_LIPSYNC}</span>
        <span className="v">{C.TTS_LIPSYNC_VAL}</span>
      </div>
      <button className="btn btn-secondary mt-2" onClick={() => void refreshAudioStatus()} disabled={loading}>
        {loading ? COPY.STATUS.REFRESHING : C.CONN_REFRESH}
      </button>
      <div className="tx-sm muted mt-2">{C.TTS_HELP}</div>
      {blockedDeletePreset && (
        <div className="dialog-overlay">
          <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="voice-preset-delete-blocked-title">
            <h3 id="voice-preset-delete-blocked-title">{C.VOICE_PRESET_DELETE_BLOCKED}</h3>
            <p>{blockedDeletePreset.name}</p>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setBlockedDeletePreset(null)}>{C.VOICE_PRESET_DELETE_CANCEL}</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeletePreset && (
        <div className="dialog-overlay">
          <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="voice-preset-delete-title">
            <h3 id="voice-preset-delete-title">{C.VOICE_PRESET_DELETE}</h3>
            <p>{confirmDeletePreset.name}</p>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeletePreset(null)}>{C.VOICE_PRESET_DELETE_CANCEL}</button>
              <button className="btn btn-destructive" onClick={() => void confirmDeleteSelectedPreset()}>{C.VOICE_PRESET_DELETE_CONFIRM}</button>
            </div>
          </div>
        </div>
      )}
      {blockedReferenceDeleteCount !== null && (
        <div className="dialog-overlay">
          <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="reference-audio-delete-blocked-title">
            <h3 id="reference-audio-delete-blocked-title">{C.REFERENCE_AUDIO_DELETE_BLOCKED(blockedReferenceDeleteCount)}</h3>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setBlockedReferenceDeleteCount(null)}>{C.REFERENCE_AUDIO_DELETE_CANCEL}</button>
            </div>
          </div>
        </div>
      )}
      {confirmStopGptSoVits && (
        <div className="dialog-overlay">
          <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="gpt-sovits-stop-title">
            <h3 id="gpt-sovits-stop-title">{C.GPT_SOVITS_STOP_APP_LAUNCHED}</h3>
            <p>{C.GPT_SOVITS_STOP_CONFIRM}</p>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setConfirmStopGptSoVits(false)}>{C.REFERENCE_AUDIO_DELETE_CANCEL}</button>
              <button className="btn btn-destructive" onClick={() => void confirmStopAppLaunchedGptSoVits()}>{C.GPT_SOVITS_STOP_APP_LAUNCHED}</button>
            </div>
          </div>
        </div>
      )}
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

function ConversationClearDialog({
  open,
  onCancel,
  onConfirm
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  const C = COPY.SETTINGS
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="conversation-clear-title">
        <h3 id="conversation-clear-title">{C.CONVERSATION_CLEAR_TITLE}</h3>
        <p>{C.CONVERSATION_CLEAR_BODY}</p>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {COPY.RESET.CANCEL}
          </button>
          <button className="btn btn-destructive" onClick={onConfirm}>
            {C.CONVERSATION_CLEAR_CONFIRM}
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
