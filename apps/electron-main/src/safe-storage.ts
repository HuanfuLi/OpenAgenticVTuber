// Electron safeStorage credential gate (PLUMB-04, D-07, D-09).
// On Windows: DPAPI-encrypted blob at %APPDATA%/AgenticLLMVTuber/llm-config.enc
// On macOS:  Keychain-backed encryption.
// On Linux:  libsecret if available; falls back to plaintext when no keyring
//            (CONTEXT.md D-07 accepts this; main process opts in via
//            safeStorage.setUsePlainTextEncryption(true)).

import { app, safeStorage } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AudioConfig } from '../../../packages/contracts/ts/audio-provider'
import type { ReferenceAudioAsset, VoicePreset } from '../../../packages/contracts/ts/voice-preset'
export {
  buildGptSoVitsPresetValidationFingerprint,
  getGptSoVitsPresetValidationState
} from '../../../packages/contracts/ts/gpt-sovits-validation'

const STORE_FILE = 'llm-config.enc'

// Provider type accepts all 5 dropdown options. Per CONTEXT.md D-06, the latter
// three are dropdown-disabled in Phase 1; the type accepts them so v2 can flip
// the disabled flag without a contract change.
export type Provider = 'lm_studio' | 'custom_openai' | 'openai' | 'anthropic' | 'gemini'

export interface ProviderConfig {
  provider: Provider
  endpointUrl: string // e.g. "http://localhost:1234/v1"
  apiKey: string // empty string for LM Studio
  modelName: string // empty string = auto-detect (LM Studio only)
}

export interface BodyMotionPluginConfig {
  activePluginName: string
  cursorTrackingEnabled?: boolean
}

export interface StoredConfigV1 {
  provider: ProviderConfig
  plugin?: BodyMotionPluginConfig
  hasCompletedSetup: boolean
  schemaVersion: 1
}

export interface StoredConfig {
  provider: ProviderConfig
  plugin?: BodyMotionPluginConfig
  hasCompletedSetup: boolean
  schemaVersion: 2
  audio: AudioConfig
  voicePresets: VoicePreset[]
  referenceAudioAssets: ReferenceAudioAsset[]
  activePresetByAvatarSession: Record<string, string>
}

export interface VoicePresetLibraryDefaults {
  voicePresets: VoicePreset[]
  referenceAudioAssets: ReferenceAudioAsset[]
  activePresetByAvatarSession: Record<string, string>
}

export type DeletePresetResult =
  | { ok: true }
  | { ok: false; reason: 'active_preset'; activeKeys: string[] }

export type DeleteReferenceAudioResult =
  | { ok: true }
  | { ok: false; reason: 'reference_audio_in_use'; presetIds: string[] }

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
}

export function defaultAudioConfig(): AudioConfig {
  return {
    schema_version: 1,
    diagnostics: {
      redact_diagnostics: true
    },
    tts: {
      active_provider: 'piper',
      piper: {
        provider_id: 'piper',
        voice_model: 'en_US-amy-medium',
        output_device: null,
        synthesis_timeout_ms: 30_000,
        execution: 'off_event_loop',
        ordered_playback: true,
        rms_lipsync: true
      },
      gpt_sovits: null
    },
    stt: {
      enabled: false,
      active_provider: null,
      input_mode: 'push_to_talk',
      language_mode: 'auto',
      local_model_id: null,
      local_model_path_override: null,
      cache_root: null,
      runtime_device: 'cpu',
      cuda_compute_type: 'float16',
      readiness: {
        health_check_passed: false,
        test_transcription_passed: false,
        last_health_checked_at: null,
        last_test_transcription_at: null,
        fingerprint: null,
        active_allowed: false,
        invalidation_reason: 'never_tested'
      },
      capture_timeout_ms: 30_000,
      execution: 'off_event_loop',
      cloud: {
        openai: {
          provider_id: 'openai',
          consent_granted: false,
          api_key: null,
          endpoint_url: null,
          model_name: 'gpt-4o-transcribe'
        },
        groq: {
          provider_id: 'groq',
          consent_granted: false,
          api_key: null,
          endpoint_url: null,
          model_name: 'whisper-large-v3-turbo'
        }
      }
    }
  }
}

