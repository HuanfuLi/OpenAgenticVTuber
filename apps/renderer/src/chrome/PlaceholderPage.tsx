/* Branded placeholder for non-functional milestone-N surfaces. */
import type { ReactNode } from 'react'

interface PlaceholderPageProps {
  Icon?: (props: { size?: number; className?: string; style?: React.CSSProperties }) => ReactNode
  title: string
  body: string
}

export function PlaceholderPage({ Icon, title, body }: PlaceholderPageProps) {
  return (
    <div className="empty-state grow">
      {Icon && (
        <div style={{ marginBottom: 8, color: 'var(--muted-foreground)' }}>
          <Icon size={40} />
        </div>
      )}
      <h2>{title}</h2>
      <p style={{ maxWidth: 320 }}>{body}</p>
    </div>
  )
}
