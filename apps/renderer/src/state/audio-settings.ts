export type VadSensitivity = 'low' | 'medium' | 'high'

export interface VoiceInputSettings {
  pttShortcut: string
  vad: {
    enabled: boolean
    sensitivity: VadSensitivity
    silenceTimeoutMs: number
  }
}

export const VOICE_INPUT_SETTINGS_STORAGE_KEY = 'agenticllmvtuber.voiceInputSettings.v1'
export const DEFAULT_PTT_SHORTCUT = 'Ctrl+Shift+Space'
export const DEFAULT_VAD_SILENCE_TIMEOUT_MS = 1800

export const DEFAULT_VOICE_INPUT_SETTINGS: VoiceInputSettings = {
  pttShortcut: DEFAULT_PTT_SHORTCUT,
  vad: {
    enabled: false,
    sensitivity: 'low',
    silenceTimeoutMs: DEFAULT_VAD_SILENCE_TIMEOUT_MS
  }
}

const RESERVED_SHORTCUTS = new Set([
  'Alt+F4',
  'Alt+Space',
  'Ctrl+R',
  'Ctrl+Shift+I',
  'Ctrl+W',
  'F5',
  'Meta+Q'
])

const listeners = new Set<(settings: VoiceInputSettings) => void>()

export function normalizeShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'control') return 'Ctrl'
      if (lower === 'ctrl') return 'Ctrl'
      if (lower === 'shift') return 'Shift'
      if (lower === 'alt') return 'Alt'
      if (lower === 'option') return 'Alt'
      if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'Meta'
      if (lower === 'space') return 'Space'
      if (/^f\d{1,2}$/i.test(part)) return part.toUpperCase()
      return part.length === 1 ? part.toUpperCase() : part
    })
    .join('+')
}

export function isReservedShortcut(shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut)
  return RESERVED_SHORTCUTS.has(normalized)
}

export function normalizeVoiceInputSettings(input: unknown): VoiceInputSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_VOICE_INPUT_SETTINGS, vad: { ...DEFAULT_VOICE_INPUT_SETTINGS.vad } }
  const raw = input as Partial<VoiceInputSettings>
  const rawVad: Partial<VoiceInputSettings['vad']> = raw.vad && typeof raw.vad === 'object' ? raw.vad : {}
  const sensitivity = rawVad.sensitivity === 'low' || rawVad.sensitivity === 'high' || rawVad.sensitivity === 'medium'
    ? rawVad.sensitivity
    : DEFAULT_VOICE_INPUT_SETTINGS.vad.sensitivity
  const silenceTimeoutMs = typeof rawVad.silenceTimeoutMs === 'number' && Number.isFinite(rawVad.silenceTimeoutMs)
    ? Math.min(5000, Math.max(500, Math.round(rawVad.silenceTimeoutMs)))
    : DEFAULT_VOICE_INPUT_SETTINGS.vad.silenceTimeoutMs
  const pttShortcut = normalizeShortcut(typeof raw.pttShortcut === 'string' && raw.pttShortcut.trim()
    ? raw.pttShortcut
    : DEFAULT_PTT_SHORTCUT)

  return {
    pttShortcut,
    vad: {
      enabled: rawVad.enabled === true,
      sensitivity,
      silenceTimeoutMs
    }
  }
}

export function loadVoiceInputSettings(): VoiceInputSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return normalizeVoiceInputSettings(null)
  }
  const stored = window.localStorage.getItem(VOICE_INPUT_SETTINGS_STORAGE_KEY)
  if (!stored) return normalizeVoiceInputSettings(null)
  try {
    return normalizeVoiceInputSettings(JSON.parse(stored))
  } catch {
    return normalizeVoiceInputSettings(null)
  }
}

export function saveVoiceInputSettings(settings: VoiceInputSettings): VoiceInputSettings {
  const normalized = normalizeVoiceInputSettings(settings)
  if (isReservedShortcut(normalized.pttShortcut)) {
    throw new Error(`Shortcut ${normalized.pttShortcut} is reserved by the app or operating system.`)
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(VOICE_INPUT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  }
  for (const listener of listeners) listener(normalized)
  return normalized
}

export function subscribeVoiceInputSettings(listener: (settings: VoiceInputSettings) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
