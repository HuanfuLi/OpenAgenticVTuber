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
import {
  mockBanners,
  mockToasts,
  type Banners,
  type Toast
} from '@/dev/__mocks__/mock-backend'
import { worstOf, type StatusOverall, type StatusSnapshot, type StatusValue } from './status-types'
import type { Provider, StoredConfig, VtsStatus } from '@preload-types'

export type ChatRole = 'user' | 'assistant'
export interface ChatMessage {
  id: number
  role: ChatRole
  text: string
}

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
  chatMessages: ChatMessage[]
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>
  status: StatusSnapshot
  statusOverall: StatusOverall
  refreshStatus: () => Promise<void>
  restartSidecar: () => Promise<void>
  banners: Banners
  toasts: Toast[]
  pushToast: (toast: { text: string; ttlMs?: number }) => void
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
  llmDetail: 'loading setup',
  vtsDetail: 'checking VTS status',
  sidecarDetail: 'starting...'
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
    schemaVersion: 1
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

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [hasCompletedSetup, setHasCompletedSetup] = useState<boolean>(false)
  const [llmConfig, setLlmConfigState] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
  const [view, setView] = useState<View>('chat')
  const [historyOpen, setHistoryOpen] = useState<boolean>(false)
  const [statusOpen, setStatusOpen] = useState<boolean>(false)
  const [agentToggle, setAgentToggle] = useState<boolean>(false)
  const [logsDrawer, setLogsDrawerState] = useState<LogsDrawerState>(DEFAULT_LOGS)
  const [showThreadList, setShowThreadList] = useState<boolean>(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const [status, setStatus] = useState<StatusSnapshot>(DEFAULT_STATUS)

  const patchStatus = useCallback((patch: Partial<StatusSnapshot>) => {
    setStatus((cur) => ({ ...cur, ...patch }))
  }, [])

  const refreshStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !window.api) return
    const [cfg, readyUrl, vts] = await Promise.all([
      window.api.getStoredConfig ? window.api.getStoredConfig().catch(() => null) : Promise.resolve(null),
      window.api.getReadyUrl ? window.api.getReadyUrl().catch(() => null) : Promise.resolve(null),
      window.api.getVtsStatus
        ? window.api.getVtsStatus().catch(() => ({
            state: 'unavailable' as const,
            detail: 'VTS status unavailable.',
            authenticated: false,
            windowDetected: false
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
      ...(vts ? vtsStatusToSnapshot(vts) : {})
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
  useEffect(() => mockBanners.subscribe(setBanners), [])

  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(
    () =>
      mockToasts.subscribe((evt) => {
        if (evt.kind === 'add') setToasts((t) => [...t, { id: evt.id, text: evt.text }])
        else if (evt.kind === 'remove') setToasts((t) => t.filter((x) => x.id !== evt.id))
      }),
    []
  )

  const pushToast = useCallback((toast: { text: string; ttlMs?: number }) => {
    mockToasts.push({ text: toast.text }, toast.ttlMs ?? 3000)
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
      patchStatus({ vts: 'amber', vtsDetail: 'waiting for sidecar' })
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
    setChatMessages([])
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
      chatMessages,
      setChatMessages,
      status,
      statusOverall: worstOf(status),
      refreshStatus,
      restartSidecar: restartSidecarAction,
      banners,
      toasts,
      pushToast,
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
      chatMessages,
      status,
      banners,
      toasts,
      pushToast,
      completeSetup,
      setLlmConfig,
      setLogsDrawer,
      refreshStatus,
      restartSidecarAction,
      resetAll
    ]
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useStore must be used within <AppStoreProvider>')
  return ctx
}
