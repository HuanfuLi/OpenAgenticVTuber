// IPC bridge: register main-side handlers for the contextBridge API surface
// declared in apps/electron-main/preload/index.ts. Returns a cleanup callback
// that unregisters all listeners (called when the window is destroyed).

import { ipcMain, type BrowserWindow } from 'electron'
import { getReadyUrl, onReady, onCrash, onLog, restartSidecar } from './sidecar'
import { store } from './window-store'
import { loadConfig, saveConfig, clearConfig, type StoredConfig } from './safe-storage'

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
  }
}
