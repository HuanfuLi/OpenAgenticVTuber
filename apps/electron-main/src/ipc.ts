// IPC bridge: register main-side handlers for the contextBridge API surface
// declared in apps/electron-main/preload/index.ts. Returns a cleanup callback
// that unregisters all listeners (called when the window is destroyed).

import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import path from 'node:path'
import {
  getReadyUrl,
  getSidecarHttpUrl,
  onReady,
  onCrash,
  onLog,
  listBodyMotionPlugins,
  restartSidecar,
  resetVtsAuthToken
} from './sidecar'
import {
  getChromeState,
  getLogLevel,
  getThemePreference,
  resolveCurrentAvatarId,
  saveChromeState,
  saveLogLevel,
  saveThemePreference,
  store
} from './window-store'
import { loadConfig, saveConfig, clearConfig, type StoredConfig } from './safe-storage'
import { createHudWindow } from './hud-window'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'
import {
  clearConversationHistory,
  commitConversationTurn,
  createConversationSession,
  deleteConversationSession,
  getActiveConversationSession,
  getConversationStats,
  listConversationSessions,
  renameConversationSession,
  selectConversationSession,
  type CommitConversationTurnInput
} from './conversation-store'

function resolveRepoRoot(): string {
  return path.resolve(app.getAppPath(), '..', '..')
}

