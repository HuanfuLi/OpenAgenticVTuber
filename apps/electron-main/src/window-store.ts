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

export interface ThemePreference {
  mode: 'auto' | 'light' | 'dark'
  lightAccent: 'blush' | 'sunrise' | 'ember'
  darkBg: 'midnight' | 'onyx'
  darkAccent: 'sky' | 'pewter'
}

export interface StoreSchema {
  window: WindowState
  chrome: ChromeState
  themePreference: ThemePreference | null
  currentAvatarId: string
}

// Defaults per UI-SPEC §Spacing: 400×700 default window, drawer disabled, 200px height.
export const store = new Store<StoreSchema>({
  defaults: {
    window: { width: 400, height: 700 },
    chrome: {
      logsDrawerEnabled: false,
      logsDrawerHeight: 200,
      logsDrawerCollapsed: true
    },
    themePreference: null,
    currentAvatarId: 'teto'
  }
})

export function getChromeState(): ChromeState {
  return store.get('chrome')
}

export function saveChromeState(patch: Partial<ChromeState>): ChromeState {
  const current = store.get('chrome')
  const next = { ...current, ...patch }
  store.set('chrome', next)
  return next
}

export function getThemePreference(): ThemePreference | null {
  return store.get('themePreference')
}

export function saveThemePreference(prefs: ThemePreference): void {
  store.set('themePreference', prefs)
}
