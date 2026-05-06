// Lightweight observable for chrome panel state used by external surfaces
// (Settings sections, dev panel) that want to toggle the history sheet or
// logs drawer without entering the full store context.
//
// Most consumers should use useStore() from app-store.tsx instead — this
// is the standalone hook surface the plan's <files> list mandates.

import { useEffect, useState } from 'react'

export interface ChromeState {
  historySheetOpen: boolean
  logsDrawerEnabled: boolean
  logsDrawerCollapsed: boolean
  logsDrawerHeight: number
}

let state: ChromeState = {
  historySheetOpen: false,
  logsDrawerEnabled: false,
  logsDrawerCollapsed: true,
  logsDrawerHeight: 200
}

const subs = new Set<(s: ChromeState) => void>()

export function getChromeState(): ChromeState {
  return state
}

export function setChromeState(patch: Partial<ChromeState>): void {
  state = { ...state, ...patch }
  for (const cb of subs) cb(state)
}

export function useChromeState(): [ChromeState, typeof setChromeState] {
  const [s, setS] = useState<ChromeState>(state)
  useEffect(() => {
    const cb = (next: ChromeState): void => setS(next)
    subs.add(cb)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return [s, setChromeState]
}
