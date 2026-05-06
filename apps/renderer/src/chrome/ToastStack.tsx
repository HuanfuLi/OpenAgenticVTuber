/* Transient toasts from the AppStore. Ported verbatim from prototype
 * src/shell.jsx ToastStack (lines 374–382). */
import { useStore } from '@/state/app-store'

export function ToastStack() {
  const { toasts } = useStore()
  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-theme-surface>
          {t.text}
        </div>
      ))}
    </div>
  )
}
