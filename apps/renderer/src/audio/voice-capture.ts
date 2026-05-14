import type {
  VoiceInputTranscriptionRequest,
  VoiceInputTranscriptionResult
} from '@contracts/audio-provider'
import { subscribeSidecarReconnect } from '@/ws/client'
import {
  applyFinalResult,
  patchVoiceInputState,
  setVoiceAecDiagnostics,
  setVoiceCaptureStatus
} from '@/state/voice-input-store'
import {
  voiceInputAudioConstraints,
  type VoiceInputMicrophoneSettings
} from '@/state/audio-settings'
import { captureAecDiagnostics } from './aec-diagnostics'
import { encodeVoiceBlobToBase64Wav, type EncodedVoiceAudio } from './wav-encoder'

type RendererTranscriptionRequest = Omit<VoiceInputTranscriptionRequest, 'config'>
type TranscribeVoiceInput = (input: RendererTranscriptionRequest) => Promise<VoiceInputTranscriptionResult>
type EncodeVoiceBlob = (blob: Blob) => Promise<EncodedVoiceAudio>

interface VoiceCaptureDeps {
  mediaDevices?: MediaDevices
  MediaRecorderCtor?: typeof MediaRecorder
  transcribeVoiceInput?: TranscribeVoiceInput
  encodeVoiceBlob?: EncodeVoiceBlob
  subscribeReconnect?: (cb: (url: string, previousUrl: string | null) => void) => () => void
}

interface VoiceCaptureOptions {
  sessionId?: string | null
  turnInProgress?: () => boolean
  microphone?: VoiceInputMicrophoneSettings
}

export class VoiceCapture {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private captureId = 0
  private stopPromise: Promise<void> | null = null
  private unsubscribeReconnect: (() => void) | null = null
  private readonly mediaDevices: MediaDevices
  private readonly MediaRecorderCtor: typeof MediaRecorder
  private readonly transcribeVoiceInput: TranscribeVoiceInput
  private readonly encodeVoiceBlob: EncodeVoiceBlob
  private readonly sessionId: string | null
  private readonly turnInProgress: () => boolean
  private readonly microphone: VoiceInputMicrophoneSettings

  constructor(options: VoiceCaptureOptions = {}, deps: VoiceCaptureDeps = {}) {
    this.mediaDevices = deps.mediaDevices ?? navigator.mediaDevices
    this.MediaRecorderCtor = deps.MediaRecorderCtor ?? MediaRecorder
    this.transcribeVoiceInput = deps.transcribeVoiceInput ?? window.api.transcribeVoiceInput
    this.encodeVoiceBlob = deps.encodeVoiceBlob ?? encodeVoiceBlobToBase64Wav
    this.sessionId = options.sessionId ?? null
    this.turnInProgress = options.turnInProgress ?? (() => false)
    this.microphone = options.microphone ?? { deviceId: null, label: null, suspectedSystemAudio: false }
    this.unsubscribeReconnect = (deps.subscribeReconnect ?? subscribeSidecarReconnect)(() => {
      void this.cancel('Sidecar reconnected; voice capture was canceled.')
    })
  }

  get active(): boolean {
    return this.recorder !== null || this.stream !== null
  }

  async start(): Promise<void> {
    if (this.active) return
    if (!this.mediaDevices?.getUserMedia) {
      patchVoiceInputState({
        captureStatus: 'error',
        permissionState: 'unavailable',
        error: 'Microphone capture is unavailable in this environment.'
      })
      return
    }

    const captureId = this.captureId + 1
    this.captureId = captureId
    this.chunks = []
    setVoiceCaptureStatus('listening')

    try {
      this.stream = await this.getAudioStream()
      setVoiceAecDiagnostics(captureAecDiagnostics({
        source: 'ptt',
        stream: this.stream,
        constraints: voiceInputAudioConstraints(this.microphone),
        microphone: this.microphone,
        mediaDevices: this.mediaDevices
      }))
      if (captureId !== this.captureId) {
        this.cleanupStream()
        return
      }
      this.recorder = this.createRecorder(this.stream)
      this.installRecorderHandlers(this.recorder, captureId)
      this.recorder.start()
      setVoiceCaptureStatus('recording')
    } catch (error) {
      this.handleCaptureError(error)
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise
    const recorder = this.recorder
    if (!recorder || recorder.state === 'inactive') {
      this.cleanupStream()
      setVoiceCaptureStatus('idle')
      return
    }
    setVoiceCaptureStatus('finalizing')
    const promise = new Promise<void>((resolve) => {
      const previousOnStop = recorder.onstop
      recorder.onstop = (event) => {
        Promise.resolve(previousOnStop?.call(recorder, event)).then(() => resolve(undefined))
      }
      recorder.stop()
    }).finally(() => {
      this.stopPromise = null
    })
    this.stopPromise = promise
    return promise
  }

  async cancel(message = 'Voice capture canceled.'): Promise<void> {
    this.captureId += 1
    const recorder = this.recorder
    this.recorder = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      recorder.stop()
    }
    this.cleanupStream()
    this.chunks = []
    setVoiceCaptureStatus('idle', message)
  }

