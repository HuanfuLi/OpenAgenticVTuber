import {
  voiceInputAudioConstraints,
  type VadSensitivity,
  type VoiceInputMicrophoneSettings
} from '@/state/audio-settings'
import { captureAecDiagnostics } from './aec-diagnostics'

type AnimationFrameScheduler = (callback: FrameRequestCallback) => number
type AnimationFrameCancel = (handle: number) => void
type AudioContextConstructor = new () => AudioContext

export interface VadControllerOptions {
  sensitivity: VadSensitivity
  silenceTimeoutMs: number
  microphone?: VoiceInputMicrophoneSettings
}

interface VadControllerDeps {
  mediaDevices?: MediaDevices
  AudioContextCtor?: AudioContextConstructor
  requestAnimationFrame?: AnimationFrameScheduler
  cancelAnimationFrame?: AnimationFrameCancel
  startRecording: () => Promise<boolean>
  stopRecording: () => Promise<void>
  isRecording: () => boolean
  shouldIgnoreSpeech?: () => boolean
  onMonitoringChange?: (monitoring: boolean) => void
  onAecDiagnostics?: (diagnostics: ReturnType<typeof captureAecDiagnostics>) => void
  onLevel?: (diagnostics: VadLevelDiagnostics) => void
  onError?: (message: string) => void
}

const SENSITIVITY_THRESHOLDS: Record<VadSensitivity, number> = {
  low: 0.035,
  medium: 0.025,
  high: 0.015
}

export type VadIgnoredReason = 'turn_in_progress' | null

export interface VadLevelDiagnostics {
  level: number
  threshold: number
  sensitivity: VadSensitivity
  speechDetected: boolean
  monitoring: boolean
  recording: boolean
  ignoredReason: VadIgnoredReason
}

export function vadThresholdForSensitivity(sensitivity: VadSensitivity): number {
  return SENSITIVITY_THRESHOLDS[sensitivity]
}

export function computeVadRms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0
  let sumSquares = 0
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]
    const centered = (sample - 128) / 128
    sumSquares += centered * centered
  }
  return Math.sqrt(sumSquares / samples.length)
}

export class VadController {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private sampleBuffer: Uint8Array<ArrayBuffer> | null = null
  private frameHandle: number | null = null
  private ownsRecording = false
  private startingRecording = false
  private lastVoiceAtMs: number | null = null
  private lastLevelEmitAtMs = -Infinity
  private stopped = true
  private readonly mediaDevices: MediaDevices
  private readonly AudioContextCtor: AudioContextConstructor
  private readonly requestFrame: AnimationFrameScheduler
  private readonly cancelFrame: AnimationFrameCancel
  private readonly sensitivity: VadSensitivity
  private readonly microphone: VoiceInputMicrophoneSettings
  private readonly threshold: number
  private readonly silenceTimeoutMs: number
  private readonly startRecording: () => Promise<boolean>
  private readonly stopRecording: () => Promise<void>
  private readonly isRecording: () => boolean
  private readonly shouldIgnoreSpeech: () => boolean
  private readonly onMonitoringChange: (monitoring: boolean) => void
  private readonly onAecDiagnostics: (diagnostics: ReturnType<typeof captureAecDiagnostics>) => void
  private readonly onLevel: (diagnostics: VadLevelDiagnostics) => void
  private readonly onError: (message: string) => void

