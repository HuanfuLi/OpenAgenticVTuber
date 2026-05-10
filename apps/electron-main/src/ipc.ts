// IPC bridge: register main-side handlers for the contextBridge API surface
// declared in apps/electron-main/preload/index.ts. Returns a cleanup callback
// that unregisters all listeners (called when the window is destroyed).

import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  getReadyUrl,
  getSidecarHttpUrl,
  onReady,
  onCrash,
  onLog,
  listBodyMotionPlugins,
  restartSidecar,
  resetVtsAuthToken
} from './sidecar'
import {
  getChromeState,
  getLogLevel,
  getThemePreference,
  resolveCurrentAvatarId,
  saveChromeState,
  saveLogLevel,
  saveThemePreference,
  store
} from './window-store'
import { loadConfig, saveConfig, clearConfig, type StoredConfig } from './safe-storage'
import { canDeletePreset, getAvatarSessionPresetKey } from './safe-storage'
import {
  getGptSoVitsProcessStatus,
  restartGptSoVitsProcess,
  startGptSoVitsProcess,
  stopGptSoVitsProcess,
  type GptSoVitsProcessRequest,
  type GptSoVitsProcessStatus
} from './gpt-sovits-process'
import {
  deleteReferenceAudioAsset,
  getManagedReferenceAudioPath,
  pickAndImportReferenceAudio,
  resolveReferenceAudioAssetPath,
  validateReferenceAudioWithSidecar,
  type ManagedReferenceAudioValidationInput,
  type ReferenceAudioValidationInput,
  type ReferenceAudioValidationResponse
} from './reference-audio'
import { createHudWindow } from './hud-window'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'
import type {
  AudioProviderCatalog,
  GptSoVitsHealthRequest,
  GptSoVitsTestSynthesisRequest,
  GptSoVitsTestSynthesisResult,
  STTTestRequest,
  STTTestResult
} from '../../../packages/contracts/ts/audio-provider'
import type { AudioProviderHealth } from '../../../packages/contracts/ts/audio-provider-health'
import type { ReferenceAudioAsset, VoicePreset } from '../../../packages/contracts/ts/voice-preset'
import {
  clearConversationHistory,
  commitConversationTurn,
  createConversationSession,
  deleteConversationSession,
  getActiveConversationSession,
  getConversationStats,
  listConversationSessions,
  renameConversationSession,
  selectConversationSession,
  type CommitConversationTurnInput
} from './conversation-store'

function resolveRepoRoot(): string {
  return path.resolve(app.getAppPath(), '..', '..')
}

function unavailableGptSoVitsHealth(summary: string, state: AudioProviderHealth['state'] = 'unavailable'): AudioProviderHealth {
  return {
    provider_id: 'gpt_sovits',
    kind: 'tts',
    state,
    summary,
    detail: null,
    retryable: true,
    latency_ms: null,
    redacted_diagnostics: null
  }
}

function failedGptSoVitsTestSynthesis(summary: string, state: AudioProviderHealth['state'] = 'external_service_failure'): GptSoVitsTestSynthesisResult {
  return {
    ok: false,
    provider_id: 'gpt_sovits',
    media_type: 'wav',
    audio_base64: null,
    sample_rate_hz: null,
    duration_ms: null,
    summary,
    failure: unavailableGptSoVitsHealth(summary, state)
  }
}

