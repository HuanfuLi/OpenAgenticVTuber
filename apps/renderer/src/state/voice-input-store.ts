import { useEffect, useState } from 'react'
import type {
  CaptureStatus,
  PermissionState,
  VoiceInputReadiness,
  VoiceInputTranscriptionResult
} from '@contracts/audio-provider'
import {
  loadVoiceInputSettings,
  subscribeVoiceInputSettings,
  type VadSensitivity,
  type VoiceInputSettings
} from './audio-settings'
import type { AecDiagnosticSnapshot } from '@/audio/aec-diagnostics'

export interface VoiceTranscriptCandidate {
  sequenceId: string
  transcript: string
  durationMs: number | null
  providerId: VoiceInputTranscriptionResult['provider_id']
}

export type VadIgnoredReason = 'turn_in_progress' | null

export interface VoiceVadDiagnostics {
  monitoring: boolean
  level: number
  threshold: number
  sensitivity: VadSensitivity
  speechDetected: boolean
  recording: boolean
  ignoredReason: VadIgnoredReason
  updatedAt: number
}

export interface VoiceInputState {
  readiness: VoiceInputReadiness | null
  permissionState: PermissionState
  captureStatus: CaptureStatus
  finalCandidate: VoiceTranscriptCandidate | null
  queuedFinalCandidate: VoiceTranscriptCandidate | null
  vadDiagnostics: VoiceVadDiagnostics | null
  aecDiagnostics: AecDiagnosticSnapshot | null
  error: string | null
  settings: VoiceInputSettings
}

type Listener = (state: VoiceInputState) => void

const listeners = new Set<Listener>()
export const VOICE_INPUT_CONFIG_CHANGED_EVENT = 'voice-input-config-changed'
export const VOICE_INPUT_AEC_DIAGNOSTICS_STORAGE_KEY = 'agenticllmvtuber.voiceInputAecDiagnostics.v1'
const FUNASR_METADATA_PATTERN = /<\|[^<>|]+\|>/g

function cleanVoiceTranscript(
  transcript: string | null,
  providerId: VoiceInputTranscriptionResult['provider_id']
): string {
  if (!transcript) return ''
  const normalized = providerId === 'funasr'
    ? transcript.replace(FUNASR_METADATA_PATTERN, ' ')
    : transcript
  return normalized.trim().replace(/\s+/g, ' ')
}

function loadAecDiagnostics(): AecDiagnosticSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  const stored = window.localStorage.getItem(VOICE_INPUT_AEC_DIAGNOSTICS_STORAGE_KEY)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as Partial<AecDiagnosticSnapshot>
    if ((parsed.source !== 'ptt' && parsed.source !== 'vad') || typeof parsed.updatedAt !== 'number') {
      return null
    }
    return parsed as AecDiagnosticSnapshot
  } catch {
    return null
  }
}

