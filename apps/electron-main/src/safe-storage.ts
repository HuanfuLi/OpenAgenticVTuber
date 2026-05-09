// Electron safeStorage credential gate (PLUMB-04, D-07, D-09).
// On Windows: DPAPI-encrypted blob at %APPDATA%/AgenticLLMVTuber/llm-config.enc
// On macOS:  Keychain-backed encryption.
// On Linux:  libsecret if available; falls back to plaintext when no keyring
//            (CONTEXT.md D-07 accepts this; main process opts in via
//            safeStorage.setUsePlainTextEncryption(true)).

import { app, safeStorage } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'

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

export interface StoredConfig {
  provider: ProviderConfig
  plugin?: BodyMotionPluginConfig
  hasCompletedSetup: boolean
  schemaVersion: 1
}

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
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
    const parsed = JSON.parse(json) as StoredConfig
    // Schema-version guard -- re-prompt setup if we ever bump v1->v2.
    if (parsed.schemaVersion !== 1) return null
    return parsed
  } catch {
    // Corrupted blob: treat as not-configured. User redoes setup.
    return null
  }
}

export function saveConfig(cfg: StoredConfig): void {
  const json = JSON.stringify(cfg)
  const buf = safeStorage.encryptString(json)
  fs.writeFileSync(storePath(), buf, { mode: 0o600 })
}

export function clearConfig(): void {
  const p = storePath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
