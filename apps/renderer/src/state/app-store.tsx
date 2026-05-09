/* SPEC §State machine — single store hydrated from Electron safeStorage IPC,
 * Electron-store preferences, and real sidecar lifecycle/status APIs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction
} from 'react'
import type { AvatarImportPlan } from '@contracts/avatar-import-plan'
import { worstOf, type StatusOverall, type StatusSnapshot, type StatusValue } from './status-types'
import type { PluginRuntimeStatus, Provider, StoredConfig, VtsStatus } from '@preload-types'
import { defaultAudioConfig } from './setup-store'
import { ConversationHistoryProvider } from './conversation-history'

export type View = 'chat' | 'agent' | 'settings' | 'avatar-import'

export interface LLMConfig {
  provider: string
  endpoint: string
  model: string
  apiKey: string
}

export interface LogsDrawerState {
  enabled: boolean
  open: boolean
  height: number
}

export interface Banners {
  llm: boolean
  vts: boolean
  vtsAuth: boolean
  sidecarRepeat: boolean
  tts: boolean
}

export interface Toast {
  id: string
  text: string
}

interface AppStoreValue {
  hasCompletedSetup: boolean
  completeSetup: (cfg: LLMConfig) => void
  llmConfig: LLMConfig
  setLlmConfig: (cfg: LLMConfig) => void
  view: View
  setView: (v: View) => void
  historyOpen: boolean
  setHistoryOpen: (b: boolean) => void
  statusOpen: boolean
  setStatusOpen: (b: boolean) => void
  agentToggle: boolean
  setAgentToggle: (b: boolean) => void
  logsDrawer: LogsDrawerState
  setLogsDrawer: (patch: Partial<LogsDrawerState>) => void
  showThreadList: boolean
  setShowThreadList: Dispatch<SetStateAction<boolean>>
  avatarImportPlan: AvatarImportPlan | null
  setAvatarImportPlan: Dispatch<SetStateAction<AvatarImportPlan | null>>
  status: StatusSnapshot
  statusOverall: StatusOverall
  refreshStatus: () => Promise<void>
  markPluginRestartPending: (pluginName: string) => void
  restartSidecar: () => Promise<void>
  banners: Banners
  setBanners: (patch: Partial<Banners>) => void
  toasts: Toast[]
  pushToast: (toast: { text: string; ttlMs?: number }) => void
  setStatusForDev: (patch: Partial<StatusSnapshot>) => void
  resetAll: () => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'lmstudio',
  endpoint: 'http://localhost:1234/v1',
  model: '',
  apiKey: ''
}

const DEFAULT_LOGS: LogsDrawerState = {
  enabled: false,
  open: false,
  height: 200
}

const DEFAULT_STATUS: StatusSnapshot = {
  llm: 'amber',
  vts: 'amber',
  sidecar: 'amber',
  plugin: 'amber',
  llmDetail: 'loading setup',
  vtsDetail: 'checking VTS status',
  sidecarDetail: 'starting...',
  pluginDetail: 'checking plugin status',
  pluginLifecycleState: 'unknown/loading',
  pluginDeveloperDetails: null
}

function providerLabel(provider: string): string {
  if (provider === 'lm_studio' || provider === 'lmstudio') return 'LM Studio'
  if (provider === 'custom_openai' || provider === 'custom') return 'Custom OpenAI-compatible'
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'anthropic') return 'Anthropic'
  if (provider === 'gemini') return 'Gemini'
  return provider || 'unknown provider'
}

function storedToLlmConfig(cfg: StoredConfig): LLMConfig {
  return {
    provider: cfg.provider.provider,
    endpoint: cfg.provider.endpointUrl,
    model: cfg.provider.modelName,
    apiKey: cfg.provider.apiKey
  }
}

function llmConfigToStoredConfig(cfg: LLMConfig, completed: boolean): StoredConfig {
  const provider =
    cfg.provider === 'lmstudio'
      ? 'lm_studio'
      : cfg.provider === 'custom'
        ? 'custom_openai'
        : cfg.provider
  return {
    provider: {
      provider: provider as Provider,
      endpointUrl: cfg.endpoint,
      apiKey: cfg.apiKey,
      modelName: cfg.model
    },
    plugin: { activePluginName: 'default' },
    hasCompletedSetup: completed,
    schemaVersion: 2,
    audio: defaultAudioConfig()
  }
}

function llmStatusFromConfig(cfg: StoredConfig | null): Pick<StatusSnapshot, 'llm' | 'llmDetail'> {
  if (!cfg || !cfg.hasCompletedSetup) {
    return { llm: 'amber', llmDetail: 'setup not complete' }
  }
  const model = cfg.provider.modelName.trim() || 'auto-detect'
  return { llm: 'green', llmDetail: `${model} · ${providerLabel(cfg.provider.provider)}` }
}

function vtsStatusToSnapshot(vts: VtsStatus): Pick<StatusSnapshot, 'vts' | 'vtsDetail'> {
  if (vts.state === 'authenticated') {
    return { vts: 'green', vtsDetail: vts.detail }
  }
  if (vts.state === 'auth_pending' || vts.state === 'sidecar_unconfigured') {
    return { vts: 'amber', vtsDetail: vts.detail }
  }
  return { vts: 'red', vtsDetail: vts.detail }
}

function pluginStatusToSnapshot(
  plugin: PluginRuntimeStatus
): Pick<StatusSnapshot, 'plugin' | 'pluginDetail' | 'pluginLifecycleState' | 'pluginDeveloperDetails'> {
  const lifecycle = plugin.lifecycleState
  const statusValue: StatusValue =
    lifecycle === 'active'
      ? 'green'
      : lifecycle === 'restart pending' || lifecycle === 'unknown/loading'
        ? 'amber'
        : 'red'
  const selected = plugin.selectedPlugin ? `${plugin.selectedPlugin}: ` : ''
  return {
    plugin: statusValue,
    pluginDetail: `${selected}${plugin.summary}`,
    pluginLifecycleState: lifecycle,
    pluginDeveloperDetails: plugin.developerDetails ?? null
  }
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [hasCompletedSetup, setHasCompletedSetup] = useState<boolean>(false)
  const [llmConfig, setLlmConfigState] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
  const [view, setView] = useState<View>('chat')
  const [historyOpen, setHistoryOpen] = useState<boolean>(false)
  const [statusOpen, setStatusOpen] = useState<boolean>(false)
  const [agentToggle, setAgentToggle] = useState<boolean>(false)
  const [logsDrawer, setLogsDrawerState] = useState<LogsDrawerState>(DEFAULT_LOGS)
  const [showThreadList, setShowThreadList] = useState<boolean>(false)
  const [avatarImportPlan, setAvatarImportPlan] = useState<AvatarImportPlan | null>(null)

  const [status, setStatus] = useState<StatusSnapshot>(DEFAULT_STATUS)

  const patchStatus = useCallback((patch: Partial<StatusSnapshot>) => {
    setStatus((cur) => ({ ...cur, ...patch }))
  }, [])

  const refreshStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !window.api) return
    const [cfg, readyUrl, vts, plugin] = await Promise.all([
      window.api.getStoredConfig ? window.api.getStoredConfig().catch(() => null) : Promise.resolve(null),
      window.api.getReadyUrl ? window.api.getReadyUrl().catch(() => null) : Promise.resolve(null),
      window.api.getVtsStatus
        ? window.api.getVtsStatus().catch(() => ({
            state: 'unavailable' as const,
            detail: 'VTS status unavailable.',
            authenticated: false,
            windowDetected: false
          }))
        : Promise.resolve(null),
      window.api.getPluginStatus
        ? window.api.getPluginStatus().catch(() => ({
            selectedPlugin: null,
            loadedPlugin: null,
            lifecycleState: 'unknown/loading' as const,
            summary: 'Plugin status unavailable.',
            developerDetails: null,
            fallbackActive: false,
            chatAvailable: true
          }))
        : Promise.resolve(null)
    ])
    if (cfg?.hasCompletedSetup) {
      setHasCompletedSetup(true)
      setLlmConfigState(storedToLlmConfig(cfg))
    } else if (cfg === null) {
      setHasCompletedSetup(false)
    }
    patchStatus({
      ...llmStatusFromConfig(cfg ?? null),
      sidecar: readyUrl ? 'green' : 'amber',
      sidecarDetail: readyUrl ?? 'starting...',
      ...(vts ? vtsStatusToSnapshot(vts) : {}),
      ...(plugin ? pluginStatusToSnapshot(plugin) : {})
    })
  }, [patchStatus])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.getChromeState) return
    let cancelled = false
    window.api
      .getChromeState()
      .then((chrome) => {
        if (cancelled) return
        setLogsDrawerState({
          enabled: chrome.logsDrawerEnabled,
          open: !chrome.logsDrawerCollapsed,
          height: chrome.logsDrawerHeight
        })
      })
      .catch(() => {
        /* keep defaults */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const [banners, setBanners] = useState<Banners>({
    llm: false,
    vts: false,
    vtsAuth: false,
    sidecarRepeat: false,
    tts: false
  })
  const patchBanners = useCallback((patch: Partial<Banners>) => {
    setBanners((cur) => ({ ...cur, ...patch }))
  }, [])

  const [toasts, setToasts] = useState<Toast[]>([])
  const pushToast = useCallback((toast: { text: string; ttlMs?: number }) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((cur) => [...cur, { id, text: toast.text }])
    window.setTimeout(() => {
      setToasts((cur) => cur.filter((item) => item.id !== id))
    }, toast.ttlMs ?? 3000)
  }, [])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.api?.onSidecarReady ||
      !window.api?.onSidecarCrash
    ) return
    const setSidecar = (value: StatusValue, detail: string): void => {
      patchStatus({ sidecar: value, sidecarDetail: detail })
    }
    const offReady = window.api.onSidecarReady((url) => {
      setSidecar('green', url)
      void refreshStatus()
    })
    const offCrash = window.api.onSidecarCrash((info) => {
      if (info.willRespawn) setSidecar('amber', 'restarting…')
      else setSidecar('red', `exited code ${info.code}`)
      patchStatus({
        vts: 'amber',
        vtsDetail: 'waiting for sidecar',
        plugin: 'amber',
        pluginDetail: 'waiting for sidecar',
        pluginLifecycleState: 'unknown/loading',
        pluginDeveloperDetails: null
      })
    })
    return () => {
      offReady()
      offCrash()
    }
  }, [patchStatus, refreshStatus])

  const setLlmConfig = useCallback(async (cfg: LLMConfig) => {
    setLlmConfigState(cfg)
    patchStatus(llmStatusFromConfig(llmConfigToStoredConfig(cfg, true)))
    if (window.api?.saveStoredConfig) {
      await window.api.saveStoredConfig(llmConfigToStoredConfig(cfg, hasCompletedSetup))
    }
  }, [hasCompletedSetup, patchStatus])

  const setLogsDrawer = useCallback((patch: Partial<LogsDrawerState>) => {
    setLogsDrawerState((cur) => {
      const next = { ...cur, ...patch }
      void window.api?.saveChromeState?.({
        logsDrawerEnabled: next.enabled,
        logsDrawerCollapsed: !next.open,
        logsDrawerHeight: next.height
      })
      return next
    })
  }, [])

  const completeSetup = useCallback(
    (cfg: LLMConfig) => {
      void setLlmConfig(cfg)
      void window.api?.saveStoredConfig?.(llmConfigToStoredConfig(cfg, true))
      setHasCompletedSetup(true)
    },
    [setLlmConfig]
  )

  const restartSidecarAction = useCallback(async () => {
    if (!window.api?.restartSidecar) {
      await refreshStatus()
      return
    }
    patchStatus({ sidecar: 'amber', sidecarDetail: 'restarting...' })
    await window.api.restartSidecar()
    await refreshStatus()
  }, [patchStatus, refreshStatus])

  const markPluginRestartPending = useCallback((pluginName: string) => {
    patchStatus({
      plugin: 'amber',
      pluginDetail: `${pluginName}: plugin selection saved; restarting sidecar.`,
      pluginLifecycleState: 'restart pending',
      pluginDeveloperDetails: null
    })
  }, [patchStatus])

  const resetAll = useCallback(() => {
    void window.api?.clearStoredConfig?.()
    void window.api?.saveChromeState?.({
      logsDrawerEnabled: false,
      logsDrawerCollapsed: true,
      logsDrawerHeight: 200
    })
    setHasCompletedSetup(false)
    setLlmConfigState(DEFAULT_LLM_CONFIG)
    setView('chat')
    setHistoryOpen(false)
    setStatusOpen(false)
    setAgentToggle(false)
    setLogsDrawerState(DEFAULT_LOGS)
    setBanners({
      llm: false,
      vts: false,
      vtsAuth: false,
      sidecarRepeat: false,
      tts: false
    })
    setToasts([])
    setAvatarImportPlan(null)
  }, [])

  const value = useMemo<AppStoreValue>(
    () => ({
      hasCompletedSetup,
      completeSetup,
      llmConfig,
      setLlmConfig,
      view,
      setView,
      historyOpen,
      setHistoryOpen,
      statusOpen,
      setStatusOpen,
      agentToggle,
      setAgentToggle,
      logsDrawer,
      setLogsDrawer,
      showThreadList,
      setShowThreadList,
      avatarImportPlan,
      setAvatarImportPlan,
      status,
      statusOverall: worstOf(status),
      refreshStatus,
      markPluginRestartPending,
      restartSidecar: restartSidecarAction,
      banners,
      setBanners: patchBanners,
      toasts,
      pushToast,
      setStatusForDev: patchStatus,
      resetAll
    }),
    [
      hasCompletedSetup,
      llmConfig,
      view,
      historyOpen,
      statusOpen,
      agentToggle,
      logsDrawer,
      showThreadList,
      avatarImportPlan,
      status,
      banners,
      toasts,
      pushToast,
      patchBanners,
      patchStatus,
      completeSetup,
      setLlmConfig,
      setLogsDrawer,
      refreshStatus,
      markPluginRestartPending,
      restartSidecarAction,
      resetAll
    ]
  )

  return (
    <AppStoreContext.Provider value={value}>
      <ConversationHistoryProvider>{children}</ConversationHistoryProvider>
    </AppStoreContext.Provider>
  )
}

export function useStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useStore must be used within <AppStoreProvider>')
  return ctx
}
