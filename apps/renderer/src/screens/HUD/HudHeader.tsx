import { COPY } from '@/lib/copy'
import type { HudConnectionState } from './useHudStream'

const DOT_CLASS: Record<HudConnectionState, string> = {
  connected: 'green',
  connecting: 'amber',
  reconnecting: 'amber'
}

export function HudHeader({ connectionState }: { connectionState: HudConnectionState }) {
  return (
    <header className="hud-header">
      <h1>{COPY.HUD.HUD_HEADING}</h1>
      <span
        className={`dot ${DOT_CLASS[connectionState]}`}
        aria-label={`HUD ${connectionState} sidecar`}
      />
    </header>
  )
}
