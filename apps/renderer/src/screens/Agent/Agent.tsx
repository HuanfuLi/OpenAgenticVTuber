/* SPEC §Agent — placeholder per UI-SPEC §Copywriting Contract.
 * Ported verbatim from prototype src/shell.jsx AgentView (lines 362–371).
 */
import { COPY } from '@/lib/copy'

export function Agent() {
  return (
    <div className="view">
      <div className="empty-state grow">
        <h2>{COPY.AGENT.PLACEHOLDER_HEAD}</h2>
        <p style={{ maxWidth: 320 }}>{COPY.AGENT.PLACEHOLDER_BODY}</p>
      </div>
    </div>
  )
}
