export type VoiceAudioEncodingErrorCode = 'empty_audio' | 'too_short' | 'decode_failed'

export class VoiceAudioEncodingError extends Error {
  code: VoiceAudioEncodingErrorCode

  constructor(code: VoiceAudioEncodingErrorCode, message: string) {
    super(message)
    this.name = 'VoiceAudioEncodingError'
    this.code = code
  }
}

export interface EncodedVoiceAudio {
  audioBase64Wav: string
  durationMs: number
}

export interface EncodeVoiceBlobOptions {
  targetSampleRateHz?: number
  minDurationMs?: number
}

export async function encodeVoiceBlobToBase64Wav(
  blob: Blob,
  options: EncodeVoiceBlobOptions = {}
): Promise<EncodedVoiceAudio> {
  const targetSampleRateHz = options.targetSampleRateHz ?? 16_000
  const minDurationMs = options.minDurationMs ?? 120
  if (blob.size <= 0) {
    throw new VoiceAudioEncodingError('empty_audio', 'Voice input did not contain audio.')
  }
  const encoded = await blob.arrayBuffer()
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextCtor) {
    throw new VoiceAudioEncodingError('decode_failed', 'Audio decoding is unavailable in this browser.')
  }
  const context = new AudioContextCtor()
  try {
    const audioBuffer = await context.decodeAudioData(encoded.slice(0))
    const durationMs = Math.round(audioBuffer.duration * 1000)
    if (durationMs < minDurationMs) {
      throw new VoiceAudioEncodingError('too_short', 'Voice input was too short to transcribe.')
    }
    const wavBytes = audioBufferToWav(audioBuffer, targetSampleRateHz)
    return {
      audioBase64Wav: uint8ToBase64(wavBytes),
      durationMs
    }
  } catch (error) {
    if (error instanceof VoiceAudioEncodingError) throw error
    throw new VoiceAudioEncodingError('decode_failed', 'Voice input audio could not be decoded.')
  } finally {
    await context.close().catch(() => undefined)
  }
}

function audioBufferToWav(buffer: AudioBuffer, sampleRate: number): Uint8Array {
  const samples = mixToMono(buffer, sampleRate)
  const dataSize = samples.length * 2
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  writeAscii(bytes, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(bytes, 8, 'WAVE')
  writeAscii(bytes, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(bytes, 36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return bytes
}

function mixToMono(buffer: AudioBuffer, targetSampleRate: number): Float32Array {
  const sourceRate = buffer.sampleRate
  const outputLength = Math.max(1, Math.round(buffer.duration * targetSampleRate))
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = Math.min(buffer.length - 1, Math.floor(i * sourceRate / targetSampleRate))
    let mixed = 0
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      mixed += buffer.getChannelData(channel)[sourceIndex] ?? 0
    }
    output[i] = mixed / Math.max(1, buffer.numberOfChannels)
  }
  return output
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    bytes[offset + i] = text.charCodeAt(i)
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