function persistAecDiagnostics(diagnostics: AecDiagnosticSnapshot | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (!diagnostics) {
    window.localStorage.removeItem(VOICE_INPUT_AEC_DIAGNOSTICS_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(VOICE_INPUT_AEC_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(diagnostics))
}

function initialState(): VoiceInputState {
  return {
    readiness: null,
    permissionState: 'unknown',
    captureStatus: 'idle',
    finalCandidate: null,
    queuedFinalCandidate: null,
    vadDiagnostics: null,
    aecDiagnostics: loadAecDiagnostics(),
    error: null,
    settings: loadVoiceInputSettings()
  }
}

let state = initialState()

subscribeVoiceInputSettings((settings) => {
  patchVoiceInputState({ settings, vadDiagnostics: settings.vad.enabled ? state.vadDiagnostics : null })
})

function emit(): void {
  for (const listener of listeners) listener(state)
}

export function getVoiceInputState(): VoiceInputState {
  return state
}

export function subscribeVoiceInput(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

export function patchVoiceInputState(patch: Partial<VoiceInputState>): VoiceInputState {
  state = { ...state, ...patch }
  emit()
  return state
}

export function setVoiceCaptureStatus(captureStatus: CaptureStatus, error: string | null = null): VoiceInputState {
  return patchVoiceInputState({ captureStatus, error })
}

export function setVoiceVadDiagnostics(
  diagnostics: Omit<VoiceVadDiagnostics, 'updatedAt'> | null
): VoiceInputState {
  return patchVoiceInputState({
    vadDiagnostics: diagnostics ? { ...diagnostics, updatedAt: Date.now() } : null
  })
}

export function setVoiceAecDiagnostics(diagnostics: AecDiagnosticSnapshot | null): VoiceInputState {
  persistAecDiagnostics(diagnostics)
  return patchVoiceInputState({ aecDiagnostics: diagnostics })
}

function readinessError(readiness: VoiceInputReadiness): string | null {
  if (readiness.ready) return null
  if (readiness.blocked_reason === 'sidecar_unavailable') return null
  return readiness.summary
}

export async function refreshVoiceInputReadiness(): Promise<VoiceInputReadiness | null> {
  try {
    const readiness = await window.api.getVoiceInputReadiness()
    const captureStatus: CaptureStatus = readiness.ready
      ? state.captureStatus === 'error' || state.captureStatus === 'permission_needed'
        ? 'idle'
        : state.captureStatus
      : readiness.capture_status
    patchVoiceInputState({
      readiness,
      permissionState: readiness.permission_state,
      captureStatus,
      vadDiagnostics: readiness.ready ? state.vadDiagnostics : null,
      error: readinessError(readiness)
    })
    return readiness
  } catch (error) {
    patchVoiceInputState({
      captureStatus: 'error',
      permissionState: 'unexpected_failure',
      error: error instanceof Error ? error.message : 'Voice input readiness failed.'
    })
    return null
  }
}

export function notifyVoiceInputConfigChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(VOICE_INPUT_CONFIG_CHANGED_EVENT))
}

export function applyFinalResult(result: VoiceInputTranscriptionResult, turnInProgress = false): VoiceInputState {
  if (!result.ok) {
    return patchVoiceInputState({
      captureStatus: 'error',
      error: result.summary
    })
  }
  const transcript = cleanVoiceTranscript(result.transcript, result.provider_id)
  if (!transcript) {
    return patchVoiceInputState({
      captureStatus: 'idle',
      finalCandidate: null,
      error: 'No speech detected.'
    })
  }
  const candidate: VoiceTranscriptCandidate = {
    sequenceId: result.sequence_id,
    transcript,
    durationMs: result.duration_ms,
    providerId: result.provider_id
  }
  if (turnInProgress) {
    return patchVoiceInputState({
      captureStatus: 'queued',
      queuedFinalCandidate: candidate,
      error: state.queuedFinalCandidate ? 'Queued voice replaced.' : null
    })
  }
  return patchVoiceInputState({
    captureStatus: 'idle',
    finalCandidate: candidate,
    error: null
  })
}

export function consumeFinalCandidate(): VoiceTranscriptCandidate | null {
  const candidate = state.finalCandidate
  if (candidate) patchVoiceInputState({ finalCandidate: null })
  return candidate
}

export function queueFinalCandidate(candidate: VoiceTranscriptCandidate, replacedMessage = 'Queued voice replaced.'): VoiceInputState {
  return patchVoiceInputState({
    captureStatus: 'queued',
    finalCandidate: null,
    queuedFinalCandidate: candidate,
    error: state.queuedFinalCandidate ? replacedMessage : null
  })
}

export function clearQueuedFinalCandidate(): VoiceInputState {
  return patchVoiceInputState({
    captureStatus: state.captureStatus === 'queued' ? 'idle' : state.captureStatus,
    queuedFinalCandidate: null,
    error: null
  })
}

export function promoteQueuedFinalCandidate(): VoiceTranscriptCandidate | null {
  const candidate = state.queuedFinalCandidate
  if (candidate) {
    patchVoiceInputState({
      captureStatus: 'idle',
      queuedFinalCandidate: null,
      finalCandidate: candidate
    })
  }
  return candidate
}

export function resetVoiceInputStoreForTests(): void {
  state = initialState()
  emit()
}

export function useVoiceInput(): VoiceInputState {
  const [snapshot, setSnapshot] = useState(state)
  useEffect(() => subscribeVoiceInput(setSnapshot), [])
  return snapshot
}
