// IPC bridge: register main-side handlers for the contextBridge API surface
// declared in apps/electron-main/preload/index.ts. Returns a cleanup callback
// that unregisters all listeners (called when the window is destroyed).

import { dialog, ipcMain, type BrowserWindow } from 'electron'
import {
  getReadyUrl,
  getSidecarHttpUrl,
  onReady,
  onCrash,
  onLog,
  restartSidecar
} from './sidecar'
import { store } from './window-store'
import { loadConfig, saveConfig, clearConfig, type StoredConfig } from './safe-storage'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'

export function registerIpc(window: BrowserWindow): () => void {
  // Existing from 01-01:
  ipcMain.handle('sidecar:getReadyUrl', () => getReadyUrl())
  ipcMain.handle('window:getState', () => store.get('window'))

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
      store.set('currentAvatarId', plan.avatar_id || 'teto')
      const body = (await resp.json()) as { status: string; path: string }
      await restartSidecar()
      return body
    }
  )

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
    ipcMain.removeHandler('config:load')
    ipcMain.removeHandler('config:save')
    ipcMain.removeHandler('config:clear')
    ipcMain.removeHandler('avatar:pickFolder')
    ipcMain.removeHandler('avatar:requestImportPlan')
    ipcMain.removeHandler('avatar:commitOverrides')
  }
}
