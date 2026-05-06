/* SPEC §Component Inventory + USERFLOW F — 56px bottom rail with three nav tabs.
 * role="tablist" with min-h 48px (WCAG touch-target).
 * Ported verbatim from prototype src/shell.jsx BottomRail (lines 102–128).
 */
import { MessageSquare, Wand2, Settings as SettingsIcon } from '@/lib/icons'
import { useStore } from '@/state/app-store'
import type { View } from '@/state/app-store'

interface TabDef {
  id: View
  label: string
  Icon: typeof MessageSquare
}

const TABS: TabDef[] = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'agent', label: 'Agent', Icon: Wand2 },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon }
]

export function BottomRail() {
  const { view, setView } = useStore()
  return (
    <div className="bottom-rail" data-theme-surface role="tablist" aria-label="Primary">
      {TABS.map(({ id, label, Icon }) => {
        const active = view === id
        return (
          <button
            key={id}
            className={`rail-tab${active ? ' active' : ''}`}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => setView(id)}
          >
            <Icon
              size={20}
              fill={active ? 'currentColor' : 'none'}
              strokeWidth={active ? 1.5 : 1.75}
            />
            <span className="label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
