// IPC bridge: register main-side handlers for the contextBridge API surface
// declared in apps/electron-main/preload/index.ts. Returns a cleanup callback
// that unregisters all listeners (called when the window is destroyed).

import { ipcMain, type BrowserWindow } from 'electron'
import { getReadyUrl, onReady, onCrash, onLog } from './sidecar'
import { store } from './window-store'

export function registerIpc(window: BrowserWindow): () => void {
  ipcMain.handle('sidecar:getReadyUrl', () => getReadyUrl())
  ipcMain.handle('window:getState', () => store.get('window'))

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
  }
}
