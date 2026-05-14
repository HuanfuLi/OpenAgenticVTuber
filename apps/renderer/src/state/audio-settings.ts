export type VadSensitivity = 'low' | 'medium' | 'high'
export type NoHeadphonesStatus = 'ready' | 'limited' | 'unsafe'

export interface VoiceInputMicrophoneSettings {
  deviceId: string | null
  label: string | null
  suspectedSystemAudio: boolean
}

export interface VoiceInputNoHeadphonesSettings {
  status: NoHeadphonesStatus
  unsafeOverride: boolean
}

export interface VoiceOutputSettings {
  outputDeviceId: string | null
  outputDeviceLabel: string | null
}

export interface VoiceInputSettings {
  pttShortcut: string
  microphone: VoiceInputMicrophoneSettings
  noHeadphones: VoiceInputNoHeadphonesSettings
  vad: {
    enabled: boolean
    sensitivity: VadSensitivity
    silenceTimeoutMs: number
  }
}

export const VOICE_INPUT_SETTINGS_STORAGE_KEY = 'agenticllmvtuber.voiceInputSettings.v1'
export const VOICE_OUTPUT_SETTINGS_STORAGE_KEY = 'agenticllmvtuber.voiceOutputSettings.v1'
export const DEFAULT_PTT_SHORTCUT = 'Ctrl+Shift+Space'
export const DEFAULT_VAD_SILENCE_TIMEOUT_MS = 1800
export const SYSTEM_DEFAULT_AUDIO_OUTPUT_SINK_ID = 'default'
export const DEFAULT_VOICE_INPUT_MICROPHONE: VoiceInputMicrophoneSettings = {
  deviceId: null,
  label: null,
  suspectedSystemAudio: false
}
export const DEFAULT_VOICE_INPUT_NO_HEADPHONES: VoiceInputNoHeadphonesSettings = {
  status: 'unsafe',
  unsafeOverride: false
}
export const DEFAULT_VOICE_OUTPUT_SETTINGS: VoiceOutputSettings = {
  outputDeviceId: null,
  outputDeviceLabel: null
}

export const DEFAULT_VOICE_INPUT_SETTINGS: VoiceInputSettings = {
  pttShortcut: DEFAULT_PTT_SHORTCUT,
  microphone: DEFAULT_VOICE_INPUT_MICROPHONE,
  noHeadphones: DEFAULT_VOICE_INPUT_NO_HEADPHONES,
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
const outputListeners = new Set<(settings: VoiceOutputSettings) => void>()

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

export function isLikelySystemAudioInput(label: string | null | undefined): boolean {
  const normalized = (label ?? '').toLowerCase()
  if (!normalized.trim()) return false
  return [
    'stereo mix',
    'loopback',
    'monitor',
    'what u hear',
    'what you hear',
    'virtual cable',
    'vb-audio',
    'speaker',
    'speakers',
    'output',
    'desktop audio',
    'system audio',
    'wave out'
  ].some((pattern) => normalized.includes(pattern))
}

export function normalizeVoiceInputMicrophone(input: unknown): VoiceInputMicrophoneSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_VOICE_INPUT_MICROPHONE }
  const raw = input as Partial<VoiceInputMicrophoneSettings>
  const deviceId = typeof raw.deviceId === 'string' && raw.deviceId.trim() ? raw.deviceId.trim() : null
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : null
  const suspectedSystemAudio = raw.suspectedSystemAudio === true || isLikelySystemAudioInput(label)
  return { deviceId, label, suspectedSystemAudio }
}

export function normalizeNoHeadphonesSettings(input: unknown): VoiceInputNoHeadphonesSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_VOICE_INPUT_NO_HEADPHONES }
  const raw = input as Partial<VoiceInputNoHeadphonesSettings>
  const status = raw.status === 'ready' || raw.status === 'limited' || raw.status === 'unsafe'
    ? raw.status
    : DEFAULT_VOICE_INPUT_NO_HEADPHONES.status
  return {
    status,
    unsafeOverride: raw.unsafeOverride === true
  }
}

export function normalizeVoiceOutputSettings(input: unknown): VoiceOutputSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_VOICE_OUTPUT_SETTINGS }
  const raw = input as Partial<VoiceOutputSettings>
  const outputDeviceId = typeof raw.outputDeviceId === 'string' && raw.outputDeviceId.trim()
    ? raw.outputDeviceId.trim()
    : null
  const outputDeviceLabel = typeof raw.outputDeviceLabel === 'string' && raw.outputDeviceLabel.trim()
    ? raw.outputDeviceLabel.trim()
    : null
  return { outputDeviceId, outputDeviceLabel }
}

export function voiceInputAudioConstraints(microphone: VoiceInputMicrophoneSettings): MediaStreamConstraints {
  const base: MediaTrackConstraints = {
    channelCount: { ideal: 1 },
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true }
  }
  if (microphone.deviceId) {
    base.deviceId = { exact: microphone.deviceId }
  }
  return { audio: base }
}

export function normalizeVoiceInputSettings(input: unknown): VoiceInputSettings {
  if (!input || typeof input !== 'object') {
    return {
      ...DEFAULT_VOICE_INPUT_SETTINGS,
      microphone: { ...DEFAULT_VOICE_INPUT_SETTINGS.microphone },
      noHeadphones: { ...DEFAULT_VOICE_INPUT_SETTINGS.noHeadphones },
      vad: { ...DEFAULT_VOICE_INPUT_SETTINGS.vad }
    }
  }
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
  const noHeadphones = normalizeNoHeadphonesSettings(raw.noHeadphones)

  return {
    pttShortcut,
    microphone: normalizeVoiceInputMicrophone(raw.microphone),
    noHeadphones,
    vad: {
      enabled: rawVad.enabled === true && (noHeadphones.status !== 'unsafe' || noHeadphones.unsafeOverride),
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

export function saveVoiceInputSettings(settings: unknown): VoiceInputSettings {
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

export function loadVoiceOutputSettings(): VoiceOutputSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return normalizeVoiceOutputSettings(null)
  }
  const stored = window.localStorage.getItem(VOICE_OUTPUT_SETTINGS_STORAGE_KEY)
  if (!stored) return normalizeVoiceOutputSettings(null)
  try {
    return normalizeVoiceOutputSettings(JSON.parse(stored))
  } catch {
    return normalizeVoiceOutputSettings(null)
  }
}

export function saveVoiceOutputSettings(settings: unknown): VoiceOutputSettings {
  const normalized = normalizeVoiceOutputSettings(settings)
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(VOICE_OUTPUT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  }
  for (const listener of outputListeners) listener(normalized)
  return normalized
}

export function subscribeVoiceOutputSettings(listener: (settings: VoiceOutputSettings) => void): () => void {
  outputListeners.add(listener)
  return () => {
    outputListeners.delete(listener)
  }
}

export function selectedAudioOutputSinkId(settings: VoiceOutputSettings): string {
  return settings.outputDeviceId ?? SYSTEM_DEFAULT_AUDIO_OUTPUT_SINK_ID
}
