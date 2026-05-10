export interface SettingsTestRecording {
  audioBase64Wav: string
  durationMs: number
}

export async function recordSettingsTestWav(maxDurationMs = 8000): Promise<SettingsTestRecording> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone recording is unavailable in this environment.')
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks: BlobPart[] = []
  try {
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    const startedAt = Date.now()
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    await new Promise<void>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Microphone recording failed.'))
      recorder.onstop = () => resolve()
      recorder.start()
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, maxDurationMs)
    })
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
    const buffer = await blob.arrayBuffer()
    return {
      audioBase64Wav: arrayBufferToBase64(buffer),
      durationMs: Date.now() - startedAt
    }
  } finally {
    for (const track of stream.getTracks()) track.stop()
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

