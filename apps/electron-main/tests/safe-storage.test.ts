import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\AgenticLLMVTuberTest')
  },
  safeStorage: {
    decryptString: vi.fn((buf: Buffer) => buf.toString('utf8')),
    encryptString: vi.fn((text: string) => Buffer.from(text)),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

import {
  buildGptSoVitsPresetValidationFingerprint,
  canDeletePreset,
  defaultAudioConfig,
  defaultVoicePresetLibrary,
  getGptSoVitsPresetValidationState,
  getAvatarSessionPresetKey,
  migrateStoredConfig
} from '../src/safe-storage'
import type { GptSoVitsProviderConfig } from '../../../packages/contracts/ts/audio-provider'
import type { VoicePreset } from '../../../packages/contracts/ts/voice-preset'

function gptConfig(overrides: Partial<GptSoVitsProviderConfig> = {}): GptSoVitsProviderConfig {
  return {
    provider_id: 'gpt_sovits',
    enabled: true,
    base_url: 'http://127.0.0.1:9880',
    request_timeout_ms: 30_000,
    launch: {
      mode: 'external',
      command: null,
      working_directory: null,
      auto_start: false
    },
    activation: {
      active_allowed: false,
      health_check_passed: false,
      test_synthesis_passed: false,
      last_health_checked_at: null,
      last_test_synthesis_at: null
    },
    ...overrides
  }
}

function voicePreset(overrides: Partial<VoicePreset> = {}): VoicePreset {
  return {
    preset_id: 'preset-akari',
    name: 'Akari bright',
    provider_id: 'gpt_sovits',
    piper_voice_model: null,
    created_at: null,
    updated_at: null,
    validation: null,
    gpt_sovits: {
      reference_audio_id: 'ref-akari',
      prompt_text: 'こんにちは',
      prompt_lang: 'ja',
      text_lang: 'ja',
      top_k: 15,
      top_p: 1,
      temperature: 1,
      speed_factor: 1,
      repetition_penalty: 1.35,
      text_split_method: 'cut5',
      batch_size: 1,
      media_type: 'wav',
      streaming_mode: false
    },
    ...overrides
  }
}

describe('StoredConfig voice preset persistence', () => {
  it('migrates existing config without losing provider, plugin, audio, history, or avatar settings', () => {
    const existingAudio = defaultAudioConfig()
    const migrated = migrateStoredConfig({
      schemaVersion: 2,
      provider: {
        provider: 'custom_openai',
        endpointUrl: 'https://llm.example.test/v1',
        apiKey: 'test-key',
        modelName: 'teto-model'
      },
      plugin: {
        activePluginName: 'test-motion',
        cursorTrackingEnabled: false
      },
      hasCompletedSetup: true,
      audio: existingAudio,
      conversationHistory: {
        activeSessionId: 'session-1',
        sessions: [{ id: 'session-1', title: 'Hello' }]
      },
      avatarCatalog: {
        activeAvatarId: 'teto',
        catalogs: [{ avatarId: 'teto' }]
      }
    } as unknown)

    expect(migrated).toMatchObject({
      provider: {
        provider: 'custom_openai',
        endpointUrl: 'https://llm.example.test/v1',
        apiKey: 'test-key',
        modelName: 'teto-model'
      },
      plugin: {
        activePluginName: 'test-motion',
        cursorTrackingEnabled: false
      },
      hasCompletedSetup: true,
      audio: existingAudio,
      conversationHistory: {
        activeSessionId: 'session-1',
        sessions: [{ id: 'session-1', title: 'Hello' }]
      },
      avatarCatalog: {
        activeAvatarId: 'teto',
        catalogs: [{ avatarId: 'teto' }]
      }
    })
  })

  it('adds voice preset library defaults to new and migrated configs', () => {
    const migrated = migrateStoredConfig({
      schemaVersion: 1,
      provider: {
        provider: 'lm_studio',
        endpointUrl: 'http://localhost:1234/v1',
        apiKey: '',
        modelName: ''
      },
      hasCompletedSetup: true
    })

    expect(defaultVoicePresetLibrary()).toEqual({
      voicePresets: [],
      referenceAudioAssets: [],
      activePresetByAvatarSession: {}
    })
    expect(migrated).toMatchObject(defaultVoicePresetLibrary())
  })

  it('blocks active preset deletion until reassignment without selecting Piper or leaving broken ids', () => {
    const activePresetByAvatarSession = {
      [getAvatarSessionPresetKey('teto', 'morning')]: 'preset-gpt-1'
    }

    const result = canDeletePreset('preset-gpt-1', activePresetByAvatarSession)

    expect(result).toEqual({
      ok: false,
      reason: 'active_preset',
      activeKeys: ['avatar:teto|session:morning']
    })
    expect(activePresetByAvatarSession[getAvatarSessionPresetKey('teto', 'morning')]).toBe('preset-gpt-1')
    expect(Object.values(activePresetByAvatarSession)).not.toContain('piper')
  })

  it('stores active avatar/session association in app settings without avatar catalog mutation artifacts', () => {
    const key = getAvatarSessionPresetKey('teto', 'session-42')
    const migrated = migrateStoredConfig({
      schemaVersion: 2,
      provider: {
        provider: 'lm_studio',
        endpointUrl: 'http://localhost:1234/v1',
        apiKey: '',
        modelName: ''
      },
      hasCompletedSetup: true,
      audio: defaultAudioConfig(),
      activePresetByAvatarSession: {
        [key]: 'preset-gpt-1'
      },
      avatarCatalog: {
        activeAvatarId: 'teto',
        catalogs: [{ avatarId: 'teto', overridesPath: 'avatar_overrides.yaml' }]
      }
    } as unknown)

    expect(migrated?.activePresetByAvatarSession[key]).toBe('preset-gpt-1')
    expect(JSON.stringify(migrated?.avatarCatalog)).not.toContain('preset-gpt-1')
    expect(JSON.stringify(migrated?.avatarCatalog)).not.toContain('activePreset')
  })

  it('uses shared GPT-SoVITS validation helpers for rename-stable fingerprints', () => {
    const config = gptConfig()
    const preset = voicePreset()
    const renamed = voicePreset({ name: 'Renamed Akari' })

    expect(buildGptSoVitsPresetValidationFingerprint(config, preset)).toBe(
      buildGptSoVitsPresetValidationFingerprint(config, renamed)
    )
  })

  it('invalidates GPT-SoVITS validation fingerprints when synthesis-affecting fields change', () => {
    const config = gptConfig()
    const preset = voicePreset()
    const base = buildGptSoVitsPresetValidationFingerprint(config, preset)

    expect(buildGptSoVitsPresetValidationFingerprint(gptConfig({ base_url: 'http://127.0.0.1:9881' }), preset)).not.toBe(base)
    expect(buildGptSoVitsPresetValidationFingerprint(gptConfig({ launch: { ...config.launch, mode: 'app_managed', command: 'python api.py', working_directory: 'C:/gpt-sovits' } }), preset)).not.toBe(base)
    expect(buildGptSoVitsPresetValidationFingerprint(config, voicePreset({ gpt_sovits: { ...preset.gpt_sovits, reference_audio_id: 'ref-other' } }))).not.toBe(base)
    expect(buildGptSoVitsPresetValidationFingerprint(config, voicePreset({ gpt_sovits: { ...preset.gpt_sovits, prompt_text: 'different' } }))).not.toBe(base)
    expect(buildGptSoVitsPresetValidationFingerprint(config, voicePreset({ gpt_sovits: { ...preset.gpt_sovits, top_k: 16 } }))).not.toBe(base)
  })

  it('treats stale or missing preset validation evidence as needing test synthesis', () => {
    const config = gptConfig()
    const preset = voicePreset()
    const fingerprint = buildGptSoVitsPresetValidationFingerprint(config, preset)

    expect(getGptSoVitsPresetValidationState(config, preset)).toBe('needs_test')
    expect(getGptSoVitsPresetValidationState(config, { ...preset, validation: { state: 'validated', fingerprint: 'old', validated_at: '2026-05-10T00:00:00Z', health_checked_at: null, test_synthesis_at: null, summary: null } })).toBe('changed')
    expect(getGptSoVitsPresetValidationState(config, { ...preset, validation: { state: 'validated', fingerprint, validated_at: '2026-05-10T00:00:00Z', health_checked_at: null, test_synthesis_at: null, summary: null } })).toBe('validated')
  })

  it('migrates older presets with null validation metadata', () => {
    const migrated = migrateStoredConfig({
      schemaVersion: 2,
      provider: { provider: 'lm_studio', endpointUrl: 'http://localhost:1234/v1', apiKey: '', modelName: '' },
      hasCompletedSetup: true,
      audio: defaultAudioConfig(),
      voicePresets: [{ ...voicePreset(), validation: undefined }],
      referenceAudioAssets: [],
      activePresetByAvatarSession: {}
    } as unknown)

    expect(migrated?.voicePresets[0]?.validation).toBeNull()
    expect(getGptSoVitsPresetValidationState(gptConfig(), migrated!.voicePresets[0]!)).toBe('needs_test')
  })
})
