import { COPY } from '@/lib/copy'

export function HudErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty-state">
      <h2>{COPY.HUD.LOADING_ERROR}</h2>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        {COPY.HUD.RETRY_BUTTON}
      </button>
    </div>
  )
}
