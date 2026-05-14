/* Provider dropdown per CONTEXT.md D-06.
 *  - LM Studio (lm_studio): working, default
 *  - Custom OpenAI-compatible (custom_openai): working
 *
 * Hosted providers that are not wired into setup are intentionally not rendered
 * as disabled roadmap placeholders. Custom OpenAI-compatible is the current
 * hosted-endpoint path.
 *
 * Per 01-PROTOTYPE-DELTA.md: replaces the prototype's stale 3-option <select>.
 * Uses native <select> + the prototype's `.select` CSS class — no shadcn / Radix.
 */

import { COPY } from '@/lib/copy'
import type { Provider } from '@/state/setup-store'

// Map dropdown ids (used by the prototype's COPY.LLM_SETUP.PROVIDERS) to the
// safeStorage Provider type (used by the sidecar /admin/llm-test endpoint).
export const ID_TO_PROVIDER: Record<string, Provider> = {
  lmstudio: 'lm_studio',
  custom: 'custom_openai',
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini'
}
export const PROVIDER_TO_ID: Record<Provider, string> = {
  lm_studio: 'lmstudio',
  custom_openai: 'custom',
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini'
}

interface Props {
  value: Provider
  onChange: (p: Provider) => void
}

export function ProviderSelect({ value, onChange }: Props) {
  const C = COPY.LLM_SETUP
  return (
    <>
      <select
        id="provider"
        className="select"
        value={PROVIDER_TO_ID[value]}
        onChange={(e) => {
          const id = e.target.value
          const provider = ID_TO_PROVIDER[id]
          if (!provider) return
          const meta = C.PROVIDERS.find((p) => p.id === id)
          if (!meta || !meta.enabled) return
          onChange(provider)
        }}
        aria-label="Provider"
      >
        {C.PROVIDERS.map((p) => (
          <option
            key={p.id}
            value={p.id}
            disabled={!p.enabled}
          >
            {p.label}
          </option>
        ))}
      </select>
      <div className="provider-list">
        {C.PROVIDERS.map((p) => (
          <div
            key={p.id}
            className={`row${p.enabled ? '' : ' disabled'}`}
          >
            <span className="name">· {p.label}</span>
            <span>{p.status}</span>
          </div>
        ))}
      </div>
    </>
  )
}
