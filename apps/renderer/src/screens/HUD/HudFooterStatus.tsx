import { COPY } from '@/lib/copy'

export function HudFooterStatus({ paramCount, lockCount }: { paramCount: number; lockCount: number }) {
  return (
    <footer className="hud-footer">
      {COPY.HUD.FOOTER_TEMPLATE.replace('{N}', String(paramCount)).replace('{M}', String(lockCount))}
    </footer>
  )
}
