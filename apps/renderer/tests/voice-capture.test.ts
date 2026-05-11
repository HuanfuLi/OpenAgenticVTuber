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
  mode: 'preview' | 'final'
}) => Promise<VoiceInputTranscriptionResult>
type EncodeMock = (blob: Blob) => Promise<{ audioBase64Wav: string; durationMs: number }>

const trackStop = vi.fn()

function makeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: trackStop }]
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

function result(sequenceId: string, mode: 'preview' | 'final', transcript: string): VoiceInputTranscriptionResult {
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
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
      { sessionId: 'session-1', previewTimesliceMs: 25, turnInProgress: () => turnInProgress },
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
    expect(FakeMediaRecorder.instances[0]?.start).toHaveBeenCalledWith(25)
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

  it('ignores stale preview sequence results and keeps only the latest preview transcript', async () => {
    const first = deferred<VoiceInputTranscriptionResult>()
    const second = deferred<VoiceInputTranscriptionResult>()
    transcribeVoiceInput
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    await capture().start()
    const recorder = FakeMediaRecorder.instances[0]!
    recorder.emitData('preview one')
    await Promise.resolve()
    recorder.emitData('preview two')
    await Promise.resolve()

    const firstSequence = transcribeVoiceInput.mock.calls[0][0].sequence_id
    const secondSequence = transcribeVoiceInput.mock.calls[1][0].sequence_id
    first.resolve(result(firstSequence, 'preview', 'old preview'))
    await Promise.resolve()
    expect(getVoiceInputState().previewTranscript).toBeNull()

    second.resolve(result(secondSequence, 'preview', 'latest preview'))
    await Promise.resolve()
    expect(getVoiceInputState().previewTranscript).toBe('latest preview')
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
