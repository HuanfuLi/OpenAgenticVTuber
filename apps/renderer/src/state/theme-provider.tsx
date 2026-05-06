/* SPEC §Color resolution + D-23 — ThemeProvider with 7 named theme classes.
 *
 * Ported from prototype src/lib/store.jsx (2026-05-06).
 * - resolveThemeClass: maps preferences + prefers-color-scheme to one of 7 classes
 * - ThemeProvider: applies class to <html>; subscribes to OS dark-mode changes
 *
 * In Phase 1 plan 01-01 we keep persistence in-memory via the dev-mock
 * safeStorage shim. Plan 01-02 will swap that for window.api.setStoredValue.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { mockSafeStorage } from '@/dev/__mocks__/mock-backend'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type LightAccent = 'blush' | 'sunrise' | 'ember'
export type DarkBg = 'midnight' | 'onyx'
export type DarkAccent = 'sky' | 'pewter'

export interface ThemePrefs {
  mode: ThemeMode
  lightAccent: LightAccent
  darkBg: DarkBg
  darkAccent: DarkAccent
}

const DEFAULT_PREFS: ThemePrefs = {
  mode: 'auto',
  lightAccent: 'blush',
  darkBg: 'midnight',
  darkAccent: 'sky'
}

export function resolveThemeClass(p: ThemePrefs, prefersDark: boolean): string {
  const lightAccent = (['blush', 'sunrise', 'ember'] as const).includes(p.lightAccent)
    ? p.lightAccent
    : 'blush'
  const darkBg = (['midnight', 'onyx'] as const).includes(p.darkBg) ? p.darkBg : 'midnight'
  const darkAccent = (['sky', 'pewter'] as const).includes(p.darkAccent) ? p.darkAccent : 'sky'
  const resolvedMode = p.mode === 'auto' ? (prefersDark ? 'dark' : 'light') : p.mode
  if (resolvedMode === 'light') return `theme-${lightAccent}`
  return `theme-${darkBg}-${darkAccent}`
}

interface ThemeContextValue {
  prefs: ThemePrefs
  setPrefs: (patch: Partial<ThemePrefs>) => void
  themeClass: string
  prefersDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = mockSafeStorage.get('themePreference') as ThemePrefs | undefined
  const [prefs, setPrefsState] = useState<ThemePrefs>(stored ?? DEFAULT_PREFS)
  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  )

  // Listen for OS theme changes (only meaningful when mode === 'auto').
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const themeClass = useMemo(() => resolveThemeClass(prefs, prefersDark), [prefs, prefersDark])

  // Apply to <html>.
  useEffect(() => {
    document.documentElement.className = themeClass
  }, [themeClass])

  const setPrefs = useCallback((patch: Partial<ThemePrefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...patch }
      mockSafeStorage.set('themePreference', next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ prefs, setPrefs, themeClass, prefersDark }),
    [prefs, setPrefs, themeClass, prefersDark]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
