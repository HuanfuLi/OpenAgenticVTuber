/* SPEC §State machine — single store hydrated from mockSafeStorage (Phase 1)
 * or Electron safeStorage IPC (Phase 1 plan 01-02 onwards).
 *
 * Ported from prototype src/lib/store.jsx (2026-05-06). Plan 01-02 will swap
 * mockSafeStorage.get/set for window.api.getStoredValue/setStoredValue.
 *
 * The chrome's status icon is wired to the real sidecar lifecycle in
 * AppStoreProvider — onSidecarReady -> sidecar=green, onSidecarCrash with
 * willRespawn -> amber, otherwise red. LLM/VTS rows stay on mockStatus
 * until LLM-01 (plan 01-02) and AVT-04 (Phase 4) wire them.
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
  mockSafeStorage,
  mockStatus,
  worstOf,
  mockBanners,
  mockToasts,
  type StatusValue,
  type StatusOverall,
  type StatusSnapshot,
  type Banners,
  type Toast
} from '@/dev/__mocks__/mock-backend'

export type ChatRole = 'user' | 'assistant'
export interface ChatMessage {
  id: number
  role: ChatRole
  text: string
}

export type View = 'chat' | 'agent' | 'settings'

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
  banners: Banners
  toasts: Toast[]
  resetAll: () => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'lmstudio',
  endpoint: 'http://localhost:1234/v1',
  model: '',
  apiKey: ''
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const initialSetup = mockSafeStorage.get('hasCompletedSetup') === true
  const initialConn = (mockSafeStorage.get('llmConfig') as LLMConfig | undefined) ?? DEFAULT_LLM_CONFIG
  // Default OFF; persisted state is layered on top but `enabled` is force-defaulted off on every fresh load.
  const persistedLogs = (mockSafeStorage.get('logsDrawer') as Partial<LogsDrawerState>) ?? {}
  // The trailing `enabled: false` re-overrides any persisted enabled=true so
  // the drawer always defaults off on a fresh launch (matches prototype).
  const initialLogs: LogsDrawerState = {
    open: false,
    height: 200,
    ...persistedLogs,
    enabled: false
  }

  const [hasCompletedSetup, setHasCompletedSetup] = useState<boolean>(initialSetup)
  const [llmConfig, setLlmConfigState] = useState<LLMConfig>(initialConn)
  const [view, setView] = useState<View>('chat')
  const [historyOpen, setHistoryOpen] = useState<boolean>(false)
  const [statusOpen, setStatusOpen] = useState<boolean>(false)
  const [agentToggle, setAgentToggle] = useState<boolean>(false)
  const [logsDrawer, setLogsDrawerState] = useState<LogsDrawerState>(initialLogs)
  const [showThreadList, setShowThreadList] = useState<boolean>(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const [status, setStatus] = useState<StatusSnapshot>(mockStatus.get())
  useEffect(() => mockStatus.subscribe(setStatus), [])

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

  // Phase 1 plan 01-01: bridge real sidecar events into the mockStatus
  // observable so the popover row stays consistent with the chrome icon.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    const setSidecar = (value: StatusValue, detail: string): void => {
      mockStatus.set({ sidecar: value, sidecarDetail: detail })
    }
    const offReady = window.api.onSidecarReady((url) => setSidecar('green', url))
    const offCrash = window.api.onSidecarCrash((info) => {
      if (info.willRespawn) setSidecar('amber', 'restarting…')
      else setSidecar('red', `exited code ${info.code}`)
    })
    return () => {
      offReady()
      offCrash()
    }
  }, [])

  const setLlmConfig = useCallback((cfg: LLMConfig) => {
    setLlmConfigState(cfg)
    mockSafeStorage.set('llmConfig', cfg)
  }, [])

  const setLogsDrawer = useCallback((patch: Partial<LogsDrawerState>) => {
    setLogsDrawerState((cur) => {
      const next = { ...cur, ...patch }
      mockSafeStorage.set('logsDrawer', next)
      return next
    })
  }, [])

  const completeSetup = useCallback(
    (cfg: LLMConfig) => {
      setLlmConfig(cfg)
      mockSafeStorage.set('hasCompletedSetup', true)
      setHasCompletedSetup(true)
    },
    [setLlmConfig]
  )

  const resetAll = useCallback(() => {
    mockSafeStorage.clear()
    setHasCompletedSetup(false)
    setLlmConfigState(DEFAULT_LLM_CONFIG)
    setView('chat')
    setHistoryOpen(false)
    setStatusOpen(false)
    setAgentToggle(false)
    setLogsDrawerState({ enabled: false, open: false, height: 200 })
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
      banners,
      toasts,
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
      completeSetup,
      setLlmConfig,
      setLogsDrawer,
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
