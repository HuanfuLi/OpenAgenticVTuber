// Tiny class-name composer (replaces clsx/classnames; we don't install those deps).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
