import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyFinalResult,
  clearTransientPreview,
  getVoiceInputState,
  refreshVoiceInputReadiness,
  resetVoiceInputStoreForTests,
  setTransientPreview
} from '@/state/voice-input-store'
import {
  DEFAULT_PTT_SHORTCUT,
  VOICE_INPUT_SETTINGS_STORAGE_KEY,
  saveVoiceInputSettings
} from '@/state/audio-settings'
import type { VoiceInputReadiness, VoiceInputTranscriptionResult } from '@contracts/audio-provider'

function readiness(patch: Partial<VoiceInputReadiness> = {}): VoiceInputReadiness {
  return {
    ready: true,
    stt_enabled: true,
    provider_id: 'funasr',
    readiness: {
      health_check_passed: true,
      test_transcription_passed: true,
      last_health_checked_at: null,
      last_test_transcription_at: null,
      fingerprint: 'ready',
      active_allowed: true,
      invalidation_reason: 'never_tested'
    },
    permission_state: 'granted',
    capture_status: 'idle',
    blocked_reason: null,
    setup_destination: null,
    summary: 'Ready.',
    ...patch
  }
}

function finalResult(sequenceId: string, transcript: string): VoiceInputTranscriptionResult {
  return {
    ok: true,
    mode: 'final',
    sequence_id: sequenceId,
    transcript,
    is_final: true,
    provider_id: 'funasr',
    duration_ms: 900,
    latency_ms: 10,
    readiness: null,
    summary: 'ok',
    failure: null,
    redacted_diagnostics: null
  }
}

describe('voice-input-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetVoiceInputStoreForTests()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getVoiceInputReadiness: vi.fn().mockResolvedValue(readiness())
      }
    })
  })

  it('starts with Settings-backed PTT and conservative disabled VAD defaults', () => {
    const state = getVoiceInputState()

    expect(state.settings.pttShortcut).toBe(DEFAULT_PTT_SHORTCUT)
    expect(state.settings.vad).toEqual({
      enabled: false,
      sensitivity: 'low',
      silenceTimeoutMs: 1800
    })
  })

  it('loads changed PTT and VAD settings without persisting preview text', () => {
    setTransientPreview('preview-1', 'transient text')
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Alt+M',
      vad: {
        enabled: true,
        sensitivity: 'low',
        silenceTimeoutMs: 1500
      }
    })

    expect(getVoiceInputState().settings.pttShortcut).toBe('Ctrl+Alt+M')
    expect(getVoiceInputState().previewTranscript).toBe('transient text')
    expect(window.localStorage.getItem(VOICE_INPUT_SETTINGS_STORAGE_KEY)).not.toContain('transient text')

    clearTransientPreview()
    resetVoiceInputStoreForTests()
    expect(getVoiceInputState().settings.pttShortcut).toBe('Ctrl+Alt+M')
    expect(getVoiceInputState().previewTranscript).toBeNull()
  })

  it('refreshes readiness from the preload bridge and exposes blocked permission state', async () => {
    vi.mocked(window.api.getVoiceInputReadiness).mockResolvedValue(readiness({
      ready: false,
      permission_state: 'prompt',
      capture_status: 'permission_needed',
      blocked_reason: 'permission_needed',
      setup_destination: 'microphone_permission',
      summary: 'Microphone permission is needed.'
    }))

    await refreshVoiceInputReadiness()

    expect(window.api.getVoiceInputReadiness).toHaveBeenCalledTimes(1)
    expect(getVoiceInputState()).toMatchObject({
      permissionState: 'prompt',
      captureStatus: 'permission_needed',
      error: 'Microphone permission is needed.'
    })
  })

  it('clears transient sidecar-unavailable readiness after a later ready response', async () => {
    vi.mocked(window.api.getVoiceInputReadiness)
      .mockResolvedValueOnce(readiness({
        ready: false,
        permission_state: 'unknown',
        capture_status: 'idle',
        blocked_reason: 'sidecar_unavailable',
        setup_destination: 'voice_settings',
        summary: 'Sidecar is not ready.'
      }))
      .mockResolvedValueOnce(readiness({ summary: 'Voice input is ready.' }))

    await refreshVoiceInputReadiness()

    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'idle',
      error: null,
      readiness: expect.objectContaining({
        blocked_reason: 'sidecar_unavailable',
        summary: 'Sidecar is not ready.'
      })
    })

    await refreshVoiceInputReadiness()

    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'idle',
      error: null,
      readiness: expect.objectContaining({
        ready: true,
        summary: 'Voice input is ready.'
      })
    })
  })

  it('keeps one queued final slot when a turn is already in progress', () => {
    applyFinalResult(finalResult('final-1', 'first transcript'), true)
    applyFinalResult(finalResult('final-2', 'replacement transcript'), true)

    expect(getVoiceInputState().captureStatus).toBe('queued')
    expect(getVoiceInputState().queuedFinalCandidate).toMatchObject({
      sequenceId: 'final-2',
      transcript: 'replacement transcript'
    })
    expect(getVoiceInputState().finalCandidate).toBeNull()
  })
})
