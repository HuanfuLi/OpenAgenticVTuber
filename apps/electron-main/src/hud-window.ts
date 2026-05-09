import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

let hudWindow: BrowserWindow | null = null

export function createHudWindow(): BrowserWindow {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.focus()
    return hudWindow
  }

  hudWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 480,
    title: 'AgenticLLMVTuber — HUD',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  hudWindow.on('ready-to-show', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.show()
    }
  })

  hudWindow.on('closed', () => {
    hudWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    hudWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/hud`)
  } else {
    hudWindow.loadFile(join(__dirname, '../../../renderer/out/index.html'), { hash: 'hud' })
  }

  return hudWindow
}

export function closeHudWindow(): void {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close()
  }
}

export function isHudWindowOpen(): boolean {
  return hudWindow !== null && !hudWindow.isDestroyed()
}
