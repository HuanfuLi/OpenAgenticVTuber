// GENERATED FROM packages/contracts/py/contracts/audio_provider.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { VoicePreset } from './voice-preset';
import type { AudioProviderHealth } from './audio-provider-health';
export type Capabilities = (
  | 'local'
  | 'cloud'
  | 'requires_api_key'
  | 'requires_external_service'
  | 'requires_local_model'
  | 'test_synthesis'
  | 'test_transcription'
  | 'chinese_english'
)[];
export type RedactedDiagnostics = {
  [k: string]: string
} | null;
export type State1 =
  | 'ok'
  | 'unavailable'
  | 'missing_credential'
  | 'external_service_failure'
  | 'timeout'
  | 'misconfigured';
export type RedactedDiagnostics1 = {
  [k: string]: string
} | null;

export interface AudioProviderContracts {
  audio_config: AudioConfig;
  audio_provider_catalog: AudioProviderCatalog;
  gpt_sovits_health_request: GptSoVitsHealthRequest | null;
  gpt_sovits_test_synthesis_request: GptSoVitsTestSynthesisRequest | null;
  gpt_sovits_test_synthesis_result: GptSoVitsTestSynthesisResult | null;
  stt_test_request: STTTestRequest | null;
  stt_test_result: STTTestResult | null
}
export interface AudioConfig {
  diagnostics: AudioDiagnosticsConfig;
  schema_version: 1;
  stt: STTProviderConfig;
  tts: TTSProviderConfig
}
export interface AudioDiagnosticsConfig {
  redact_diagnostics: boolean
}
export interface STTProviderConfig {
  active_provider: ('funasr' | 'faster_whisper' | 'openai' | 'groq') | null;
  capture_timeout_ms: number;
  cloud: Cloud;
  enabled: boolean;
  execution: 'off_event_loop';
  input_mode: 'push_to_talk' | 'vad';
  language_mode: 'auto' | 'zh' | 'en'
}
export interface Cloud {
  [k: string]: CloudSTTProviderSettings
}
export interface CloudSTTProviderSettings {
  api_key: string | null;
  consent_granted: boolean;
  endpoint_url: string | null;
  model_name: string | null;
  provider_id: 'openai' | 'groq'
}
export interface TTSProviderConfig {
  active_provider: 'piper' | 'gpt_sovits';
  gpt_sovits: GptSoVitsProviderConfig | null;
  piper: PiperTTSConfig
}
export interface GptSoVitsProviderConfig {
  activation: GptSoVitsActivationGate;
  base_url: string;
  enabled: boolean;
  launch: GptSoVitsLaunchConfig;
  provider_id: 'gpt_sovits';
  request_timeout_ms: number
}
export interface GptSoVitsActivationGate {
  active_allowed: boolean;
  health_check_passed: boolean;
  last_health_checked_at: string | null;
  last_test_synthesis_at: string | null;
  test_synthesis_passed: boolean
}
export interface GptSoVitsLaunchConfig {
  auto_start: boolean;
  command: string | null;
  mode: 'external' | 'app_managed';
  working_directory: string | null
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
export interface AudioProviderCatalog {
  providers: AudioProviderCatalogEntry[]
}
export interface AudioProviderCatalogEntry {
  capabilities: Capabilities;
  display_name: string;
  enabled: boolean;
  kind: 'tts' | 'stt';
  local: boolean;
  provider_id: 'piper' | 'gpt_sovits' | 'funasr' | 'faster_whisper' | 'openai' | 'groq';
  requires_api_key: boolean;
  requires_consent: boolean;
  summary: string
}
export interface GptSoVitsHealthRequest {
  config: GptSoVitsProviderConfig;
  preset: VoicePreset
}

export interface GptSoVitsPresetValidation {
  fingerprint: string;
  health_checked_at: string | null;
  state: 'validated' | 'needs_test' | 'changed';
  summary: string | null;
  test_synthesis_at: string | null;
  validated_at: string
}
export interface GptSoVitsTestSynthesisRequest {
  config: GptSoVitsProviderConfig;
  preset: VoicePreset;
  text: string
}
export interface GptSoVitsTestSynthesisResult {
  audio_base64: string | null;
  duration_ms: number | null;
  failure: AudioProviderHealth | null;
  media_type: 'wav';
  ok: boolean;
  provider_id: 'gpt_sovits';
  sample_rate_hz: number | null;
  summary: string
}

export interface STTTestRequest {
  config: STTProviderConfig1;
  sample_label: string | null
}
export interface STTProviderConfig1 {
  active_provider: ('funasr' | 'faster_whisper' | 'openai' | 'groq') | null;
  capture_timeout_ms: number;
  cloud: Cloud;
  enabled: boolean;
  execution: 'off_event_loop';
  input_mode: 'push_to_talk' | 'vad';
  language_mode: 'auto' | 'zh' | 'en'
}
export interface STTTestResult {
  failure: AudioProviderHealth | null;
  ok: boolean;
  provider_id: 'funasr' | 'faster_whisper' | 'openai' | 'groq';
  redacted_diagnostics: RedactedDiagnostics1;
  summary: string
}
