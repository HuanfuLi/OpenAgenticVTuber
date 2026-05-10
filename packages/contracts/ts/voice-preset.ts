// GENERATED FROM packages/contracts/py/contracts/voice_preset.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

export interface VoicePresetLibrary {
  active_associations: ActivePresetAssociation[];
  presets: VoicePreset[];
  reference_audio_assets: ReferenceAudioAsset[];
  schema_version: 1
}
export interface ActivePresetAssociation {
  avatar_id: string | null;
  preset_id: string;
  scope: 'global' | 'avatar' | 'session' | 'avatar_session';
  session_id: string | null
}
export interface VoicePreset {
  created_at: string | null;
  gpt_sovits: GptSoVitsPresetConfig;
  name: string;
  piper_voice_model: string | null;
  preset_id: string;
  provider_id: 'piper' | 'gpt_sovits';
  updated_at: string | null;
  validation: GptSoVitsPresetValidation | null
}
export interface GptSoVitsPresetConfig {
  batch_size: number;
  media_type: 'wav';
  prompt_lang: 'zh' | 'en' | 'ja' | 'ko' | 'yue' | 'auto';
  prompt_text: string;
  reference_audio_id: string | null;
  repetition_penalty: number;
  speed_factor: number;
  streaming_mode: boolean;
  temperature: number;
  text_lang: 'zh' | 'en' | 'ja' | 'ko' | 'yue' | 'auto';
  text_split_method: string;
  top_k: number;
  top_p: number
}
export interface GptSoVitsPresetValidation {
  fingerprint: string;
  health_checked_at: string | null;
  state: 'validated' | 'needs_test' | 'changed';
  summary: string | null;
  test_synthesis_at: string | null;
  validated_at: string
}
export interface ReferenceAudioAsset {
  asset_id: string;
  display_basename: string;
  duration_ms: number;
  format: 'wav' | 'flac' | 'mp3' | 'ogg' | 'm4a';
  language: 'zh' | 'en' | 'ja' | 'ko' | 'yue' | 'auto';
  managed_path_token: string;
  transcript_text: string
}
