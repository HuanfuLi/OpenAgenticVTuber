const activeAudio = new Set<HTMLAudioElement>()
const queuedAudio: string[] = []
let currentAudio: HTMLAudioElement | null = null

export function playAudioPayload(audioB64: string | null): void {
  if (!audioB64 || audioB64.trim().length === 0) return
  queuedAudio.push(audioB64)
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

    const cleanup = (): void => {
      if (revoked || !objectUrl) return
      URL.revokeObjectURL(objectUrl)
      activeAudio.delete(audio)
      if (currentAudio === audio) currentAudio = null
      revoked = true
      playNextQueuedAudio()
    }

    audio.addEventListener('ended', cleanup)
    audio.addEventListener('error', cleanup)
    activeAudio.add(audio)

    void audio.play().catch((error: unknown) => {
      console.warn('[ws] audio payload playback failed:', error)
      cleanup()
    })
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    currentAudio = null
    console.warn('[ws] invalid audio payload dropped:', error)
    playNextQueuedAudio()
  }
}

export function resetAudioPlaybackQueueForTests(): void {
  queuedAudio.length = 0
  activeAudio.clear()
  currentAudio = null
}
