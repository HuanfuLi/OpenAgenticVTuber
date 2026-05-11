import { useEffect, useMemo, useRef } from 'react'
import { Mic } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { VoiceCapture } from '@/audio/voice-capture'
import { VadController } from '@/audio/vad-controller'
import { subscribeSidecarReconnect } from '@/ws/client'
import {
  clearQueuedFinalCandidate,
  patchVoiceInputState,
  refreshVoiceInputReadiness,
  VOICE_INPUT_CONFIG_CHANGED_EVENT,
  useVoiceInput
} from '@/state/voice-input-store'

interface VoiceInputControlProps {
  sessionId: string
  turnInProgress: boolean
  onOpenSetup: () => void
}

interface ShortcutParts {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

function parseShortcut(shortcut: string): ShortcutParts {
  const parts = shortcut.split('+').map((part) => part.trim().toLowerCase()).filter(Boolean)
  return {
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    key: parts.find((part) => !['ctrl', 'control', 'shift', 'alt', 'option', 'meta', 'cmd', 'command'].includes(part)) ?? ''
  }
}

function eventMatchesShortcut(event: KeyboardEvent, shortcut: ShortcutParts): boolean {
  const key = event.key.toLowerCase() === ' ' ? 'space' : event.key.toLowerCase()
  return (
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta &&
    key === shortcut.key
  )
}

function statusLabel(status: ReturnType<typeof useVoiceInput>['captureStatus']): string {
  if (status === 'listening') return COPY.CHAT.VOICE_LISTENING
  if (status === 'recording') return COPY.CHAT.VOICE_RECORDING
  if (status === 'previewing') return COPY.CHAT.VOICE_PREVIEWING
  if (status === 'finalizing') return COPY.CHAT.VOICE_FINALIZING
  if (status === 'queued') return COPY.CHAT.VOICE_QUEUED
  if (status === 'error') return COPY.CHAT.VOICE_ERROR
  return COPY.CHAT.VOICE_IDLE
}

function vadStatusLabel(
  vadEnabled: boolean,
  status: ReturnType<typeof useVoiceInput>['captureStatus']
): string {
  if (!vadEnabled) return statusLabel(status)
  if (status === 'idle') return COPY.CHAT.VOICE_VAD_READY
  if (status === 'listening') return COPY.CHAT.VOICE_VAD_ACTIVE
  return statusLabel(status)
}

export function VoiceInputControl({
  sessionId,
  turnInProgress,
  onOpenSetup
}: VoiceInputControlProps) {
  const voice = useVoiceInput()
  const captureRef = useRef<VoiceCapture | null>(null)
  const vadRef = useRef<VadController | null>(null)
  const voiceRef = useRef(voice)
  const shortcutDownRef = useRef(false)
  const turnInProgressRef = useRef(turnInProgress)
  voiceRef.current = voice
  turnInProgressRef.current = turnInProgress

  const ready = voice.readiness?.ready === true
  const canRequestPermission =
    voice.permissionState === 'prompt' || voice.readiness?.setup_destination === 'microphone_permission'
  const canRecord =
    (ready || canRequestPermission) &&
    voice.captureStatus !== 'finalizing' &&
    voice.captureStatus !== 'queued'
  const shortcut = useMemo(() => parseShortcut(voice.settings.pttShortcut), [voice.settings.pttShortcut])
  const stateLabel = vadStatusLabel(voice.settings.vad.enabled, voice.captureStatus)
  const recoverableSidecarUnavailable =
    voice.readiness?.ready === false && voice.readiness.blocked_reason === 'sidecar_unavailable'
  const blockedText = voice.error ?? (recoverableSidecarUnavailable ? null : voice.readiness?.summary) ?? COPY.CHAT.VOICE_BLOCKED
  const needsSetup = !ready || voice.permissionState !== 'granted'

  useEffect(() => {
    void refreshVoiceInputReadiness()
  }, [])

  useEffect(() => {
    const refresh = (): void => {
      void refreshVoiceInputReadiness()
    }
    const offReady = window.api?.onSidecarReady?.(() => refresh()) ?? (() => undefined)
    const offReconnect = subscribeSidecarReconnect(() => refresh())
    window.addEventListener(VOICE_INPUT_CONFIG_CHANGED_EVENT, refresh)
    return () => {
      offReady()
      offReconnect()
      window.removeEventListener(VOICE_INPUT_CONFIG_CHANGED_EVENT, refresh)
    }
  }, [])

  useEffect(() => {
    if (!recoverableSidecarUnavailable) return
    const retry = window.setInterval(() => {
      void refreshVoiceInputReadiness()
    }, 1_000)
    return () => window.clearInterval(retry)
  }, [recoverableSidecarUnavailable])

  useEffect(() => {
    return () => {
      void vadRef.current?.stop()
      vadRef.current = null
      captureRef.current?.dispose()
      captureRef.current = null
    }
  }, [])

  useEffect(() => {
    captureRef.current?.dispose()
    captureRef.current = null
  }, [sessionId])

  const getCapture = (): VoiceCapture => {
    if (!captureRef.current) {
      captureRef.current = new VoiceCapture({
        sessionId,
        turnInProgress: () => turnInProgressRef.current
      })
    }
    return captureRef.current
  }

  const requestPermissionIfNeeded = async (): Promise<boolean> => {
    let readiness = voiceRef.current.readiness
    if (!readiness) readiness = await refreshVoiceInputReadiness()
    if (readiness?.permission_state === 'prompt' || readiness?.setup_destination === 'microphone_permission') {
      const permissionState = await window.api.requestMicrophonePermission()
      patchVoiceInputState({ permissionState })
      readiness = await refreshVoiceInputReadiness()
    }
    return readiness?.ready === true
  }

  const startCapture = async (): Promise<boolean> => {
    if (voiceRef.current.captureStatus === 'queued' || voiceRef.current.captureStatus === 'finalizing') {
      return false
    }
    const permissionReady = await requestPermissionIfNeeded()
    if (!permissionReady) {
      patchVoiceInputState({
        captureStatus: 'permission_needed',
        error: voiceRef.current.readiness?.summary ?? COPY.CHAT.VOICE_PERMISSION_NEEDED
      })
      return false
    }
    await getCapture().start()
    return true
  }

  const stopCapture = async (): Promise<void> => {
    await captureRef.current?.stop()
  }

  useEffect(() => {
    if (!voice.settings.vad.enabled || !ready || voice.permissionState !== 'granted') {
      void vadRef.current?.stop()
      vadRef.current = null
      return
    }

    const vad = new VadController(
      {
        sensitivity: voice.settings.vad.sensitivity,
        silenceTimeoutMs: voice.settings.vad.silenceTimeoutMs
      },
      {
        startRecording: startCapture,
        stopRecording: stopCapture,
        isRecording: () => captureRef.current?.active === true,
        shouldIgnoreSpeech: () => turnInProgressRef.current,
        onMonitoringChange: (monitoring) => {
          const currentVoice = voiceRef.current
          if (monitoring) {
            if (currentVoice.captureStatus === 'idle') patchVoiceInputState({ captureStatus: 'listening', error: null })
          } else if (currentVoice.captureStatus === 'listening') {
            patchVoiceInputState({ captureStatus: 'idle' })
          }
        },
        onError: (message) => {
          patchVoiceInputState({ captureStatus: 'error', error: message })
        }
      }
    )
    vadRef.current = vad
    void vad.start()
    return () => {
      if (vadRef.current === vad) vadRef.current = null
      void vad.stop()
    }
  }, [
    ready,
    sessionId,
    voice.permissionState,
    voice.settings.vad.enabled,
    voice.settings.vad.sensitivity,
    voice.settings.vad.silenceTimeoutMs
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (shortcutDownRef.current || !eventMatchesShortcut(event, shortcut)) return
      event.preventDefault()
      shortcutDownRef.current = true
      void startCapture()
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (!shortcutDownRef.current) return
      const key = event.key.toLowerCase() === ' ' ? 'space' : event.key.toLowerCase()
      if (key !== shortcut.key) return
      event.preventDefault()
      shortcutDownRef.current = false
      void stopCapture()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [shortcut])

  return (
    <div className="voice-input" data-capture-status={voice.captureStatus}>
      <button
        type="button"
        className="voice-mic"
        aria-label={COPY.CHAT.VOICE_MIC}
        aria-pressed={voice.captureStatus === 'recording' || voice.captureStatus === 'previewing'}
        disabled={!canRecord}
        title={`${stateLabel} (${voice.settings.pttShortcut})`}
        onPointerDown={(event) => {
          event.preventDefault()
          void startCapture()
        }}
        onPointerUp={(event) => {
          event.preventDefault()
          void stopCapture()
        }}
        onPointerCancel={() => {
          void captureRef.current?.cancel()
        }}
        onPointerLeave={() => {
          if (captureRef.current?.active) void stopCapture()
        }}
      >
        <Mic size={16} />
      </button>
      <div className="voice-state" role="status" aria-live="polite">
        <span className="voice-state-main">{stateLabel}</span>
        <span className="voice-state-sub">{voice.settings.pttShortcut}</span>
      </div>
      {voice.settings.vad.enabled && (
        <span className="voice-vad-chip" title={COPY.SETTINGS.VOICE_IN_VAD_HELP}>
          {COPY.SETTINGS.VOICE_IN_INPUT_VAD}
        </span>
      )}
      {needsSetup && (
        <button type="button" className="btn btn-link voice-setup" onClick={onOpenSetup}>
          {COPY.CHAT.VOICE_SETUP}
        </button>
      )}
      {voice.previewTranscript && (
        <div className="voice-preview" data-testid="voice-preview">
          {voice.previewTranscript}
        </div>
      )}
      {voice.captureStatus === 'finalizing' && (
        <div className="voice-preview" data-testid="voice-finalizing">
          {COPY.CHAT.VOICE_FINALIZING}
        </div>
      )}
      {voice.settings.vad.enabled && turnInProgress && (
        <div className="voice-preview" data-testid="voice-vad-blocked">
          {COPY.CHAT.VOICE_VAD_BLOCKED}
        </div>
      )}
      {voice.queuedFinalCandidate && (
        <div className="voice-preview queued" data-testid="voice-queued">
          <span>{COPY.CHAT.VOICE_QUEUED_PENDING}: {voice.queuedFinalCandidate.transcript}</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => clearQueuedFinalCandidate()}
          >
            {COPY.CHAT.VOICE_QUEUED_CANCEL}
          </button>
        </div>
      )}
      {(voice.error || (!ready && !recoverableSidecarUnavailable)) && (
        <div className="voice-error" role="note">
          {blockedText}
        </div>
      )}
    </div>
  )
}
