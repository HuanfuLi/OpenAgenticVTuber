// LLM-setup state machine + safeStorage hydration.
//
// Phase: 'loading' (initial config read), 'setup-required' (no completed
// setup), 'ready' (chrome shell mounts).
//
// On phase='ready', App.tsx renders <AppShell />. On phase='setup-required',
// App.tsx renders <LLMSetup />. The completeSetup() helper persists via
// window.api.saveStoredConfig (DPAPI on Windows; libsecret/keychain elsewhere)
// then flips to 'ready'.

import { useEffect, useState } from 'react'
import type { StoredConfig, ProviderConfig, Provider } from '@preload-types'

export type { StoredConfig, ProviderConfig, Provider }

type Phase = 'loading' | 'setup-required' | 'ready'

interface SetupState {
  phase: Phase
  cfg: StoredConfig | null
}

let state: SetupState = { phase: 'loading', cfg: null }
const subs = new Set<(s: SetupState) => void>()

function emit(): void {
  for (const cb of subs) cb(state)
}

export async function bootSetupStore(): Promise<void> {
  const cfg = await window.api.getStoredConfig()
  if (cfg && cfg.hasCompletedSetup) {
    state = { phase: 'ready', cfg }
  } else {
    state = { phase: 'setup-required', cfg: null }
  }
  emit()
}

export async function completeSetup(cfg: StoredConfig): Promise<void> {
  await saveCompletedSetupConfig(cfg)
}

export async function saveCompletedSetupConfig(cfg: StoredConfig): Promise<void> {
  const final: StoredConfig = { ...cfg, hasCompletedSetup: true, schemaVersion: 1 }
  await window.api.saveStoredConfig(final)
  state = { phase: 'ready', cfg: final }
  emit()
}

export function useSetupState(): SetupState {
  const [s, setS] = useState(state)
  useEffect(() => {
    const cb = (next: SetupState): void => setS(next)
    subs.add(cb)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return s
}
