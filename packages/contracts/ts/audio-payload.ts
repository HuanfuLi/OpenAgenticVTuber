// GENERATED FROM packages/contracts/py/contracts/audio_payload.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { Dispatch } from './dispatch';
export type RedactedDiagnostics = {
  [k: string]: string
} | null;
export type State =
  | 'ok'
  | 'unavailable'
  | 'missing_credential'
  | 'external_service_failure'
  | 'timeout'
  | 'misconfigured';

export interface AudioPayloadMessage {
  audio: string | null;
  dispatches: Dispatch[];
  display_text: DisplayTextField;
  failed_audio: FailedAudioMetadata | null;
  forwarded: boolean;
  sentence_id: number;
  slice_length: number;
  type: 'audio';
  volumes: number[]
}


export interface DisplayTextField {
  avatar: string;
  name: string;
  text: string
}
export interface FailedAudioMetadata {
  provider_id: 'piper' | 'gpt_sovits' | 'funasr' | 'faster_whisper' | 'openai' | 'groq';
  redacted_diagnostics: RedactedDiagnostics;
  retryable: boolean;
  state: State;
  summary: string
}
