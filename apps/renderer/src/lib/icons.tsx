/** SPEC §Component Inventory — only the listed lucide icons.
 *  Hand-written inline SVGs (offline-first per local-first stance).
 *  Each is a function component that takes {size?, className?, style?, fill?, strokeWidth?}.
 *
 *  Ported verbatim from prototype src/lib/icons.jsx (2026-05-06).
 *  No `lucide-react` install (per DELTA conversion rule 5 — inline SVG is intentional).
 */
import type { CSSProperties, ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
  fill?: string
  strokeWidth?: number
}

function makeIcon(paths: ReactNode, viewBox = '0 0 24 24') {
  return function Icon({
    size = 16,
    className = '',
    style,
    fill = 'none',
    strokeWidth = 1.75
  }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill={fill}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        {paths}
      </svg>
    )
  }
}

export const Menu = makeIcon(
  <>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </>
)

export const Cpu = makeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="2" x2="9" y2="4" />
    <line x1="15" y1="2" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="22" />
    <line x1="15" y1="20" x2="15" y2="22" />
    <line x1="2" y1="9" x2="4" y2="9" />
    <line x1="2" y1="15" x2="4" y2="15" />
    <line x1="20" y1="9" x2="22" y2="9" />
    <line x1="20" y1="15" x2="22" y2="15" />
  </>
)

export const Hexagon = makeIcon(<path d="M21 7.5l-9-5-9 5v9l9 5 9-5v-9z" />)

export const MessageSquare = makeIcon(
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
)

export const Wand2 = makeIcon(
  <>
    <path d="M15 4l3 3" />
    <path d="M3 21l11-11 4 4-11 11H3v-4z" />
    <path d="M19 4l2 2" />
    <path d="M14 9l1 1" />
  </>
)

export const Settings = makeIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>
)

export const ChevronDown = makeIcon(<polyline points="6 9 12 15 18 9" />)
export const ChevronUp = makeIcon(<polyline points="18 15 12 9 6 15" />)
export const X = makeIcon(
  <>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </>
)
export const Plus = makeIcon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
)
export const RotateCw = makeIcon(
  <>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15A9 9 0 1 1 18 6.36L23 10" />
  </>
)
export const ExternalLink = makeIcon(
  <>
    <path d="M14 3h7v7" />
    <path d="M10 14L21 3" />
    <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
  </>
)
export const Folder = makeIcon(
  <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
)
export const Circle = makeIcon(<circle cx="12" cy="12" r="9" />)
export const Send = makeIcon(
  <>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </>
)
export const Mic = makeIcon(
  <>
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
    <path d="M12 19v3" />
    <path d="M8 22h8" />
  </>
)
export const Search = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </>
)
export const Wrench = makeIcon(
  <path d="M14.7 6.3a4 4 0 1 0 4 6.6L21 21l-2.5 2.5-8.1-2.5a4 4 0 1 0-6.6-4L8 11" />
)
export const Lock = makeIcon(
  <>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </>
)
export const Unlock = makeIcon(
  <>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7-2.5" />
  </>
)

export const ICONS = {
  Menu,
  Cpu,
  Hexagon,
  MessageSquare,
  Wand2,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  RotateCw,
  ExternalLink,
  Folder,
  Circle,
  Send,
  Mic,
  Search,
  Wrench,
  Lock,
  Unlock
}
