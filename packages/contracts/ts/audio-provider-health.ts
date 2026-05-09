// GENERATED FROM packages/contracts/py/contracts/audio_provider.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

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

export interface AudioProviderHealth {
  detail: string | null;
  kind: 'tts' | 'stt';
  latency_ms: number | null;
  provider_id: 'piper' | 'gpt_sovits' | 'funasr' | 'faster_whisper' | 'openai' | 'groq';
  redacted_diagnostics: RedactedDiagnostics;
  retryable: boolean;
  state: State;
  summary: string
}