export function registerIpc(window: BrowserWindow): () => void {
  // Existing from 01-01:
  ipcMain.handle('sidecar:getReadyUrl', () => getReadyUrl())
  ipcMain.handle('window:getState', () => store.get('window'))
  ipcMain.handle('chrome:getState', () => getChromeState())
  ipcMain.handle('chrome:saveState', (_e, patch) => saveChromeState(patch))
  ipcMain.handle('theme:getPreference', () => getThemePreference())
  ipcMain.handle('theme:savePreference', (_e, prefs) => saveThemePreference(prefs))
  ipcMain.handle('sidecar:restart', async () => {
    await restartSidecar()
  })
  ipcMain.handle('vts:resetAuth', async () => {
    await resetVtsAuthToken()
    await restartSidecar()
  })
  ipcMain.handle('sidecar:getVtsStatus', async () => {
    let baseUrl: string
    try {
      baseUrl = getSidecarHttpUrl()
    } catch {
      return {
        state: 'unavailable',
        detail: 'Sidecar is not ready.',
        authenticated: false,
        windowDetected: false
      }
    }
    try {
      const resp = await fetch(`${baseUrl}/admin/vts-status`)
      if (!resp.ok) {
        return {
          state: 'unavailable',
          detail: `VTS status unavailable: HTTP ${resp.status}`,
          authenticated: false,
          windowDetected: false
        }
      }
      return await resp.json()
    } catch (err) {
      return {
        state: 'unavailable',
        detail: `VTS status unavailable: ${err instanceof Error ? err.message : String(err)}`,
        authenticated: false,
        windowDetected: false
      }
    }
  })

  // New for 01-02 (safeStorage credential gate, PLUMB-04 / D-07 / D-09):
  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('config:save', async (_e, cfg: StoredConfig) => {
    saveConfig(cfg)
    try {
      await restartSidecar()
    } catch (err) {
      console.error('[main] sidecar restart after config save failed:', err)
      if (!window.isDestroyed()) {
        window.webContents.send('sidecar:crash', { code: -1, willRespawn: false })
      }
      throw err
    }
  })
  ipcMain.handle('config:clear', () => clearConfig())
  ipcMain.handle('plugin:listBodyMotionPlugins', () => listBodyMotionPlugins())
  ipcMain.handle('avatar:getCurrentId', () => resolveCurrentAvatarId(resolveRepoRoot()))
  ipcMain.handle('avatar:getCurrentPlan', async (): Promise<AvatarImportPlan | null> => {
    const currentAvatarId = resolveCurrentAvatarId(resolveRepoRoot())
    if (!currentAvatarId) return null
    try {
      const resp = await fetch(
        `${getSidecarHttpUrl()}/admin/avatar/import/current?avatar_id=${encodeURIComponent(currentAvatarId)}`
      )
      if (!resp.ok) return null
      return (await resp.json()) as AvatarImportPlan
    } catch {
      return null
    }
  })
  ipcMain.handle('avatar:pickFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choose avatar folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]!
  })
  ipcMain.handle('avatar:requestImportPlan', async (_e, folder: string): Promise<AvatarImportPlan> => {
    const resp = await fetch(`${getSidecarHttpUrl()}/admin/avatar/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder })
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Import failed: HTTP ${resp.status} - ${text}`)
    }
    return (await resp.json()) as AvatarImportPlan
  })
  ipcMain.handle(
    'avatar:commitOverrides',
    async (_e, plan: AvatarImportPlan): Promise<{ status: string; path: string }> => {
      const resp = await fetch(`${getSidecarHttpUrl()}/admin/avatar/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Commit failed: HTTP ${resp.status} - ${text}`)
      }
      if (plan.avatar_id) store.set('currentAvatarId', plan.avatar_id)
      const body = (await resp.json()) as { status: string; path: string }
      await restartSidecar()
      return body
    }
  )
  ipcMain.handle('hud:open', () => {
    createHudWindow()
  })
  ipcMain.handle('log:getLevel', () => getLogLevel())
  ipcMain.handle('log:saveLevel', (_e, level) => saveLogLevel(level))
  ipcMain.handle('conversation:listSessions', () => listConversationSessions())
  ipcMain.handle('conversation:getActive', () => getActiveConversationSession())
  ipcMain.handle('conversation:create', () => createConversationSession())
  ipcMain.handle('conversation:select', (_e, id: string) => selectConversationSession(id))
  ipcMain.handle('conversation:rename', (_e, id: string, title: string) =>
    renameConversationSession(id, title)
  )
  ipcMain.handle('conversation:delete', (_e, id: string) => deleteConversationSession(id))
  ipcMain.handle('conversation:clear', () => clearConversationHistory())
  ipcMain.handle('conversation:commitTurn', (_e, input: CommitConversationTurnInput) =>
    commitConversationTurn(input)
  )
  ipcMain.handle('conversation:getStats', () => getConversationStats())

  const offReady = onReady((url) => {
    if (!window.isDestroyed()) window.webContents.send('sidecar:ready', url)
  })
  const offCrash = onCrash((info) => {
    if (!window.isDestroyed()) window.webContents.send('sidecar:crash', info)
  })
  const offLog = onLog((line) => {
    if (!window.isDestroyed()) window.webContents.send('sidecar:log', line)
  })

  return () => {
    offReady()
    offCrash()
    offLog()
    ipcMain.removeHandler('sidecar:getReadyUrl')
    ipcMain.removeHandler('window:getState')
    ipcMain.removeHandler('chrome:getState')
    ipcMain.removeHandler('chrome:saveState')
    ipcMain.removeHandler('theme:getPreference')
    ipcMain.removeHandler('theme:savePreference')
    ipcMain.removeHandler('sidecar:restart')
    ipcMain.removeHandler('vts:resetAuth')
    ipcMain.removeHandler('sidecar:getVtsStatus')
    ipcMain.removeHandler('config:load')
    ipcMain.removeHandler('config:save')
    ipcMain.removeHandler('config:clear')
    ipcMain.removeHandler('plugin:listBodyMotionPlugins')
    ipcMain.removeHandler('avatar:getCurrentId')
    ipcMain.removeHandler('avatar:getCurrentPlan')
    ipcMain.removeHandler('avatar:pickFolder')
    ipcMain.removeHandler('avatar:requestImportPlan')
    ipcMain.removeHandler('avatar:commitOverrides')
    ipcMain.removeHandler('hud:open')
    ipcMain.removeHandler('log:getLevel')
    ipcMain.removeHandler('log:saveLevel')
    ipcMain.removeHandler('conversation:listSessions')
    ipcMain.removeHandler('conversation:getActive')
    ipcMain.removeHandler('conversation:create')
    ipcMain.removeHandler('conversation:select')
    ipcMain.removeHandler('conversation:rename')
    ipcMain.removeHandler('conversation:delete')
    ipcMain.removeHandler('conversation:clear')
    ipcMain.removeHandler('conversation:commitTurn')
    ipcMain.removeHandler('conversation:getStats')
  }
}
