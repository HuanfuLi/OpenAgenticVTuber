const activeAudio = new Set<HTMLAudioElement>()

export function playAudioPayload(audioB64: string | null): void {
  if (!audioB64 || audioB64.trim().length === 0) return

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
    let revoked = false

    const cleanup = (): void => {
      if (revoked || !objectUrl) return
      URL.revokeObjectURL(objectUrl)
      activeAudio.delete(audio)
      revoked = true
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
    console.warn('[ws] invalid audio payload dropped:', error)
  }
}
