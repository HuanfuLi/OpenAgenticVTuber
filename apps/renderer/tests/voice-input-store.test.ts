import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyFinalResult,
  getVoiceInputState,
  refreshVoiceInputReadiness,
  resetVoiceInputStoreForTests,
  setVoiceAecDiagnostics,
  VOICE_INPUT_AEC_DIAGNOSTICS_STORAGE_KEY
} from '@/state/voice-input-store'
import {
  DEFAULT_PTT_SHORTCUT,
  VOICE_INPUT_SETTINGS_STORAGE_KEY,
  isLikelySystemAudioInput,
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
      invalidation_reason: 'ready'
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
    expect(state.settings.microphone).toEqual({
      deviceId: null,
      label: null,
      suspectedSystemAudio: false
    })
    expect(state.settings.noHeadphones).toEqual({
      status: 'unsafe',
      unsafeOverride: false
    })
    expect(state.settings.vad).toEqual({
      enabled: false,
      sensitivity: 'low',
      silenceTimeoutMs: 1800
    })
    expect(state.aecDiagnostics).toBeNull()
  })

  it('loads changed PTT and VAD settings from local storage', () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Alt+M',
      microphone: {
        deviceId: 'mic-1',
        label: 'USB Microphone',
        suspectedSystemAudio: false
      },
      vad: {
        enabled: true,
        sensitivity: 'low',
        silenceTimeoutMs: 1500
      }
    })

    expect(getVoiceInputState().settings.pttShortcut).toBe('Ctrl+Alt+M')
    expect(getVoiceInputState().settings.microphone.deviceId).toBe('mic-1')

    resetVoiceInputStoreForTests()
    expect(getVoiceInputState().settings.pttShortcut).toBe('Ctrl+Alt+M')
    expect(window.localStorage.getItem(VOICE_INPUT_SETTINGS_STORAGE_KEY)).toContain('Ctrl+Alt+M')
  })

  it('flags likely system audio inputs in persisted microphone settings', () => {
    expect(isLikelySystemAudioInput('Stereo Mix (Realtek Audio)')).toBe(true)
    expect(isLikelySystemAudioInput('USB Condenser Microphone')).toBe(false)

    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Shift+Space',
      microphone: {
        deviceId: 'loopback-1',
        label: 'Stereo Mix (Realtek Audio)',
        suspectedSystemAudio: false
      },
      vad: {
        enabled: false,
        sensitivity: 'low',
        silenceTimeoutMs: 1800
      }
    })

    expect(getVoiceInputState().settings.microphone).toMatchObject({
      deviceId: 'loopback-1',
      suspectedSystemAudio: true
    })
  })

  it('persists latest metadata-only AEC diagnostics for Settings visibility', () => {
    setVoiceAecDiagnostics({
      source: 'ptt',
      updatedAt: 1_765_000_000_000,
      selectedInput: {
        label: 'USB Microphone',
        deviceIdPresent: true,
        suspectedSystemAudio: false
      },
      supportedConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: true,
        deviceId: true
      },
      requested: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: undefined,
        channelCount: { ideal: 1 },
        deviceId: 'exact'
      },
      applied: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
        deviceIdPresent: true,
        groupIdPresent: true
      },
      capabilities: {
        echoCancellation: [true, false],
        noiseSuppression: [true, false],
        autoGainControl: [true, false],
        channelCount: { max: 2, min: 1 },
        sampleRate: { max: 48000, min: 16000 }
      },
      trackConstraints: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: undefined,
        channelCount: { ideal: 1 },
        deviceId: 'exact'
      }
    })

    expect(window.localStorage.getItem(VOICE_INPUT_AEC_DIAGNOSTICS_STORAGE_KEY)).toContain('"source":"ptt"')

    resetVoiceInputStoreForTests()
    expect(getVoiceInputState().aecDiagnostics).toMatchObject({
      source: 'ptt',
      applied: {
        echoCancellation: true,
        noiseSuppression: true
      }
    })
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

  it('strips FunASR metadata tokens before exposing final transcripts', () => {
    applyFinalResult(finalResult(
      'funasr-1',
      '<|en|><|EMO_UNKNOWN|><|BGM|><|woitn|>tell me a different story about france.'
    ))

    expect(getVoiceInputState().finalCandidate).toMatchObject({
      sequenceId: 'funasr-1',
      transcript: 'tell me a different story about france.'
    })
  })

  it('does not dispatch metadata-only FunASR output as a final transcript', () => {
    applyFinalResult(finalResult('funasr-empty', '<|en|><|EMO_UNKNOWN|><|BGM|><|woitn|>'))

    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'idle',
      finalCandidate: null,
      queuedFinalCandidate: null,
      error: 'No speech detected.'
    })
  })
})
