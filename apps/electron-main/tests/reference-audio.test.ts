import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'avt-reference-audio-'))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return testUserData
      return testUserData
    })
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

import type { VoicePreset } from '../../../packages/contracts/ts/voice-preset'
import {
  deleteReferenceAudioAsset,
  pickAndImportReferenceAudio,
  validateReferenceAudioWithSidecar
} from '../src/reference-audio'

function _preset(referenceAudioId: string): VoicePreset {
  return {
    preset_id: 'preset-1',
    name: 'Teto GPT',
    provider_id: 'gpt_sovits',
    piper_voice_model: null,
    created_at: null,
    updated_at: null,
    gpt_sovits: {
      reference_audio_id: referenceAudioId,
      prompt_text: 'hello',
      prompt_lang: 'en',
      text_lang: 'en',
      top_k: 15,
      top_p: 1,
      temperature: 1,
      text_split_method: 'cut5',
      batch_size: 1,
      speed_factor: 1,
      media_type: 'wav',
      streaming_mode: false,
      repetition_penalty: 1.35
    }
  }
}

describe('reference audio import and validation helpers', () => {
  it('copies selected audio to sanitized userData storage and validates before saving', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avt-reference-source-'))
    const sourcePath = path.join(sourceDir, 'My Prompt Voice!!.wav')
    fs.writeFileSync(sourcePath, Buffer.from('fake wav'))
    const validate = vi.fn().mockResolvedValue({
      ok: true,
      format: 'wav',
      duration_seconds: 2.5,
      sample_rate: 24_000,
      channels: 1,
      errors: [],
      redacted_diagnostics: 'reference_audio=My Prompt Voice!!.wav; validated wav'
    })

    const asset = await pickAndImportReferenceAudio({
      sourcePath,
      transcriptText: 'hello reference',
      language: 'en',
      assetId: 'asset-test',
      validate
    })

    const expectedBasename = 'asset-test-My-Prompt-Voice.wav'
    const expectedManagedPath = path.join(testUserData, 'reference-audio', expectedBasename)
    expect(asset).toMatchObject({
      asset_id: 'asset-test',
      display_basename: 'My Prompt Voice!!.wav',
      managed_path_token: path.join('reference-audio', expectedBasename),
      transcript_text: 'hello reference',
      language: 'en',
      format: 'wav',
      duration_ms: 2500
    })
    expect(fs.existsSync(expectedManagedPath)).toBe(true)
    expect(validate).toHaveBeenCalledWith({
      managedPath: expectedManagedPath,
      displayBasename: 'My Prompt Voice!!.wav',
      transcriptText: 'hello reference',
      language: 'en'
    })
    expect(asset.managed_path_token).not.toContain(sourceDir)
  })

  it('proxies validation to the sidecar and does not save invalid imports', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: false,
        format: 'wav',
        duration_seconds: null,
        sample_rate: null,
        channels: null,
        errors: [{ code: 'unreadable_metadata', message: 'Reference audio metadata could not be read.' }],
        redacted_diagnostics: 'reference_audio=bad.wav; soundfile.info failed: LibsndfileError'
      })
    })
    const validation = await validateReferenceAudioWithSidecar(
      'http://127.0.0.1:8765',
      {
        managedPath: 'C:/app/reference-audio/bad.wav',
        displayBasename: 'bad.wav',
        transcriptText: 'bad',
        language: 'en'
      },
      fetchMock as unknown as typeof fetch
    )
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/admin/audio/reference-audio/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        managed_path: 'C:/app/reference-audio/bad.wav',
        display_basename: 'bad.wav',
        transcript_text: 'bad',
        language: 'en'
      })
    })
    expect(validation.ok).toBe(false)
  })

  it('blocks deleting in-use reference audio without cascade-deleting presets', () => {
    const result = deleteReferenceAudioAsset('asset-in-use', [_preset('asset-in-use')], [])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('reference_audio_in_use')
      expect(result.presetIds).toEqual(['preset-1'])
    }
  })

  it('exposes preset and reference-audio preload APIs in the typed bridge', () => {
    const preloadSource = fs.readFileSync(path.join(process.cwd(), 'preload/index.ts'), 'utf-8')
    const declarationSource = fs.readFileSync(path.join(process.cwd(), 'preload/index.d.ts'), 'utf-8')

    for (const method of [
      'listVoicePresets',
      'saveVoicePreset',
      'deleteVoicePreset',
      'setActiveVoicePresetForAvatarSession',
      'pickAndImportReferenceAudio',
      'validateReferenceAudio',
      'deleteReferenceAudio'
    ]) {
      expect(preloadSource).toContain(method)
      expect(declarationSource).toContain(method)
    }
  })
})
