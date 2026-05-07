/* SPEC §3 Chrome shell — top bar + view content + history sheet + logs drawer
 * + bottom rail. Wires the LogsDrawer's logLines to real sidecar stdout via
 * window.api.onSidecarLog (cap at 200 lines).
 *
 * Composition adapted from prototype src/App.jsx MainApp (lines 4–40).
 */
import { useEffect, useState } from 'react'
import { useStore } from '@/state/app-store'
import { TopBar } from './TopBar'
import { BottomRail } from './BottomRail'
import { HistorySheet } from './HistorySheet'
import { LogsDrawer } from './LogsDrawer'
import { Chat } from '@/screens/Chat/Chat'
import { Agent } from '@/screens/Agent/Agent'
import { Settings } from '@/screens/Settings/Settings'
import { ToastStack } from './ToastStack'
import { subscribeWSLog } from '@/ws/store'

const LOGS_CAP = 200

export function AppShell() {
  const { view, logsDrawer } = useStore()
  const [logLines, setLogLines] = useState<string[]>([])

  // Listen for "logs:clear" from the LogsDrawer toolbar.
  useEffect(() => {
    const onClear = (): void => setLogLines([])
    window.addEventListener('logs:clear', onClear)
    return () => window.removeEventListener('logs:clear', onClear)
  }, [])

  // Subscribe to two log sources when the drawer is enabled:
  //   1. Sidecar stdout/stderr lines via contextBridge (Phase 1).
  //   2. WS log envelopes from the orchestrator (Phase 2 plan 02-03 -- carries
  //      [INTENT] / [STUB-TTS] structured lines emitted via loguru).
  // Both subscriptions are cancelled when disabled so we don't accumulate
  // lines in the background.
  useEffect(() => {
    if (!logsDrawer.enabled) {
      setLogLines([])
      return
    }
    const append = (line: string): void =>
      setLogLines((cur) => [...cur, line].slice(-LOGS_CAP))
    // Source 2: WS log envelopes (always wired -- standalone-test friendly).
    const offWS = subscribeWSLog(append)
    // Source 1: sidecar stdout (Electron only).
    if (typeof window === 'undefined' || !window.api) {
      return offWS
    }
    const offSidecar = window.api.onSidecarLog(append)
    return () => {
      offSidecar()
      offWS()
    }
  }, [logsDrawer.enabled])

  return (
    <>
      <TopBar />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {view === 'chat' && <Chat />}
        {view === 'agent' && <Agent />}
        {view === 'settings' && <Settings />}
        <HistorySheet />
        <ToastStack />
      </div>
      <LogsDrawer logLines={logLines} />
      <BottomRail />
    </>
  )
}