function fallbackAudioProviderCatalog(summary: string): AudioProviderCatalog {
  return {
    providers: [
      {
        provider_id: 'piper',
        kind: 'tts',
        display_name: 'Piper local TTS',
        capabilities: ['local', 'requires_local_model', 'test_synthesis'],
        local: true,
        requires_api_key: false,
        requires_consent: false,
        enabled: true,
        summary
      },
      {
        provider_id: 'gpt_sovits',
        kind: 'tts',
        display_name: 'GPT-SoVITS',
        capabilities: ['local', 'requires_external_service', 'test_synthesis', 'chinese_english'],
        local: true,
        requires_api_key: false,
        requires_consent: false,
        enabled: true,
        summary
      },
      {
        provider_id: 'funasr',
        kind: 'stt',
        display_name: 'FunASR',
        capabilities: ['local', 'requires_local_model', 'test_transcription', 'chinese_english'],
        local: true,
        requires_api_key: false,
        requires_consent: false,
        enabled: true,
        summary
      },
      {
        provider_id: 'faster_whisper',
        kind: 'stt',
        display_name: 'faster-whisper',
        capabilities: ['local', 'requires_local_model', 'test_transcription'],
        local: true,
        requires_api_key: false,
        requires_consent: false,
        enabled: true,
        summary
      },
      {
        provider_id: 'openai',
        kind: 'stt',
        display_name: 'OpenAI STT',
        capabilities: ['cloud', 'requires_api_key', 'test_transcription'],
        local: false,
        requires_api_key: true,
        requires_consent: true,
        enabled: true,
        summary
      },
      {
        provider_id: 'groq',
        kind: 'stt',
        display_name: 'Groq STT',
        capabilities: ['cloud', 'requires_api_key', 'test_transcription'],
        local: false,
        requires_api_key: true,
        requires_consent: true,
        enabled: true,
        summary
      }
    ]
  }
}

function failedSttTest(summary: string, providerId: STTTestResult['provider_id'] = 'funasr', state: AudioProviderHealth['state'] = 'unavailable'): STTTestResult {
  const failure: AudioProviderHealth = {
    provider_id: providerId,
    kind: 'stt',
    state,
    summary,
    detail: null,
    retryable: state === 'unavailable',
    latency_ms: null,
    redacted_diagnostics: null
  }
  return {
    ok: false,
    provider_id: providerId,
    summary,
    failure,
    redacted_diagnostics: null
  }
}

function resolveTestSynthesisSidecarBody(request: GptSoVitsTestSynthesisRequest): GptSoVitsTestSynthesisRequest & { reference_audio_path: string } {
  const referenceAudioId = request.preset.gpt_sovits.reference_audio_id
  if (!referenceAudioId) {
    throw new Error('Select managed reference audio before testing GPT-SoVITS.')
  }
  const cfg = loadConfig()
  if (!cfg) throw new Error('Stored config is not initialized.')
  const { managedPath } = resolveReferenceAudioAssetPath(referenceAudioId, cfg.referenceAudioAssets)
  return { ...request, reference_audio_path: managedPath }
}

