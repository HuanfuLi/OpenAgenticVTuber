import type { VoiceInputMicrophoneSettings } from '@/state/audio-settings'

export type AecCaptureSource = 'ptt' | 'vad'

export interface AecSupportedConstraints {
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  channelCount: boolean
  deviceId: boolean
}

export interface AecDiagnosticSnapshot {
  source: AecCaptureSource
  updatedAt: number
  selectedInput: {
    label: string | null
    deviceIdPresent: boolean
    suspectedSystemAudio: boolean
  }
  supportedConstraints: AecSupportedConstraints
  requested: {
    echoCancellation: unknown
    noiseSuppression: unknown
    autoGainControl: unknown
    channelCount: unknown
    deviceId: 'exact' | 'none'
  }
  applied: {
    echoCancellation: unknown
    noiseSuppression: unknown
    autoGainControl: unknown
    channelCount: number | null
    sampleRate: number | null
    deviceIdPresent: boolean
    groupIdPresent: boolean
  }
  capabilities: {
    echoCancellation: unknown
    noiseSuppression: unknown
    autoGainControl: unknown
    channelCount: unknown
    sampleRate: unknown
  }
  trackConstraints: {
    echoCancellation: unknown
    noiseSuppression: unknown
    autoGainControl: unknown
    channelCount: unknown
    deviceId: 'exact' | 'none' | 'unknown'
  }
}

type TrackLike = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities
  getConstraints?: () => MediaTrackConstraints
}

function audioConstraints(constraints: MediaStreamConstraints): MediaTrackConstraints | null {
  if (!constraints.audio || typeof constraints.audio !== 'object') return null
  return constraints.audio as MediaTrackConstraints
}

function supported(mediaDevices?: MediaDevices): AecSupportedConstraints {
  const raw = typeof mediaDevices?.getSupportedConstraints === 'function'
    ? mediaDevices.getSupportedConstraints()
    : {}
  return {
    echoCancellation: raw.echoCancellation === true,
    noiseSuppression: raw.noiseSuppression === true,
    autoGainControl: raw.autoGainControl === true,
    channelCount: raw.channelCount === true,
    deviceId: raw.deviceId === true
  }
}

function firstAudioTrack(stream: MediaStream): TrackLike | null {
  const tracks = typeof stream.getAudioTracks === 'function'
    ? stream.getAudioTracks()
    : stream.getTracks().filter((track) => track.kind === 'audio')
  return (tracks[0] ?? stream.getTracks()[0] ?? null) as TrackLike | null
}

function getRecordValue(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined
  return (source as Record<string, unknown>)[key]
}

function deviceConstraintState(value: unknown): 'exact' | 'none' | 'unknown' {
  if (!value) return 'none'
  if (typeof value === 'object' && getRecordValue(value, 'exact')) return 'exact'
  return 'unknown'
}

export function captureAecDiagnostics(input: {
  source: AecCaptureSource
  stream: MediaStream
  constraints: MediaStreamConstraints
  microphone: VoiceInputMicrophoneSettings
  mediaDevices?: MediaDevices
  now?: () => number
}): AecDiagnosticSnapshot {
  const track = firstAudioTrack(input.stream)
  const requested = audioConstraints(input.constraints)
  const applied = track?.getSettings?.() ?? {}
  const capabilities = track?.getCapabilities?.() ?? {}
  const trackConstraints = track?.getConstraints?.() ?? {}

  return {
    source: input.source,
    updatedAt: (input.now ?? Date.now)(),
    selectedInput: {
      label: input.microphone.label,
      deviceIdPresent: Boolean(input.microphone.deviceId),
      suspectedSystemAudio: input.microphone.suspectedSystemAudio
    },
    supportedConstraints: supported(input.mediaDevices),
    requested: {
      echoCancellation: requested?.echoCancellation,
      noiseSuppression: requested?.noiseSuppression,
      autoGainControl: requested?.autoGainControl,
      channelCount: requested?.channelCount,
      deviceId: input.microphone.deviceId ? 'exact' : 'none'
    },
    applied: {
      echoCancellation: getRecordValue(applied, 'echoCancellation'),
      noiseSuppression: getRecordValue(applied, 'noiseSuppression'),
      autoGainControl: getRecordValue(applied, 'autoGainControl'),
      channelCount: typeof applied.channelCount === 'number' ? applied.channelCount : null,
      sampleRate: typeof applied.sampleRate === 'number' ? applied.sampleRate : null,
      deviceIdPresent: Boolean(applied.deviceId),
      groupIdPresent: Boolean(applied.groupId)
    },
    capabilities: {
      echoCancellation: getRecordValue(capabilities, 'echoCancellation'),
      noiseSuppression: getRecordValue(capabilities, 'noiseSuppression'),
      autoGainControl: getRecordValue(capabilities, 'autoGainControl'),
      channelCount: getRecordValue(capabilities, 'channelCount'),
      sampleRate: getRecordValue(capabilities, 'sampleRate')
    },
    trackConstraints: {
      echoCancellation: getRecordValue(trackConstraints, 'echoCancellation'),
      noiseSuppression: getRecordValue(trackConstraints, 'noiseSuppression'),
      autoGainControl: getRecordValue(trackConstraints, 'autoGainControl'),
      channelCount: getRecordValue(trackConstraints, 'channelCount'),
      deviceId: deviceConstraintState(getRecordValue(trackConstraints, 'deviceId'))
    }
  }
}
