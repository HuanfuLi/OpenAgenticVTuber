import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/ws/client', () => ({
  subscribeSidecarReconnect: vi.fn(() => () => undefined)
}))

import { VoiceCapture } from '@/audio/voice-capture'
import { getVoiceInputState, resetVoiceInputStoreForTests } from '@/state/voice-input-store'
import type { VoiceInputTranscriptionResult } from '@contracts/audio-provider'

type DataHandler = ((event: BlobEvent) => void) | null
type TranscribeMock = (request: {
  sequence_id: string
  mode: 'final'
}) => Promise<VoiceInputTranscriptionResult>
type EncodeMock = (blob: Blob) => Promise<{ audioBase64Wav: string; durationMs: number }>

const trackStop = vi.fn()

function makeStream(): MediaStream {
  const track = {
    kind: 'audio',
    stop: trackStop,
    getSettings: () => ({
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: 48000,
      deviceId: 'secret-device-id'
    }),
    getConstraints: () => ({
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      channelCount: { ideal: 1 }
    })
  }
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track]
  } as unknown as MediaStream
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  static isTypeSupported = vi.fn(() => true)
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: DataHandler = null
  onstop: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  start = vi.fn(() => {
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.emitData('final')
    this.onstop?.(new Event('stop'))
  })

  constructor() {
    FakeMediaRecorder.instances.push(this)
  }

  emitData(text: string): void {
    const event = { data: new Blob([text]) } as BlobEvent
    this.ondataavailable?.(event)
  }

  emitError(): void {
    this.onerror?.(new Event('error'))
  }
}

function result(sequenceId: string, mode: 'final', transcript: string): VoiceInputTranscriptionResult {
  return {
    ok: true,
    mode,
    sequence_id: sequenceId,
    transcript,
    is_final: mode === 'final',
    provider_id: 'funasr',
    duration_ms: 700,
    latency_ms: 20,
    readiness: null,
    summary: 'ok',
    failure: null,
    redacted_diagnostics: null
  }
}

