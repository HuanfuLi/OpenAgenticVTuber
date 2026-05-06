/* SPEC §Component Inventory + USERFLOW G — 36px top bar.
 * Hamburger (Chat route only) + Agent toggle + StatusIcon.
 * Ported verbatim from prototype src/shell.jsx TopBar (lines 74–99).
 */
import { Menu, Wand2 } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { StatusIcon } from './StatusIcon'

export function TopBar() {
  const { view, historyOpen, setHistoryOpen, agentToggle, setAgentToggle } = useStore()
  const showHamburger = view === 'chat'
  return (
    <div className="top-bar" data-theme-surface>
      {showHamburger ? (
        <button
          className="icon-btn"
          aria-label="Open conversation history"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <Menu size={18} />
        </button>
      ) : (
        <span className="icon-slot" aria-hidden="true" />
      )}
      <button
        className={`agent-toggle${agentToggle ? ' on' : ''} tt`}
        data-tt={agentToggle ? '' : COPY.AGENT.TOGGLE_DISABLED_TT}
        onClick={() => setAgentToggle(!agentToggle)}
      >
        <Wand2 size={14} />
        <span>Agent</span>
      </button>
      <span className="spacer" />
      <StatusIcon />
    </div>
  )
}
