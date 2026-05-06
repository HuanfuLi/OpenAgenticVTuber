// Phase 1 plan 01-01 preload stub. Task 2 of this plan replaces this with the
// full contextBridge surface (getReadyUrl, onSidecarReady, onSidecarCrash,
// onSidecarLog, getWindowState).
import { contextBridge } from 'electron'

const api = {
  // Stub — replaced by Task 2.
  getReadyUrl: async (): Promise<string | null> => null,
  onSidecarReady: (_cb: (url: string) => void): (() => void) => () => {},
  onSidecarCrash: (
    _cb: (info: { code: number; willRespawn: boolean }) => void
  ): (() => void) => () => {},
  onSidecarLog: (_cb: (line: string) => void): (() => void) => () => {},
  getWindowState: async (): Promise<{
    width: number
    height: number
    x?: number
    y?: number
  }> => ({ width: 400, height: 700 })
}

contextBridge.exposeInMainWorld('api', api)

export type RendererApi = typeof api