async function postSidecarAdminJson<TResponse>(
  pathSuffix: string,
  body: unknown,
  onUnavailable: () => TResponse,
  onHttpFailure: (status: number) => TResponse,
  onFetchFailure: () => TResponse
): Promise<TResponse> {
  let baseUrl: string
  try {
    baseUrl = getSidecarHttpUrl()
  } catch {
    return onUnavailable()
  }
  try {
    const resp = await fetch(`${baseUrl}${pathSuffix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      try {
        await resp.text()
      } catch {
        // Ignore response body; diagnostics may contain user paths or provider internals.
      }
      return onHttpFailure(resp.status)
    }
    return (await resp.json()) as TResponse
  } catch {
    return onFetchFailure()
  }
}

async function getSidecarAdminJson<TResponse>(
  pathSuffix: string,
  onUnavailable: () => TResponse,
  onHttpFailure: (status: number) => TResponse,
  onFetchFailure: () => TResponse
): Promise<TResponse> {
  let baseUrl: string
  try {
    baseUrl = getSidecarHttpUrl()
  } catch {
    return onUnavailable()
  }
  try {
    const resp = await fetch(`${baseUrl}${pathSuffix}`)
    if (!resp.ok) return onHttpFailure(resp.status)
    return (await resp.json()) as TResponse
  } catch {
    return onFetchFailure()
  }
}

async function openPathOrThrow(targetPath: string): Promise<void> {
  const error = await shell.openPath(targetPath)
  if (error) throw new Error(error)
}

export function registerIpc(window: BrowserWindow): () => void {
  // Existing from 01-01:
  ipcMain.handle('sidecar:getReadyUrl', () => getReadyUrl())
  ipcMain.handle('window:getState', () => store.get('window'))
  ipcMain.handle('chrome:getState', () => getChromeState())
  ipcMain.handle('chrome:saveState', (_e, patch) => saveChromeState(patch))
  ipcMain.handle('theme:getPreference', () => getThemePreference())
  ipcMain.handle('theme:savePreference', (_e, prefs) => saveThemePreference(prefs))
  ipcMain.handle('sidecar:restart', async () => {
    await restartSidecar()
  })
  ipcMain.handle('vts:resetAuth', async () => {
    await resetVtsAuthToken()
    await restartSidecar()
  })
  ipcMain.handle('sidecar:getVtsStatus', async () => {
    let baseUrl: string
    try {
      baseUrl = getSidecarHttpUrl()
    } catch {
      return {
        state: 'unavailable',
        detail: 'Sidecar is not ready.',
        authenticated: false,
        windowDetected: false
      }
    }
    try {
      const resp = await fetch(`${baseUrl}/admin/vts-status`)
      if (!resp.ok) {
        return {
          state: 'unavailable',
          detail: `VTS status unavailable: HTTP ${resp.status}`,
          authenticated: false,
          windowDetected: false
        }
      }
      return await resp.json()
    } catch (err) {
      return {
        state: 'unavailable',
        detail: `VTS status unavailable: ${err instanceof Error ? err.message : String(err)}`,
        authenticated: false,
        windowDetected: false
      }
    }
  })
  ipcMain.handle('sidecar:getPluginStatus', async () => {
    let baseUrl: string
    try {
      baseUrl = getSidecarHttpUrl()
    } catch {
      return {
        selectedPlugin: null,
        loadedPlugin: null,
        lifecycleState: 'unknown/loading',
        summary: 'Sidecar is not ready.',
        developerDetails: null,
        fallbackActive: false,
        chatAvailable: true
      }
    }
    try {
      const resp = await fetch(`${baseUrl}/admin/plugin/status`)
      if (!resp.ok) {
        return {
          selectedPlugin: null,
          loadedPlugin: null,
          lifecycleState: 'unknown/loading',
          summary: `Plugin status unavailable: HTTP ${resp.status}`,
          developerDetails: null,
          fallbackActive: false,
          chatAvailable: true
        }
      }
      return await resp.json()
    } catch (err) {
      return {
        selectedPlugin: null,
        loadedPlugin: null,
        lifecycleState: 'unknown/loading',
        summary: `Plugin status unavailable: ${err instanceof Error ? err.message : String(err)}`,
        developerDetails: null,
        fallbackActive: false,
        chatAvailable: true
      }
    }
  })
  ipcMain.handle('sidecar:getAudioStatus', async (): Promise<AudioProviderHealth> => {
    let baseUrl: string
    try {
      baseUrl = getSidecarHttpUrl()
    } catch {
      return {
        provider_id: 'piper',
        kind: 'tts',
        state: 'unavailable',
        summary: 'Sidecar is not ready.',
        detail: null,
        retryable: true,
        latency_ms: null,
        redacted_diagnostics: null
      }
    }
    try {
      const resp = await fetch(`${baseUrl}/admin/audio/status`)
      if (!resp.ok) {
        return {
          provider_id: 'piper',
          kind: 'tts',
          state: 'unavailable',
          summary: `Audio status unavailable: HTTP ${resp.status}`,
          detail: null,
          retryable: true,
          latency_ms: null,
          redacted_diagnostics: null
        }
      }
      return (await resp.json()) as AudioProviderHealth
    } catch (err) {
      return {
        provider_id: 'piper',
        kind: 'tts',
        state: 'unavailable',
        summary: `Audio status unavailable: ${err instanceof Error ? err.message : String(err)}`,
        detail: null,
        retryable: true,
        latency_ms: null,
        redacted_diagnostics: null
      }
    }
  })
  ipcMain.handle(
    'sidecar:getAudioProviders',
    async (): Promise<AudioProviderCatalog> =>
      getSidecarAdminJson<AudioProviderCatalog>(
        '/admin/audio/providers',
        () => fallbackAudioProviderCatalog('Sidecar is not ready.'),
        (status) => fallbackAudioProviderCatalog(`Audio provider catalog unavailable: HTTP ${status}`),
        () => fallbackAudioProviderCatalog('Audio provider catalog unavailable: sidecar request failed.')
      )
  )
  ipcMain.handle(
    'audio:testStt',
    async (_e, request: STTTestRequest): Promise<STTTestResult> => {
      const providerId = request.config.active_provider ?? 'funasr'
      return postSidecarAdminJson<STTTestResult>(
        '/admin/audio/stt/test',
        request,
        () => failedSttTest('Sidecar is not ready.', providerId, 'unavailable'),
        (status) => failedSttTest(`STT test failed: HTTP ${status}`, providerId, 'external_service_failure'),
        () => failedSttTest('STT test failed: sidecar request failed.', providerId, 'external_service_failure')
      )
    }
  )
  ipcMain.handle(
    'gptSovits:checkHealth',
    async (_e, request: GptSoVitsHealthRequest): Promise<AudioProviderHealth> =>
      postSidecarAdminJson<AudioProviderHealth>(
        '/admin/audio/gpt-sovits/health',
        request,
        () => unavailableGptSoVitsHealth('Sidecar is not ready.'),
        (status) =>
          unavailableGptSoVitsHealth(`GPT-SoVITS health check failed: HTTP ${status}`, 'external_service_failure'),
        () => unavailableGptSoVitsHealth('GPT-SoVITS health check failed: sidecar request failed.')
      )
  )
  ipcMain.handle(
    'gptSovits:testSynthesis',
    async (_e, request: GptSoVitsTestSynthesisRequest): Promise<GptSoVitsTestSynthesisResult> => {
      let sidecarBody: GptSoVitsTestSynthesisRequest & { reference_audio_path: string }
      try {
        sidecarBody = resolveTestSynthesisSidecarBody(request)
      } catch (err) {
        return failedGptSoVitsTestSynthesis(err instanceof Error ? err.message : 'Invalid reference audio.', 'misconfigured')
      }
      return postSidecarAdminJson<GptSoVitsTestSynthesisResult>(
        '/admin/audio/test-synthesis',
        sidecarBody,
        () => failedGptSoVitsTestSynthesis('Sidecar is not ready.', 'unavailable'),
        (status) => failedGptSoVitsTestSynthesis(`GPT-SoVITS test synthesis failed: HTTP ${status}`),
        () => failedGptSoVitsTestSynthesis('GPT-SoVITS test synthesis failed: sidecar request failed.')
      )
    }
  )
  ipcMain.handle(
    'gptSovits:start',
    async (_e, request: GptSoVitsProcessRequest): Promise<GptSoVitsProcessStatus> =>
      startGptSoVitsProcess(request)
  )
  ipcMain.handle('gptSovits:status', (): GptSoVitsProcessStatus => getGptSoVitsProcessStatus())
  ipcMain.handle('gptSovits:stop', async (): Promise<GptSoVitsProcessStatus> => stopGptSoVitsProcess())
  ipcMain.handle(
    'gptSovits:restart',
    async (_e, request?: GptSoVitsProcessRequest | null): Promise<GptSoVitsProcessStatus> =>
      restartGptSoVitsProcess(request ?? null)
  )

  // New for 01-02 (safeStorage credential gate, PLUMB-04 / D-07 / D-09):
  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('config:save', async (_e, cfg: StoredConfig) => {
    saveConfig(cfg)
    try {
      await restartSidecar()
    } catch (err) {
      console.error('[main] sidecar restart after config save failed:', err)
      if (!window.isDestroyed()) {
        window.webContents.send('sidecar:crash', { code: -1, willRespawn: false })
      }
      throw err
    }
  })
  ipcMain.handle('config:clear', () => clearConfig())
  ipcMain.handle('voicePresets:list', (): VoicePreset[] => loadConfig()?.voicePresets ?? [])
  ipcMain.handle('voicePresets:save', (_e, preset: VoicePreset): VoicePreset[] => {
    const cfg = loadConfig()
    if (!cfg) throw new Error('Stored config is not initialized.')
    const existingIndex = cfg.voicePresets.findIndex((item) => item.preset_id === preset.preset_id)
    const voicePresets = [...cfg.voicePresets]
    if (existingIndex >= 0) voicePresets[existingIndex] = preset
    else voicePresets.push(preset)
    saveConfig({ ...cfg, voicePresets })
    return voicePresets
  })
  ipcMain.handle('voicePresets:delete', (_e, presetId: string): VoicePreset[] => {
    const cfg = loadConfig()
    if (!cfg) throw new Error('Stored config is not initialized.')
    const guard = canDeletePreset(presetId, cfg.activePresetByAvatarSession)
    if (!guard.ok) {
      throw new Error(`Voice preset is active for: ${guard.activeKeys.join(', ')}`)
    }
    const voicePresets = cfg.voicePresets.filter((preset) => preset.preset_id !== presetId)
    saveConfig({ ...cfg, voicePresets })
    return voicePresets
  })
  ipcMain.handle(
    'voicePresets:setActiveForAvatarSession',
    async (_e, avatarId: string | null, sessionId: string | null, presetId: string): Promise<Record<string, string>> => {
      const cfg = loadConfig()
      if (!cfg) throw new Error('Stored config is not initialized.')
      if (!cfg.voicePresets.some((preset) => preset.preset_id === presetId)) {
        throw new Error('Cannot activate unknown voice preset.')
      }
      const key = getAvatarSessionPresetKey(avatarId, sessionId)
      const activePresetByAvatarSession = { ...cfg.activePresetByAvatarSession, [key]: presetId }
      saveConfig({ ...cfg, activePresetByAvatarSession })
      await restartSidecar()
      return activePresetByAvatarSession
    }
  )
  ipcMain.handle(
    'referenceAudio:validate',
    async (_e, input: ReferenceAudioValidationInput): Promise<ReferenceAudioValidationResponse> => {
      const cfg = loadConfig()
      if (!cfg) throw new Error('Stored config is not initialized.')
      const { asset, managedPath } = resolveReferenceAudioAssetPath(input.assetId, cfg.referenceAudioAssets)
      const sidecarInput: ManagedReferenceAudioValidationInput = {
        managedPath,
        displayBasename: asset.display_basename,
        transcriptText: input.transcriptText,
        language: input.language
      }
      return validateReferenceAudioWithSidecar(getSidecarHttpUrl(), sidecarInput)
    }
  )
  ipcMain.handle(
    'referenceAudio:pickAndImport',
    async (
      _e,
      input: { transcriptText: string; language: ReferenceAudioAsset['language'] }
    ): Promise<ReferenceAudioAsset | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Choose GPT-SoVITS reference audio',
        filters: [{ name: 'Audio', extensions: ['wav', 'flac', 'mp3', 'ogg'] }]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const asset = await pickAndImportReferenceAudio({
        sourcePath: result.filePaths[0]!,
        transcriptText: input.transcriptText,
        language: input.language,
        validate: (validationInput) => validateReferenceAudioWithSidecar(getSidecarHttpUrl(), validationInput)
      })
      const cfg = loadConfig()
      if (!cfg) throw new Error('Stored config is not initialized.')
      saveConfig({ ...cfg, referenceAudioAssets: [...cfg.referenceAudioAssets, asset] })
      return asset
    }
  )
  ipcMain.handle('referenceAudio:delete', (_e, assetId: string): ReferenceAudioAsset[] => {
    const cfg = loadConfig()
    if (!cfg) throw new Error('Stored config is not initialized.')
    const result = deleteReferenceAudioAsset(assetId, cfg.voicePresets, cfg.referenceAudioAssets)
    if (!result.ok) {
      throw new Error(`Reference audio is used by presets: ${result.presetIds.join(', ')}`)
    }
    for (const asset of result.removedAssets) {
      const managedPath = getManagedReferenceAudioPath(asset)
      if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath)
    }
    const referenceAudioAssets = cfg.referenceAudioAssets.filter((asset) => asset.asset_id !== assetId)
    saveConfig({ ...cfg, referenceAudioAssets })
    return referenceAudioAssets
  })
  ipcMain.handle('plugin:listBodyMotionPlugins', () => listBodyMotionPlugins())
  ipcMain.handle('avatar:getCurrentId', () => resolveCurrentAvatarId(resolveRepoRoot()))
  ipcMain.handle('avatar:getCurrentPlan', async (): Promise<AvatarImportPlan | null> => {
    const currentAvatarId = resolveCurrentAvatarId(resolveRepoRoot())
    if (!currentAvatarId) return null
    try {
      const resp = await fetch(
        `${getSidecarHttpUrl()}/admin/avatar/import/current?avatar_id=${encodeURIComponent(currentAvatarId)}`
      )
      if (!resp.ok) return null
      return (await resp.json()) as AvatarImportPlan
    } catch {
      return null
    }
  })
  ipcMain.handle('avatar:pickFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choose avatar folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]!
  })
  ipcMain.handle('avatar:requestImportPlan', async (_e, folder: string): Promise<AvatarImportPlan> => {
    const resp = await fetch(`${getSidecarHttpUrl()}/admin/avatar/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder })
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Import failed: HTTP ${resp.status} - ${text}`)
    }
    return (await resp.json()) as AvatarImportPlan
  })
  ipcMain.handle(
    'avatar:commitOverrides',
    async (_e, plan: AvatarImportPlan): Promise<{ status: string; path: string }> => {
      const resp = await fetch(`${getSidecarHttpUrl()}/admin/avatar/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Commit failed: HTTP ${resp.status} - ${text}`)
      }
      if (plan.avatar_id) store.set('currentAvatarId', plan.avatar_id)
      const body = (await resp.json()) as { status: string; path: string }
      await restartSidecar()
      return body
    }
  )
  ipcMain.handle('hud:open', () => {
    createHudWindow()
  })
  ipcMain.handle('log:getLevel', () => getLogLevel())
  ipcMain.handle('log:saveLevel', (_e, level) => saveLogLevel(level))
  ipcMain.handle('shell:openLogFolder', async () => {
    const logsPath = app.getPath('logs')
    fs.mkdirSync(logsPath, { recursive: true })
    await openPathOrThrow(logsPath)
  })
  ipcMain.handle('shell:openSetupHelp', async () => {
    await openPathOrThrow(path.join(resolveRepoRoot(), 'README.md'))
  })
  ipcMain.handle('shell:openVtsDocs', async () => {
    await shell.openExternal('https://github.com/DenchiSoft/VTubeStudio/wiki/Plugins')
  })
  ipcMain.handle('conversation:listSessions', () => listConversationSessions())
  ipcMain.handle('conversation:getActive', () => getActiveConversationSession())
  ipcMain.handle('conversation:create', () => createConversationSession())
  ipcMain.handle('conversation:select', (_e, id: string) => selectConversationSession(id))
  ipcMain.handle('conversation:rename', (_e, id: string, title: string) =>
    renameConversationSession(id, title)
  )
  ipcMain.handle('conversation:delete', (_e, id: string) => deleteConversationSession(id))
  ipcMain.handle('conversation:clear', () => clearConversationHistory())
  ipcMain.handle('conversation:commitTurn', (_e, input: CommitConversationTurnInput) =>
    commitConversationTurn(input)
  )
  ipcMain.handle('conversation:getStats', () => getConversationStats())

  const offReady = onReady((url) => {
    if (!window.isDestroyed()) window.webContents.send('sidecar:ready', url)
  })
  const offCrash = onCrash((info) => {
    if (!window.isDestroyed()) window.webContents.send('sidecar:crash', info)
  })
  const offLog = onLog((line) => {
    if (!window.isDestroyed()) window.webContents.send('sidecar:log', line)
  })

  return () => {
    offReady()
    offCrash()
    offLog()
    ipcMain.removeHandler('sidecar:getReadyUrl')
    ipcMain.removeHandler('window:getState')
    ipcMain.removeHandler('chrome:getState')
    ipcMain.removeHandler('chrome:saveState')
    ipcMain.removeHandler('theme:getPreference')
    ipcMain.removeHandler('theme:savePreference')
    ipcMain.removeHandler('sidecar:restart')
    ipcMain.removeHandler('vts:resetAuth')
    ipcMain.removeHandler('sidecar:getVtsStatus')
    ipcMain.removeHandler('sidecar:getPluginStatus')
    ipcMain.removeHandler('sidecar:getAudioStatus')
    ipcMain.removeHandler('sidecar:getAudioProviders')
    ipcMain.removeHandler('audio:testStt')
    ipcMain.removeHandler('gptSovits:checkHealth')
    ipcMain.removeHandler('gptSovits:testSynthesis')
    ipcMain.removeHandler('gptSovits:start')
    ipcMain.removeHandler('gptSovits:status')
    ipcMain.removeHandler('gptSovits:stop')
    ipcMain.removeHandler('gptSovits:restart')
    ipcMain.removeHandler('config:load')
    ipcMain.removeHandler('config:save')
    ipcMain.removeHandler('config:clear')
    ipcMain.removeHandler('voicePresets:list')
    ipcMain.removeHandler('voicePresets:save')
    ipcMain.removeHandler('voicePresets:delete')
    ipcMain.removeHandler('voicePresets:setActiveForAvatarSession')
    ipcMain.removeHandler('referenceAudio:pickAndImport')
    ipcMain.removeHandler('referenceAudio:validate')
    ipcMain.removeHandler('referenceAudio:delete')
    ipcMain.removeHandler('plugin:listBodyMotionPlugins')
    ipcMain.removeHandler('avatar:getCurrentId')
    ipcMain.removeHandler('avatar:getCurrentPlan')
    ipcMain.removeHandler('avatar:pickFolder')
    ipcMain.removeHandler('avatar:requestImportPlan')
    ipcMain.removeHandler('avatar:commitOverrides')
    ipcMain.removeHandler('hud:open')
    ipcMain.removeHandler('log:getLevel')
    ipcMain.removeHandler('log:saveLevel')
    ipcMain.removeHandler('shell:openLogFolder')
    ipcMain.removeHandler('shell:openSetupHelp')
    ipcMain.removeHandler('shell:openVtsDocs')
    ipcMain.removeHandler('conversation:listSessions')
    ipcMain.removeHandler('conversation:getActive')
    ipcMain.removeHandler('conversation:create')
    ipcMain.removeHandler('conversation:select')
    ipcMain.removeHandler('conversation:rename')
    ipcMain.removeHandler('conversation:delete')
    ipcMain.removeHandler('conversation:clear')
    ipcMain.removeHandler('conversation:commitTurn')
    ipcMain.removeHandler('conversation:getStats')
  }
}
