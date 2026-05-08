import type { EventEntry } from '@contracts/event-entry'
import { COPY } from '@/lib/copy'
import { X } from '@/lib/icons'
import styles from './AvatarImport.module.css'

interface EventTableProps {
  events: EventEntry[]
  onChange: (next: EventEntry[]) => void
}

export function EventTable({ events, onChange }: EventTableProps) {
  const C = COPY.AVATAR_IMPORT

  const handleEdit = (index: number, code: string): void => {
    const next = [...events]
    next[index] = { ...next[index]!, code }
    onChange(next)
  }

  const handleDelete = (index: number): void => {
    onChange(events.filter((_, i) => i !== index))
  }

  if (events.length === 0) {
    return <p className={styles.empty}>{C.EVENTS_EMPTY}</p>
  }

  return (
    <table className={styles.table} data-testid="event-table">
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
        {events.map((event, index) => (
          <tr key={`${event.motion_file}-${index}`} data-testid={`event-row-${index}`}>
            <td>
              <input
                className={styles.input}
                data-testid={`event-code-input-${index}`}
                value={event.code}
                onChange={(e) => handleEdit(index, e.target.value)}
              />
            </td>
            <td>
              <span className={styles.sourceName}>{event.motion_file}</span>
            </td>
            <td>
              <code className={styles.preview}>{`<${event.code}>`}</code>
            </td>
            <td className={styles.actionCell}>
              <button
                type="button"
                className={styles.iconButton}
                data-testid={`event-delete-${index}`}
                aria-label={`${C.DELETE_LABEL}: ${event.motion_file}`}
                title={C.DELETE_LABEL}
                onClick={() => handleDelete(index)}
              >
                <X size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
