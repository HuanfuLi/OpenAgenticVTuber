// Hand-written mirror of packages/contracts/py/contracts/audio_payload.py.
// OLVT-canonical names: type:'audio' (NOT 'audio-payload'), audio (NOT audio_b64).
// Codegen replaces this in Phase 5 (SC-02).
import type { ActionIntent } from './action-intent'

export interface DisplayTextField {
  text: string
  name: string
  avatar: string
}

export interface AudioPayloadMessage {
  type: 'audio'
  audio: string | null
  volumes: number[]
  slice_length: number
  display_text: DisplayTextField
  actions: ActionIntent[]
  sentence_id: number
  forwarded: boolean
}
