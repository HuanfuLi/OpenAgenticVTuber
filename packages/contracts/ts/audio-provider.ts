// GENERATED FROM packages/contracts/py/contracts/audio_provider.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { VoicePreset } from './voice-preset';
import type { AudioProviderHealth } from './audio-provider-health';
export type InvalidationReason =
  | 'never_tested'
  | 'config_changed'
  | 'health_failed'
  | 'test_failed'
  | 'runtime_failure'
  | 'missing_model'
  | 'missing_credential'
  | 'missing_consent';
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
export type Status =
  | 'not_downloaded'
  | 'downloaded'
  | 'missing'
  | 'incomplete'
  | 'manual_path_required'
  | 'operation_pending';
export type Status1 =
  | 'not_downloaded'
  | 'downloaded'
  | 'missing'
  | 'incomplete'
  | 'manual_path_required'
  | 'operation_pending';
export type ModelCacheState =
  | ('not_downloaded' | 'downloaded' | 'missing' | 'incomplete' | 'manual_path_required' | 'operation_pending')
  | null;
export type RedactedDiagnostics1 = {
  [k: string]: string
} | null;

export interface AudioProviderContracts {
  audio_config: AudioConfig;
  audio_provider_catalog: AudioProviderCatalog;
  gpt_sovits_health_request: GptSoVitsHealthRequest | null;
  gpt_sovits_test_synthesis_request: GptSoVitsTestSynthesisRequest | null;
  gpt_sovits_test_synthesis_result: GptSoVitsTestSynthesisResult | null;
  stt_model_cache_catalog: STTModelCacheCatalog;
  stt_model_cache_operation_request: STTModelCacheOperationRequest | null;
  stt_model_cache_operation_result: STTModelCacheOperationResult | null;
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
  cache_root: string | null;
  capture_timeout_ms: number;
  cloud: Cloud;
  enabled: boolean;
  execution: 'off_event_loop';
  input_mode: 'push_to_talk' | 'vad';
  language_mode: 'auto' | 'zh' | 'en';
  local_model_id: string | null;
  local_model_path_override: string | null;
  readiness: STTProviderReadiness
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
export interface STTProviderReadiness {
  active_allowed: boolean;
  fingerprint: string | null;
  health_check_passed: boolean;
  invalidation_reason: InvalidationReason;
  last_health_checked_at: string | null;
  last_test_transcription_at: string | null;
  test_transcription_passed: boolean
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
  default_model_id: string | null;
  display_name: string;
  enabled: boolean;
  kind: 'tts' | 'stt';
  local: boolean;
  provider_id: 'piper' | 'gpt_sovits' | 'funasr' | 'faster_whisper' | 'openai' | 'groq';
  recommended: boolean;
  requires_api_key: boolean;
  requires_consent: boolean;
  summary: string;
  supported_language_modes: ('auto' | 'zh' | 'en')[]
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

export interface STTModelCacheCatalog {
  cache_root_display: string;
  models: STTModelCatalogEntry[]
}
export interface STTModelCatalogEntry {
  app_managed: boolean;
  cache_path_display: string | null;
  display_name: string;
  loaded: boolean;
  model_id: string;
  provider_id: 'funasr' | 'faster_whisper';
  recommended: boolean;
  removable: boolean;
  size_bytes: number | null;
  size_label: string | null;
  source_label: string;
  status: Status;
  summary: string
}
export interface STTModelCacheOperationRequest {
  model_id: string;
  provider_id: 'funasr' | 'faster_whisper'
}
export interface STTModelCacheOperationResult {
  cache_path_display: string | null;
  model_id: string;
  ok: boolean;
  provider_id: 'funasr' | 'faster_whisper';
  status: Status1;
  summary: string
}
export interface STTTestRequest {
  audio_base64_wav: string | null;
  config: STTProviderConfig1;
  duration_ms: number | null;
  sample_label: string | null
}
export interface STTProviderConfig1 {
  active_provider: ('funasr' | 'faster_whisper' | 'openai' | 'groq') | null;
  cache_root: string | null;
  capture_timeout_ms: number;
  cloud: Cloud;
  enabled: boolean;
  execution: 'off_event_loop';
  input_mode: 'push_to_talk' | 'vad';
  language_mode: 'auto' | 'zh' | 'en';
  local_model_id: string | null;
  local_model_path_override: string | null;
  readiness: STTProviderReadiness
}
export interface STTTestResult {
  duration_ms: number | null;
  failure: AudioProviderHealth | null;
  language: string | null;
  latency_ms: number | null;
  model_cache_state: ModelCacheState;
  ok: boolean;
  provider_id: 'funasr' | 'faster_whisper' | 'openai' | 'groq';
  readiness: STTProviderReadiness | null;
  redacted_diagnostics: RedactedDiagnostics1;
  summary: string;
  transcript: string | null
}
