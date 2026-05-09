// GENERATED FROM packages/contracts/py/contracts/audio_provider.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

export interface AudioConfig {
  schema_version: 1;
  stt: STTProviderConfig;
  tts: TTSProviderConfig
}
export interface STTProviderConfig {
  active_provider: ('funasr' | 'faster_whisper' | 'openai' | 'groq') | null;
  capture_timeout_ms: number;
  enabled: boolean;
  execution: 'off_event_loop'
}
export interface TTSProviderConfig {
  active_provider: 'piper' | 'gpt_sovits';
  gpt_sovits: FutureTTSProviderConfig | null;
  piper: PiperTTSConfig
}
export interface FutureTTSProviderConfig {
  enabled: boolean;
  provider_id: 'gpt_sovits'
}
export interface PiperTTSConfig {
  execution: 'off_event_loop';
  ordered_playback: boolean;
  output_device: string | null;
  provider_id: 'piper';
  rms_lipsync: boolean;
  synthesis_timeout_ms: number;
  voice_model: string
}
