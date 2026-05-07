import { app, BrowserWindow, safeStorage, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { store } from './window-store'
import { spawnSidecar, shutdownSidecar } from './sidecar'
import { registerIpc } from './ipc'

// Augment Electron's App with a quitting flag so multiple before-quit handlers cooperate.
declare global {
  namespace Electron {
    interface App {
      isQuitting: boolean
    }
  }
}
app.isQuitting = false

let mainWindow: BrowserWindow | null = null
let cleanupIpc: (() => void) | null = null

function createWindow(): BrowserWindow {
  const saved = store.get('window')

  const window = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 320,
    minHeight: 480,
    title: 'AgenticLLMVTuber',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('close', () => {
    if (!window.isDestroyed()) {
      const bounds = window.getBounds()
      store.set('window', {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      })
    }
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../../../renderer/out/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agenticllmvtuber.app')

  // safeStorage.isEncryptionAvailable() returns false on Linux without a keyring.
  // Per CONTEXT.md D-07 we accept plaintext fallback ("Linux without a keyring drops
  // to plaintext (acceptable per OS-isolation stance)").
  if (process.platform === 'linux' && !safeStorage.isEncryptionAvailable()) {
    safeStorage.setUsePlainTextEncryption(true)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createWindow()
  cleanupIpc = registerIpc(mainWindow)

  // Spawn sidecar AFTER createWindow + registerIpc so any sidecar:ready event
  // has a window to dispatch to. Pitfall 12: never spawn at module top-level.
  spawnSidecar().catch((err) => {
    console.error('[main] sidecar spawn failed:', err)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sidecar:crash', { code: -1, willRespawn: false })
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      cleanupIpc?.()
      cleanupIpc = registerIpc(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (e) => {
  if (!app.isQuitting) {
    app.isQuitting = true
    e.preventDefault()
    cleanupIpc?.()
    cleanupIpc = null
    try {
      await shutdownSidecar()
    } catch (err) {
      console.error('[main] sidecar shutdown error:', err)
    }
    app.quit()
  }
})
