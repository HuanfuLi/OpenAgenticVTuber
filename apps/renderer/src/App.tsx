/* Phase 1 root component.
 *
 * 01-01 mounted AppShell directly. 01-02 layers a state-machine in front:
 *   loading        — initial config read; render nothing (sub-100ms typical)
 *   setup-required — render the mandatory <LLMSetup /> with no chrome
 *   ready          — render the chrome shell + functional surfaces
 *
 * The setup screen and chrome shell BOTH live inside the same ThemeProvider +
 * AppStoreProvider tree so the theme tokens and dev-panel work in both phases.
 */

import { useEffect } from 'react'
import { AppShell } from './chrome/AppShell'
import { ThemeProvider } from './state/theme-provider'
import { AppStoreProvider } from './state/app-store'
import { DevPanel } from './dev/DevPanel'
import { LLMSetup } from './screens/LLMSetup/LLMSetup'
import { bootSetupStore, useSetupState } from './state/setup-store'
import { HudRoot } from './screens/HUD/HUD'

const IS_HUD_ROUTE = typeof window !== 'undefined' && window.location.hash === '#/hud'

function GatedShell() {
  const setup = useSetupState()

  useEffect(() => {
    void bootSetupStore()
  }, [])

  if (setup.phase === 'loading') return null
  if (setup.phase === 'setup-required') return <LLMSetup />
  return <AppShell />
}

export default function App() {
  return (
    <ThemeProvider>
      <AppStoreProvider>
        <div className="app-window">
          {IS_HUD_ROUTE ? <HudRoot /> : <GatedShell />}
        </div>
        {import.meta.env.DEV && !IS_HUD_ROUTE && <DevPanel />}
      </AppStoreProvider>
    </ThemeProvider>
  )
}
