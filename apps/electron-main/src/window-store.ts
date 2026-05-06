import Store from 'electron-store'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
}

export interface ChromeState {
  logsDrawerEnabled: boolean
  logsDrawerHeight: number
  logsDrawerCollapsed: boolean
}

export interface StoreSchema {
  window: WindowState
  chrome: ChromeState
}

// Defaults per UI-SPEC §Spacing: 400×700 default window, drawer disabled, 200px height.
export const store = new Store<StoreSchema>({
  defaults: {
    window: { width: 400, height: 700 },
    chrome: {
      logsDrawerEnabled: false,
      logsDrawerHeight: 200,
      logsDrawerCollapsed: true
    }
  }
})
