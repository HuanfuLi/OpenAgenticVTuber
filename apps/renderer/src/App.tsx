/* Phase 1 plan 01-01 root component. Mounts the chrome shell. The setup-screen
 * gating (LLM setup before AppShell) is wired in plan 01-02; for 01-01 the
 * AppShell is the root and assumes the user is past setup.
 */
import { AppShell } from './chrome/AppShell'
import { ThemeProvider } from './state/theme-provider'
import { AppStoreProvider } from './state/app-store'
import { DevPanel } from './dev/DevPanel'

export default function App() {
  return (
    <ThemeProvider>
      <AppStoreProvider>
        <div className="app-window">
          <AppShell />
        </div>
        {import.meta.env.DEV && <DevPanel />}
      </AppStoreProvider>
    </ThemeProvider>
  )
}