  constructor(options: VadControllerOptions, deps: VadControllerDeps) {
    const webkitAudio = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
    this.mediaDevices = deps.mediaDevices ?? navigator.mediaDevices
    this.AudioContextCtor = deps.AudioContextCtor ?? window.AudioContext ?? webkitAudio.webkitAudioContext!
    this.requestFrame = deps.requestAnimationFrame ?? window.requestAnimationFrame.bind(window)
    this.cancelFrame = deps.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window)
    this.sensitivity = options.sensitivity
    this.microphone = options.microphone ?? { deviceId: null, label: null, suspectedSystemAudio: false }
    this.threshold = vadThresholdForSensitivity(options.sensitivity)
    this.silenceTimeoutMs = options.silenceTimeoutMs
    this.startRecording = deps.startRecording
    this.stopRecording = deps.stopRecording
    this.isRecording = deps.isRecording
    this.shouldIgnoreSpeech = deps.shouldIgnoreSpeech ?? (() => false)
    this.onMonitoringChange = deps.onMonitoringChange ?? (() => undefined)
    this.onAecDiagnostics = deps.onAecDiagnostics ?? (() => undefined)
    this.onLevel = deps.onLevel ?? (() => undefined)
    this.onError = deps.onError ?? (() => undefined)
  }

  get monitoring(): boolean {
    return !this.stopped
  }

  async start(): Promise<void> {
    if (!this.stopped) return
    if (!this.mediaDevices?.getUserMedia || !this.AudioContextCtor) {
      this.onError('VAD is unavailable in this environment.')
      return
    }
    this.stopped = false
    try {
      const constraints = voiceInputAudioConstraints(this.microphone)
      this.stream = await this.mediaDevices.getUserMedia(constraints)
      if (this.stopped) {
        this.cleanupMonitor()
        return
      }
      this.onAecDiagnostics(captureAecDiagnostics({
        source: 'vad',
        stream: this.stream,
        constraints,
        microphone: this.microphone,
        mediaDevices: this.mediaDevices
      }))
      this.audioContext = new this.AudioContextCtor()
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 1024
      source.connect(this.analyser)
      this.sampleBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
      this.onMonitoringChange(true)
      this.scheduleFrame()
    } catch (error) {
      this.stopped = true
      this.cleanupMonitor()
      const name = error instanceof DOMException || error instanceof Error ? error.name : ''
      this.onError(
        this.microphone.deviceId && (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
          ? 'Selected microphone input is unavailable. Choose another microphone in Settings.'
          : error instanceof Error ? error.message : 'VAD microphone monitoring failed.'
      )
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.cancelCurrentFrame()
    this.cleanupMonitor()
    this.onMonitoringChange(false)
    if (this.ownsRecording) {
      this.ownsRecording = false
      await this.stopRecording()
    }
    this.emitLevel(0, false, null, 0, true)
  }

  async processLevelForTests(rms: number, nowMs: number): Promise<void> {
    await this.processLevel(rms, nowMs)
  }

  private scheduleFrame(): void {
    if (this.stopped) return
    this.frameHandle = this.requestFrame((nowMs) => {
      this.frameHandle = null
      if (!this.analyser || !this.sampleBuffer || this.stopped) return
      this.analyser.getByteTimeDomainData(this.sampleBuffer)
      void this.processLevel(computeVadRms(this.sampleBuffer), nowMs).finally(() => {
        this.scheduleFrame()
      })
    })
  }

  private async processLevel(rms: number, nowMs: number): Promise<void> {
    const speechDetected = rms >= this.threshold
    const ignoredReason: VadIgnoredReason = speechDetected && this.shouldIgnoreSpeech()
      ? 'turn_in_progress'
      : null
    this.emitLevel(rms, speechDetected, ignoredReason, nowMs)
    if (speechDetected) {
      this.lastVoiceAtMs = nowMs
      if (!this.ownsRecording && !this.isRecording() && !this.startingRecording && ignoredReason === null) {
        this.startingRecording = true
        try {
          this.ownsRecording = await this.startRecording()
        } finally {
          this.startingRecording = false
        }
      }
      return
    }

    if (
      this.ownsRecording &&
      this.lastVoiceAtMs !== null &&
      nowMs - this.lastVoiceAtMs >= this.silenceTimeoutMs
    ) {
      this.ownsRecording = false
      await this.stopRecording()
      this.lastVoiceAtMs = null
    }
  }

  private emitLevel(
    rms: number,
    speechDetected: boolean,
    ignoredReason: VadIgnoredReason,
    nowMs: number,
    force = false
  ): void {
    if (!force && nowMs - this.lastLevelEmitAtMs < 100) return
    this.lastLevelEmitAtMs = nowMs
    this.onLevel({
      level: rms,
      threshold: this.threshold,
      sensitivity: this.sensitivity,
      speechDetected,
      monitoring: !this.stopped,
      recording: this.ownsRecording || this.isRecording() || this.startingRecording,
      ignoredReason
    })
  }

  private cancelCurrentFrame(): void {
    if (this.frameHandle === null) return
    this.cancelFrame(this.frameHandle)
    this.frameHandle = null
  }

  private cleanupMonitor(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
    void this.audioContext?.close()
    this.audioContext = null
    this.analyser = null
    this.sampleBuffer = null
  }
}
