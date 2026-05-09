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
}

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
}

export function defaultAudioConfig(): AudioConfig {
  return {
    schema_version: 1,
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
      capture_timeout_ms: 30_000,
      execution: 'off_event_loop'
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function migrateStoredConfig(raw: unknown): StoredConfig | null {
  if (!isRecord(raw)) return null
  if (raw.schemaVersion === 2) {
    if (!isRecord(raw.provider)) return null
    return {
      ...(raw as unknown as StoredConfig),
      audio: isRecord(raw.audio) ? (raw.audio as unknown as AudioConfig) : defaultAudioConfig()
    }
  }
  if (raw.schemaVersion === 1) {
    const v1 = raw as unknown as StoredConfigV1
    return {
      provider: v1.provider,
      plugin: v1.plugin,
      hasCompletedSetup: v1.hasCompletedSetup,
      schemaVersion: 2,
      audio: defaultAudioConfig()
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
