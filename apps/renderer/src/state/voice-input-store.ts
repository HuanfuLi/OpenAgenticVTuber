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
  type VoiceInputSettings
} from './audio-settings'

export interface VoiceTranscriptCandidate {
  sequenceId: string
  transcript: string
  durationMs: number | null
  providerId: VoiceInputTranscriptionResult['provider_id']
}

export interface VoiceInputState {
  readiness: VoiceInputReadiness | null
  permissionState: PermissionState
  captureStatus: CaptureStatus
  previewTranscript: string | null
  previewSequenceId: string | null
  finalCandidate: VoiceTranscriptCandidate | null
  queuedFinalCandidate: VoiceTranscriptCandidate | null
  error: string | null
  settings: VoiceInputSettings
}

type Listener = (state: VoiceInputState) => void

const listeners = new Set<Listener>()

function initialState(): VoiceInputState {
  return {
    readiness: null,
    permissionState: 'unknown',
    captureStatus: 'idle',
    previewTranscript: null,
    previewSequenceId: null,
    finalCandidate: null,
    queuedFinalCandidate: null,
    error: null,
    settings: loadVoiceInputSettings()
  }
}

let state = initialState()

subscribeVoiceInputSettings((settings) => {
  patchVoiceInputState({ settings })
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
      error: readiness.ready ? null : readiness.summary
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

export function setTransientPreview(sequenceId: string, transcript: string | null): VoiceInputState {
  return patchVoiceInputState({
    captureStatus: transcript ? 'previewing' : state.captureStatus,
    previewSequenceId: sequenceId,
    previewTranscript: transcript
  })
}

export function clearTransientPreview(): VoiceInputState {
  return patchVoiceInputState({
    previewSequenceId: null,
    previewTranscript: null
  })
}

export function applyPreviewResult(result: VoiceInputTranscriptionResult): VoiceInputState {
  if (result.sequence_id !== state.previewSequenceId) return state
  if (!result.ok || !result.transcript) {
    return patchVoiceInputState({
      captureStatus: result.ok ? state.captureStatus : 'error',
      error: result.ok ? state.error : result.summary
    })
  }
  return patchVoiceInputState({
    captureStatus: 'previewing',
    previewTranscript: result.transcript,
    error: null
  })
}

export function applyFinalResult(result: VoiceInputTranscriptionResult, turnInProgress = false): VoiceInputState {
  clearTransientPreview()
  if (!result.ok || !result.transcript) {
    return patchVoiceInputState({
      captureStatus: 'error',
      error: result.summary
    })
  }
  const candidate: VoiceTranscriptCandidate = {
    sequenceId: result.sequence_id,
    transcript: result.transcript,
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
