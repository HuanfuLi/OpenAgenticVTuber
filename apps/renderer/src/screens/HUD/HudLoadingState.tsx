import { COPY } from '@/lib/copy'

export function HudLoadingState() {
  return (
    <div className="empty-state">
      <p>{COPY.HUD.LOADING_BODY}</p>
    </div>
  )
}
