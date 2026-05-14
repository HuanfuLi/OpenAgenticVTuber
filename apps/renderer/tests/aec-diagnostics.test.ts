import { describe, expect, it, vi } from 'vitest'
import { captureAecDiagnostics } from '@/audio/aec-diagnostics'
import { voiceInputAudioConstraints } from '@/state/audio-settings'

function streamWithTrack(track: Partial<MediaStreamTrack>): MediaStream {
  return {
    getAudioTracks: () => [track as MediaStreamTrack],
    getTracks: () => [track as MediaStreamTrack]
  } as unknown as MediaStream
}

describe('aec-diagnostics', () => {
  const microphone = {
    deviceId: 'mic-1',
    label: 'USB Microphone',
    suspectedSystemAudio: false
  }

  it('records supported, requested, and applied AEC metadata', () => {
    const track = {
      kind: 'audio',
      getSettings: () => ({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
        deviceId: 'secret-device-id',
        groupId: 'secret-group-id'
      }),
      getCapabilities: () => ({
        echoCancellation: [true, false],
        noiseSuppression: [true, false],
        channelCount: { min: 1, max: 2 },
        sampleRate: { min: 16000, max: 48000 }
      }),
      getConstraints: () => ({
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        channelCount: { ideal: 1 },
        deviceId: { exact: 'secret-device-id' }
      })
    }

    const diagnostics = captureAecDiagnostics({
      source: 'ptt',
      stream: streamWithTrack(track),
      constraints: voiceInputAudioConstraints(microphone),
      microphone,
      mediaDevices: {
        getSupportedConstraints: () => ({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: true,
          deviceId: true
        })
      } as unknown as MediaDevices,
      now: () => 1234
    })

    expect(diagnostics).toMatchObject({
      source: 'ptt',
      updatedAt: 1234,
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
        channelCount: { ideal: 1 },
        deviceId: 'exact'
      },
      applied: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        sampleRate: 48000,
        deviceIdPresent: true,
        groupIdPresent: true
      },
      trackConstraints: {
        deviceId: 'exact'
      }
    })
  })

  it('tolerates missing browser APIs', () => {
    const diagnostics = captureAecDiagnostics({
      source: 'vad',
      stream: streamWithTrack({ kind: 'audio' }),
      constraints: { audio: true },
      microphone: { deviceId: null, label: null, suspectedSystemAudio: false },
      mediaDevices: {} as MediaDevices,
      now: () => 99
    })

    expect(diagnostics).toMatchObject({
      source: 'vad',
      updatedAt: 99,
      requested: {
        echoCancellation: undefined,
        noiseSuppression: undefined,
        autoGainControl: undefined,
        channelCount: undefined,
        deviceId: 'none'
      },
      applied: {
        channelCount: null,
        sampleRate: null,
        deviceIdPresent: false,
        groupIdPresent: false
      }
    })
  })

  it('does not expose raw audio, transcript text, or device identifiers', () => {
    const diagnostics = captureAecDiagnostics({
      source: 'ptt',
      stream: streamWithTrack({
        kind: 'audio',
        getSettings: () => ({ deviceId: 'secret-device-id', groupId: 'secret-group-id' })
      }),
      constraints: voiceInputAudioConstraints(microphone),
      microphone,
      mediaDevices: {} as MediaDevices,
      now: () => 1
    })

    const serialized = JSON.stringify(diagnostics)
    expect(serialized).not.toContain('secret-device-id')
    expect(serialized).not.toContain('secret-group-id')
    expect(serialized).not.toContain('audio_base64')
    expect(serialized).not.toContain('transcript')
    expect(serialized).not.toContain('raw')
    expect(vi.isMockFunction(captureAecDiagnostics)).toBe(false)
  })
})
