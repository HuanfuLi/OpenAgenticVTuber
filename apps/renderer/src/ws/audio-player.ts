import {
  loadVoiceOutputSettings,
  selectedAudioOutputSinkId,
  subscribeVoiceOutputSettings
} from '@/state/audio-settings'

const activeAudio = new Set<HTMLAudioElement>()
const queuedAudio: string[] = []
let currentAudio: HTMLAudioElement | null = null
let currentCleanup: ((
  playNext?: boolean,
  reason?: Extract<AudioPlaybackState['lastEvent'], 'ended' | 'error' | 'stopped'>
) => void) | null = null

export interface AudioPlaybackState {
  active: boolean
  queuedCount: number
  current: boolean
  lastEvent: 'idle' | 'queued' | 'started' | 'ended' | 'error' | 'stopped' | 'drained'
  updatedAt: number
}

const playbackListeners = new Set<(state: AudioPlaybackState) => void>()
let playbackState: AudioPlaybackState = {
  active: false,
  queuedCount: 0,
  current: false,
  lastEvent: 'idle',
  updatedAt: Date.now()
}
let outputSettings = loadVoiceOutputSettings()

subscribeVoiceOutputSettings((settings) => {
  outputSettings = settings
})

type AudioElementWithSink = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>
}

function emitPlaybackState(lastEvent: AudioPlaybackState['lastEvent']): void {
  playbackState = {
    active: Boolean(currentAudio) || queuedAudio.length > 0,
    queuedCount: queuedAudio.length,
    current: Boolean(currentAudio),
    lastEvent,
    updatedAt: Date.now()
  }
  for (const listener of playbackListeners) listener(playbackState)
}

export function getAudioPlaybackState(): AudioPlaybackState {
  return playbackState
}

export function subscribeAudioPlaybackState(listener: (state: AudioPlaybackState) => void): () => void {
  playbackListeners.add(listener)
  listener(playbackState)
  return () => {
    playbackListeners.delete(listener)
  }
}

async function applyAudioOutputSink(audio: HTMLAudioElement): Promise<void> {
  const sinkId = selectedAudioOutputSinkId(outputSettings)
  const audioWithSink = audio as AudioElementWithSink
  if (typeof audioWithSink.setSinkId !== 'function') return
  await audioWithSink.setSinkId(sinkId)
}

export function playAudioPayload(audioB64: string | null): void {
  if (!audioB64 || audioB64.trim().length === 0) return
  queuedAudio.push(audioB64)
  emitPlaybackState('queued')
  playNextQueuedAudio()
}

function playNextQueuedAudio(): void {
  if (currentAudio || queuedAudio.length === 0) return

  const audioB64 = queuedAudio.shift()!
  let objectUrl: string | null = null

  try {
    const binary = atob(audioB64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }

    const blob = new Blob([bytes], { type: 'audio/wav' })
    objectUrl = URL.createObjectURL(blob)
    const audio = new Audio(objectUrl)
    currentAudio = audio
    let revoked = false
    const onEnded = (): void => cleanup(true, 'ended')
    const onError = (): void => cleanup(true, 'error')

    const cleanup = (
      playNext = true,
      reason: Extract<AudioPlaybackState['lastEvent'], 'ended' | 'error' | 'stopped'> = 'ended'
    ): void => {
      if (revoked || !objectUrl) return
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      URL.revokeObjectURL(objectUrl)
      activeAudio.delete(audio)
      if (currentAudio === audio) currentAudio = null
      if (currentCleanup === cleanup) currentCleanup = null
      revoked = true
      emitPlaybackState(reason)
      if (playNext) {
        playNextQueuedAudio()
      } else if (queuedAudio.length === 0 && !currentAudio) {
        emitPlaybackState('stopped')
      }
      if (playNext && queuedAudio.length === 0 && !currentAudio) emitPlaybackState('drained')
    }
    currentCleanup = cleanup

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    activeAudio.add(audio)
    emitPlaybackState('started')

    void applyAudioOutputSink(audio)
      .then(() => audio.play())
      .catch((error: unknown) => {
        console.warn('[ws] audio payload playback failed:', error)
        cleanup(true, 'error')
      })
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    currentAudio = null
    console.warn('[ws] invalid audio payload dropped:', error)
    emitPlaybackState(queuedAudio.length > 0 ? 'error' : 'drained')
    playNextQueuedAudio()
  }
}

export function resetAudioPlaybackQueueForTests(): void {
  stopAudioPlayback()
  playbackState = {
    active: false,
    queuedCount: 0,
    current: false,
    lastEvent: 'idle',
    updatedAt: Date.now()
  }
  for (const listener of playbackListeners) listener(playbackState)
}

export function stopAudioPlayback(): void {
  queuedAudio.length = 0
  for (const audio of activeAudio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  currentCleanup?.(false, 'stopped')
  activeAudio.clear()
  currentAudio = null
  currentCleanup = null
  emitPlaybackState('stopped')
}
