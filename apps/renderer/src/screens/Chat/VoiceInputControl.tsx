import { useEffect, useMemo, useRef } from 'react'
import { Mic } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { VoiceCapture } from '@/audio/voice-capture'
import {
  clearQueuedFinalCandidate,
  patchVoiceInputState,
  refreshVoiceInputReadiness,
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

export function VoiceInputControl({
  sessionId,
  turnInProgress,
  onOpenSetup
}: VoiceInputControlProps) {
  const voice = useVoiceInput()
  const captureRef = useRef<VoiceCapture | null>(null)
  const shortcutDownRef = useRef(false)
  const turnInProgressRef = useRef(turnInProgress)
  turnInProgressRef.current = turnInProgress

  const ready = voice.readiness?.ready === true
  const canRequestPermission =
    voice.permissionState === 'prompt' || voice.readiness?.setup_destination === 'microphone_permission'
  const canRecord =
    (ready || canRequestPermission) &&
    voice.captureStatus !== 'finalizing' &&
    voice.captureStatus !== 'queued'
  const shortcut = useMemo(() => parseShortcut(voice.settings.pttShortcut), [voice.settings.pttShortcut])
  const stateLabel = statusLabel(voice.captureStatus)
  const blockedText = voice.error ?? voice.readiness?.summary ?? COPY.CHAT.VOICE_BLOCKED
  const needsSetup = !ready || voice.permissionState !== 'granted'

  useEffect(() => {
    void refreshVoiceInputReadiness()
  }, [])

  useEffect(() => {
    return () => {
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
    let readiness = voice.readiness
    if (!readiness) readiness = await refreshVoiceInputReadiness()
    if (readiness?.permission_state === 'prompt' || readiness?.setup_destination === 'microphone_permission') {
      const permissionState = await window.api.requestMicrophonePermission()
      patchVoiceInputState({ permissionState })
      readiness = await refreshVoiceInputReadiness()
    }
    return readiness?.ready === true
  }

  const startCapture = async (): Promise<void> => {
    if (voice.captureStatus === 'queued') return
    const permissionReady = await requestPermissionIfNeeded()
    if (!permissionReady) {
      patchVoiceInputState({
        captureStatus: 'permission_needed',
        error: voice.readiness?.summary ?? COPY.CHAT.VOICE_PERMISSION_NEEDED
      })
      return
    }
    await getCapture().start()
  }

  const stopCapture = async (): Promise<void> => {
    await captureRef.current?.stop()
  }

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
      {(voice.error || !ready) && (
        <div className="voice-error" role="note">
          {blockedText}
        </div>
      )}
    </div>
  )
}
