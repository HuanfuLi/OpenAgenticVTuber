import { COPY } from '@/lib/copy'

export function HudEmptyState({ kind }: { kind: 'filter' | 'rig' }) {
  return (
    <div className="empty-state">
      <h2>{kind === 'rig' ? COPY.HUD.EMPTY_RIG_HEADING : COPY.HUD.EMPTY_FILTER_HEADING}</h2>
      <p>{kind === 'rig' ? COPY.HUD.EMPTY_RIG_BODY : COPY.HUD.EMPTY_FILTER_BODY}</p>
    </div>
  )
}