  dispose(): void {
    this.unsubscribeReconnect?.()
    this.unsubscribeReconnect = null
    void this.cancel()
  }

  private async getAudioStream(): Promise<MediaStream> {
    const constraints = voiceInputAudioConstraints(this.microphone)
    try {
      return await this.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'OverconstrainedError') {
        if (this.microphone.deviceId) throw error
        return this.mediaDevices.getUserMedia({ audio: true })
      }
      throw error
    }
  }

  private createRecorder(stream: MediaStream): MediaRecorder {
    const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav']
    const mimeType = supportedTypes.find((type) => {
      return typeof this.MediaRecorderCtor.isTypeSupported !== 'function' ||
        this.MediaRecorderCtor.isTypeSupported(type)
    })
    try {
      return new this.MediaRecorderCtor(stream, mimeType ? { mimeType } : undefined)
    } catch {
      return new this.MediaRecorderCtor(stream)
    }
  }

  private installRecorderHandlers(recorder: MediaRecorder, captureId: number): void {
    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size <= 0 || captureId !== this.captureId) return
      this.chunks.push(event.data)
    }
    recorder.onerror = () => {
      this.captureId += 1
      this.cleanupStream()
      this.recorder = null
      patchVoiceInputState({
        captureStatus: 'error',
        error: 'Microphone recording failed.'
      })
    }
    recorder.onstop = () => this.finalizeRecording(captureId)
  }

  private async finalizeRecording(captureId: number): Promise<void> {
    const finalChunks = this.chunks
    this.recorder = null
    this.cleanupStream()
    this.chunks = []
    if (captureId !== this.captureId) return
    setVoiceCaptureStatus('finalizing')
    try {
      const blob = new Blob(finalChunks)
      const encoded = await this.encodeVoiceBlob(blob)
      const sequenceId = `${captureId}:final`
      const result = await this.transcribeVoiceInput({
        audio_base64_wav: encoded.audioBase64Wav,
        duration_ms: encoded.durationMs,
        mode: 'final',
        sequence_id: sequenceId,
        session_id: this.sessionId
      })
      applyFinalResult(result, this.turnInProgress())
    } catch (error) {
      patchVoiceInputState({
        captureStatus: 'error',
        error: error instanceof Error ? error.message : 'Final voice transcription failed.'
      })
    }
  }

  private handleCaptureError(error: unknown): void {
    this.cleanupStream()
    this.recorder = null
    const name = error instanceof DOMException || error instanceof Error ? error.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      patchVoiceInputState({
        captureStatus: 'permission_needed',
        permissionState: 'denied',
        error: 'Microphone permission was denied.'
      })
      return
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
      patchVoiceInputState({
        captureStatus: 'error',
        permissionState: 'no_input_device',
        error: this.microphone.deviceId
          ? 'Selected microphone input is unavailable. Choose another microphone in Settings.'
          : 'No microphone input device was found.'
      })
      return
    }
    patchVoiceInputState({
      captureStatus: 'error',
      permissionState: 'unexpected_failure',
      error: error instanceof Error ? error.message : 'Microphone capture failed.'
    })
  }

  private cleanupStream(): void {
    if (!this.stream) return
    for (const track of this.stream.getTracks()) track.stop()
    this.stream = null
  }
}
