// Phase 1 plan 01-01: lightweight route observable. The current chrome shell
// derives routing from the AppStoreProvider's `view` state — this module is
// kept as a standalone hook for any caller that needs to read/set the route
// without entering the full store context (e.g., dev-panel direct injection).
//
// Both surfaces stay consistent because both sides treat the four-state
// 'chat' | 'agent' | 'settings' enum identically.

import { useEffect, useState } from 'react'

export type Route = 'chat' | 'agent' | 'settings'

let current: Route = 'chat'
const subs = new Set<(r: Route) => void>()

export function getRoute(): Route {
  return current
}

export function setRoute(r: Route): void {
  if (current === r) return
  current = r
  for (const cb of subs) cb(r)
}

export function useRoute(): [Route, (r: Route) => void] {
  const [r, setR] = useState<Route>(current)
  useEffect(() => {
    const cb = (next: Route): void => setR(next)
    subs.add(cb)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return [r, setRoute]
}
