import type { VariantEntry } from '@contracts/variant-entry'
import { COPY } from '@/lib/copy'
import { X } from '@/lib/icons'
import styles from './AvatarImport.module.css'

export type RowBadge = 'new' | 'edited' | null

export const SLUG_VALIDATOR = /^[a-z][a-z0-9-]{0,30}$/
export const RESERVED_NAMES = new Set([
  'think',
  'thinking',
  'tool_call',
  'function_call',
  'function_calls',
  'invoke',
  'parameter'
])

interface VariantTableProps {
  variants: VariantEntry[]
  badges?: RowBadge[]
  onChange: (next: VariantEntry[]) => void
}

export function getVariantCodeErrors(variants: VariantEntry[]): Map<number, string> {
  const C = COPY.AVATAR_IMPORT
  const counts = new Map<string, number>()
  for (const variant of variants) {
    counts.set(variant.code, (counts.get(variant.code) ?? 0) + 1)
  }

  const errors = new Map<number, string>()
  variants.forEach((variant, index) => {
    if (!SLUG_VALIDATOR.test(variant.code)) {
      errors.set(index, C.VALIDATION_ERROR_SLUG)
      return
    }
    if (RESERVED_NAMES.has(variant.code)) {
      errors.set(index, C.VALIDATION_ERROR_RESERVED(variant.code))
      return
    }
    if ((counts.get(variant.code) ?? 0) > 1) {
      errors.set(index, C.VALIDATION_ERROR_DUPLICATE(variant.code))
    }
  })
  return errors
}

export function VariantTable({ variants, badges = [], onChange }: VariantTableProps) {
  const C = COPY.AVATAR_IMPORT
  const errors = getVariantCodeErrors(variants)

  const handleEdit = (index: number, code: string): void => {
    const next = [...variants]
    next[index] = { ...next[index]!, code }
    onChange(next)
  }

  const handleDelete = (index: number): void => {
    onChange(variants.filter((_, i) => i !== index))
  }

  if (variants.length === 0) {
    return <p className={styles.empty}>{C.VARIANTS_EMPTY}</p>
  }

  return (
    <table className={styles.table} data-testid="variant-table">
      <thead>
        <tr>
          <th>{C.CODE_HEADING}</th>
          <th>{C.SOURCE_NAME_HEADING}</th>
          <th>{C.PREVIEW_HEADING}</th>
          <th>
            <span className={styles.visuallyHidden}>{C.DELETE_LABEL}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {variants.map((variant, index) => {
          const error = errors.get(index)
          return (
            <tr key={`${variant.hotkey_id}-${index}`} data-testid={`variant-row-${index}`}>
              <td>
                <input
                  className={`${styles.input}${error ? ` ${styles.invalidInput}` : ''}`}
                  data-testid={`variant-code-input-${index}`}
                  value={variant.code}
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? `variant-code-error-${index}` : undefined}
                  onChange={(event) => handleEdit(index, event.target.value)}
                />
                {error && (
                  <div id={`variant-code-error-${index}`} className={styles.errorText}>
                    {error}
                  </div>
                )}
              </td>
              <td>
                <span className={styles.sourceName}>{variant.source_name}</span>
                {badges[index] === 'new' && (
                  <span className={styles.newBadge}>{C.NEW_BADGE}</span>
                )}
                {badges[index] === 'edited' && (
                  <span className={styles.editedBadge}>{C.EDITED_BADGE}</span>
                )}
              </td>
              <td>
                <code className={styles.preview}>{`{${variant.code}}`}</code>
              </td>
              <td className={styles.actionCell}>
                <button
                  type="button"
                  className={styles.iconButton}
                  data-testid={`variant-delete-${index}`}
                  aria-label={`${C.DELETE_LABEL}: ${variant.source_name}`}
                  title={C.DELETE_LABEL}
                  onClick={() => handleDelete(index)}
                >
                  <X size={14} />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
