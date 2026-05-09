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
  canDeletePreset,
  defaultAudioConfig,
  defaultVoicePresetLibrary,
  getAvatarSessionPresetKey,
  migrateStoredConfig
} from '../src/safe-storage'

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
})