async function waitForMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('VoiceCapture', () => {
  let getUserMedia: ReturnType<typeof vi.fn>
  let transcribeVoiceInput: ReturnType<typeof vi.fn<TranscribeMock>>
  let encodeVoiceBlob: ReturnType<typeof vi.fn<EncodeMock>>

  beforeEach(() => {
    window.localStorage.clear()
    resetVoiceInputStoreForTests()
    trackStop.mockReset()
    FakeMediaRecorder.instances = []
    getUserMedia = vi.fn().mockResolvedValue(makeStream())
    transcribeVoiceInput = vi.fn<TranscribeMock>(async (request) => result(request.sequence_id, request.mode, request.mode))
    encodeVoiceBlob = vi.fn<EncodeMock>().mockResolvedValue({ audioBase64Wav: 'UklGRg==', durationMs: 700 })
  })

  function capture(turnInProgress = false): VoiceCapture {
    return new VoiceCapture(
      { sessionId: 'session-1', turnInProgress: () => turnInProgress },
      {
        mediaDevices: { getUserMedia } as unknown as MediaDevices,
        MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
        transcribeVoiceInput,
        encodeVoiceBlob,
        subscribeReconnect: () => () => undefined
      }
    )
  }

  it('calls getUserMedia only after an explicit start action', async () => {
    const controller = capture()

    expect(getUserMedia).not.toHaveBeenCalled()
    await controller.start()

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true }
      }
    })
    expect(FakeMediaRecorder.instances[0]?.start).toHaveBeenCalledWith()
  })

  it('uses a selected physical microphone instead of the system default input', async () => {
    const controller = new VoiceCapture(
      {
        sessionId: 'session-1',
        microphone: {
          deviceId: 'mic-physical-1',
          label: 'USB Microphone',
          suspectedSystemAudio: false
        }
      },
      {
        mediaDevices: { getUserMedia } as unknown as MediaDevices,
        MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
        transcribeVoiceInput,
        encodeVoiceBlob,
        subscribeReconnect: () => () => undefined
      }
    )

    await controller.start()

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        deviceId: { exact: 'mic-physical-1' },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true }
      })
    })
    expect(getVoiceInputState().aecDiagnostics).toMatchObject({
      source: 'ptt',
      selectedInput: {
        label: 'USB Microphone',
        deviceIdPresent: true,
        suspectedSystemAudio: false
      },
      applied: {
        echoCancellation: true,
        noiseSuppression: true,
        deviceIdPresent: true
      }
    })
  })

  it('does not silently fall back to default input when selected microphone is unavailable', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('missing mic', 'OverconstrainedError'))
    const controller = new VoiceCapture(
      {
        sessionId: 'session-1',
        microphone: {
          deviceId: 'missing-mic',
          label: 'USB Microphone',
          suspectedSystemAudio: false
        }
      },
      {
        mediaDevices: { getUserMedia } as unknown as MediaDevices,
        MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
        transcribeVoiceInput,
        encodeVoiceBlob,
        subscribeReconnect: () => () => undefined
      }
    )

    await controller.start()

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'error',
      permissionState: 'no_input_device',
      error: 'Selected microphone input is unavailable. Choose another microphone in Settings.'
    })
  })

  it('maps permission denied and no device failures into visible state', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    await capture().start()
    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'permission_needed',
      permissionState: 'denied',
      error: 'Microphone permission was denied.'
    })

    resetVoiceInputStoreForTests()
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NotFoundError' }))
    await capture().start()
    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'error',
      permissionState: 'no_input_device',
      error: 'No microphone input device was found.'
    })
  })

  it('stops tracks on stop, cancel, and recorder error', async () => {
    const stopped = capture()
    await stopped.start()
    await stopped.stop()
    expect(trackStop).toHaveBeenCalledTimes(1)

    const canceled = capture()
    await canceled.start()
    await canceled.cancel()
    expect(trackStop).toHaveBeenCalledTimes(2)

    const errored = capture()
    await errored.start()
    FakeMediaRecorder.instances.at(-1)?.emitError()
    expect(trackStop).toHaveBeenCalledTimes(3)
  })

  it('does not transcribe recorder data until stop finalizes the capture', async () => {
    const controller = capture()
    await controller.start()
    const recorder = FakeMediaRecorder.instances[0]!
    recorder.emitData('first')
    await Promise.resolve()

    expect(transcribeVoiceInput).not.toHaveBeenCalled()

    await controller.stop()
  })

  it('encodes accumulated chunks once for final transcription', async () => {
    encodeVoiceBlob
      .mockResolvedValueOnce({ audioBase64Wav: 'UklGRg==', durationMs: 700 })

    const controller = capture()
    await controller.start()
    const recorder = FakeMediaRecorder.instances[0]!
    recorder.emitData('first')
    recorder.emitData('second')
    await Promise.resolve()
    await controller.stop()

    await waitForMicrotasks()
    expect(encodeVoiceBlob).toHaveBeenCalledTimes(1)
    await expect(encodeVoiceBlob.mock.calls[0][0].text()).resolves.toBe('firstsecondfinal')
    expect(transcribeVoiceInput).toHaveBeenCalledWith(expect.objectContaining({ mode: 'final' }))
    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'idle',
      finalCandidate: {
        transcript: 'final'
      }
    })
  })

  it('finalizes into the one queued final slot when a turn is in progress', async () => {
    const controller = capture(true)
    await controller.start()
    await controller.stop()

    expect(transcribeVoiceInput).toHaveBeenLastCalledWith(expect.objectContaining({
      mode: 'final',
      session_id: 'session-1'
    }))
    expect(getVoiceInputState()).toMatchObject({
      captureStatus: 'queued',
      queuedFinalCandidate: {
        transcript: 'final'
      }
    })
  })
})
