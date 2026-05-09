// contextBridge surface exposed to the renderer as `window.api`.
// Renderer never has direct access to ipcRenderer or Node — every channel
// is whitelisted here.
import { contextBridge, ipcRenderer } from 'electron'
import type { StoredConfig } from '../src/safe-storage'
import type { ChromeState, ThemePreference } from '../src/window-store'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'

type Unsubscribe = () => void

export interface VtsStatus {
  state:
    | 'authenticated'
    | 'auth_pending'
    | 'not_authenticated'
    | 'sidecar_unconfigured'
    | 'vts_window_not_found'
    | 'unavailable'
  detail: string
  authenticated: boolean
  windowDetected: boolean
}

export interface BodyMotionPluginSummary {
  name: string
  version: string | null
  description: string | null
  source: 'repo' | 'userData'
  path: string
}

const api = {
  // Sidecar lifecycle
  getReadyUrl: (): Promise<string | null> => ipcRenderer.invoke('sidecar:getReadyUrl'),
  onSidecarReady: (cb: (url: string) => void): Unsubscribe => {
    const handler = (_e: unknown, url: string): void => cb(url)
    ipcRenderer.on('sidecar:ready', handler)
    return () => ipcRenderer.off('sidecar:ready', handler)
  },
  onSidecarCrash: (
    cb: (info: { code: number; willRespawn: boolean }) => void
  ): Unsubscribe => {
    const handler = (_e: unknown, info: { code: number; willRespawn: boolean }): void =>
      cb(info)
    ipcRenderer.on('sidecar:crash', handler)
    return () => ipcRenderer.off('sidecar:crash', handler)
  },
  onSidecarLog: (cb: (line: string) => void): Unsubscribe => {
    const handler = (_e: unknown, line: string): void => cb(line)
    ipcRenderer.on('sidecar:log', handler)
    return () => ipcRenderer.off('sidecar:log', handler)
  },
  // Window state
  getWindowState: (): Promise<{ width: number; height: number; x?: number; y?: number }> =>
    ipcRenderer.invoke('window:getState'),
  getChromeState: (): Promise<ChromeState> => ipcRenderer.invoke('chrome:getState'),
  saveChromeState: (patch: Partial<ChromeState>): Promise<ChromeState> =>
    ipcRenderer.invoke('chrome:saveState', patch),
  getThemePreference: (): Promise<ThemePreference | null> =>
    ipcRenderer.invoke('theme:getPreference'),
  saveThemePreference: (prefs: ThemePreference): Promise<void> =>
    ipcRenderer.invoke('theme:savePreference', prefs),

  // SafeStorage credential gate (01-02 / PLUMB-04 / D-07 / D-09)
  getStoredConfig: (): Promise<StoredConfig | null> => ipcRenderer.invoke('config:load'),
  saveStoredConfig: (cfg: StoredConfig): Promise<void> =>
    ipcRenderer.invoke('config:save', cfg),
  clearStoredConfig: (): Promise<void> => ipcRenderer.invoke('config:clear'),
  getVtsStatus: (): Promise<VtsStatus> => ipcRenderer.invoke('sidecar:getVtsStatus'),
  restartSidecar: (): Promise<void> => ipcRenderer.invoke('sidecar:restart'),
  listBodyMotionPlugins: (): Promise<BodyMotionPluginSummary[]> =>
    ipcRenderer.invoke('plugin:listBodyMotionPlugins'),

  // Avatar import
  pickAvatarFolder: (): Promise<string | null> => ipcRenderer.invoke('avatar:pickFolder'),
  requestImportPlan: (folder: string): Promise<AvatarImportPlan> =>
    ipcRenderer.invoke('avatar:requestImportPlan', folder),
  commitAvatarOverrides: (plan: AvatarImportPlan): Promise<{ status: string; path: string }> =>
    ipcRenderer.invoke('avatar:commitOverrides', plan),

  // HUD entry (Phase 9)
  openHud: (): Promise<void> => ipcRenderer.invoke('hud:open')
}

contextBridge.exposeInMainWorld('api', api)

export type RendererApi = typeof api
export type { StoredConfig, ProviderConfig, Provider } from '../src/safe-storage'
export type { ChromeState, ThemePreference } from '../src/window-store'