function normalizeAudioConfig(audio: unknown): AudioConfig {
  if (!isRecord(audio)) return defaultAudioConfig()
  const defaults = defaultAudioConfig()
  const raw = audio as Partial<AudioConfig>
  return {
    ...defaults,
    ...raw,
    diagnostics: {
      ...defaults.diagnostics,
      ...(isRecord(raw.diagnostics) ? raw.diagnostics : {})
    },
    tts: {
      ...defaults.tts,
      ...(isRecord(raw.tts) ? raw.tts : {}),
      piper: {
        ...defaults.tts.piper,
        ...(isRecord(raw.tts) && isRecord(raw.tts.piper) ? raw.tts.piper : {})
      }
    },
    stt: {
      ...defaults.stt,
      ...(isRecord(raw.stt) ? raw.stt : {}),
      cloud: {
        openai: {
          ...defaults.stt.cloud.openai,
          ...(isRecord(raw.stt) && isRecord(raw.stt.cloud) && isRecord(raw.stt.cloud.openai) ? raw.stt.cloud.openai : {})
        },
        groq: {
          ...defaults.stt.cloud.groq,
          ...(isRecord(raw.stt) && isRecord(raw.stt.cloud) && isRecord(raw.stt.cloud.groq) ? raw.stt.cloud.groq : {})
        }
      }
    }
  }
}

export function defaultVoicePresetLibrary(): VoicePresetLibraryDefaults {
  return {
    voicePresets: [],
    referenceAudioAssets: [],
    activePresetByAvatarSession: {}
  }
}

function normalizeVoicePresetValidation(preset: VoicePreset): VoicePreset {
  return {
    ...preset,
    validation: preset.validation ?? null
  }
}

export function getAvatarSessionPresetKey(avatarId: string | null, sessionId: string | null): string {
  const normalizedAvatar = avatarId && avatarId.trim().length > 0 ? avatarId.trim() : 'global'
  const normalizedSession = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'global'
  return `avatar:${normalizedAvatar}|session:${normalizedSession}`
}

export function canDeletePreset(
  presetId: string,
  activePresetByAvatarSession: Record<string, string>
): DeletePresetResult {
  const activeKeys = Object.entries(activePresetByAvatarSession)
    .filter(([, activePresetId]) => activePresetId === presetId)
    .map(([key]) => key)
  if (activeKeys.length > 0) {
    return { ok: false, reason: 'active_preset', activeKeys }
  }
  return { ok: true }
}

export function canDeleteReferenceAudio(
  assetId: string,
  voicePresets: VoicePreset[]
): DeleteReferenceAudioResult {
  const presetIds = voicePresets
    .filter((preset) => preset.gpt_sovits.reference_audio_id === assetId)
    .map((preset) => preset.preset_id)
  if (presetIds.length > 0) {
    return { ok: false, reason: 'reference_audio_in_use', presetIds }
  }
  return { ok: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function migrateStoredConfig(raw: unknown): StoredConfig | null {
  if (!isRecord(raw)) return null
  if (raw.schemaVersion === 2) {
    if (!isRecord(raw.provider)) return null
    const defaults = defaultVoicePresetLibrary()
    return {
      ...(raw as unknown as StoredConfig),
      audio: normalizeAudioConfig(raw.audio),
      voicePresets: Array.isArray(raw.voicePresets)
        ? (raw.voicePresets as VoicePreset[]).map(normalizeVoicePresetValidation)
        : defaults.voicePresets,
      referenceAudioAssets: Array.isArray(raw.referenceAudioAssets)
        ? (raw.referenceAudioAssets as ReferenceAudioAsset[])
        : defaults.referenceAudioAssets,
      activePresetByAvatarSession: isRecord(raw.activePresetByAvatarSession)
        ? (raw.activePresetByAvatarSession as Record<string, string>)
        : defaults.activePresetByAvatarSession
    }
  }
  if (raw.schemaVersion === 1) {
    const v1 = raw as unknown as StoredConfigV1
    return {
      provider: v1.provider,
      plugin: v1.plugin,
      hasCompletedSetup: v1.hasCompletedSetup,
      schemaVersion: 2,
      audio: defaultAudioConfig(),
      ...defaultVoicePresetLibrary()
    }
  }
  return null
}

export function loadConfig(): StoredConfig | null {
  const p = storePath()
  if (!fs.existsSync(p)) return null
  if (!safeStorage.isEncryptionAvailable()) {
    // Linux-no-keyring fallback: app should already have set
    // setUsePlainTextEncryption(true); decryptString will succeed against
    // the obfuscated-but-not-encrypted blob.
    return null
  }
  try {
    const buf = fs.readFileSync(p)
    const json = safeStorage.decryptString(buf)
    const parsed = JSON.parse(json) as unknown
    return migrateStoredConfig(parsed)
  } catch {
    // Corrupted blob: treat as not-configured. User redoes setup.
    return null
  }
}

export function saveConfig(cfg: StoredConfig): void {
  const migrated = migrateStoredConfig(cfg)
  if (migrated === null) throw new Error('Unsupported stored config schemaVersion')
  const json = JSON.stringify({ ...migrated, schemaVersion: 2 })
  const buf = safeStorage.encryptString(json)
  fs.writeFileSync(storePath(), buf, { mode: 0o600 })
}

export function clearConfig(): void {
  const p = storePath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
