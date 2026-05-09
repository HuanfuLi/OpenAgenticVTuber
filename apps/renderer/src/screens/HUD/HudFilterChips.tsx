import { COPY } from '@/lib/copy'

export interface HudFilters {
  writable: boolean
  animating: boolean
  locked: boolean
}

interface Props {
  filters: HudFilters
  onChange: (filters: HudFilters) => void
}

export function HudFilterChips({ filters, onChange }: Props) {
  const toggle = (key: keyof HudFilters): void => {
    onChange({ ...filters, [key]: !filters[key] })
  }
  return (
    <div className="hud-filter-chips" aria-label="HUD filters">
      <button
        type="button"
        className={`anchor-pill${filters.writable ? ' active' : ''}`}
        onClick={() => toggle('writable')}
      >
        {COPY.HUD.FILTER_WRITABLE}
      </button>
      <button
        type="button"
        className={`anchor-pill${filters.animating ? ' active' : ''}`}
        onClick={() => toggle('animating')}
      >
        {COPY.HUD.FILTER_ANIMATING}
      </button>
      <button
        type="button"
        className={`anchor-pill${filters.locked ? ' active' : ''}`}
        onClick={() => toggle('locked')}
      >
        {COPY.HUD.FILTER_LOCKED}
      </button>
    </div>
  )
}
