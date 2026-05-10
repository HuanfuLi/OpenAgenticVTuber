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
  defaultAudioConfig,
  migrateStoredConfig
} from '../../electron-main/src/safe-storage'

describe('StoredConfig audio migration', () => {
  it('migrates schemaVersion 1 configs to schemaVersion 2 without losing setup state', () => {
    const migrated = migrateStoredConfig({
      schemaVersion: 1,
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
      hasCompletedSetup: true
    })

    expect(migrated).toEqual({
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
      audio: defaultAudioConfig(),
      voicePresets: [],
      referenceAudioAssets: [],
      activePresetByAvatarSession: {}
    })
  })

  it('fills missing audio defaults for schemaVersion 2 configs and rejects unknown versions', () => {
    const migrated = migrateStoredConfig({
      schemaVersion: 2,
      provider: {
        provider: 'lm_studio',
        endpointUrl: 'http://localhost:1234/v1',
        apiKey: '',
        modelName: ''
      },
      hasCompletedSetup: true
    })

    expect(migrated?.audio).toEqual(defaultAudioConfig())
    expect(migrateStoredConfig({ schemaVersion: 99 })).toBeNull()
  })
})
