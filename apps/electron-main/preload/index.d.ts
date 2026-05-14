import type { RendererApi } from './index'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'
import type {
  AudioProviderCatalog,
  GptSoVitsHealthRequest,
  GptSoVitsTestSynthesisRequest,
  GptSoVitsTestSynthesisResult,
  STTModelCacheCatalog,
  STTModelCacheOperationRequest,
  STTModelCacheOperationResult,
  STTTestRequest,
  STTTestResult,
  VoiceInputReadiness,
  VoiceInputTranscriptionRequest,
  VoiceInputTranscriptionResult
} from '../../../packages/contracts/ts/audio-provider'
import type { AudioProviderHealth } from '../../../packages/contracts/ts/audio-provider-health'
import type {
  ConversationSession,
  ConversationSessionSummary,
  ConversationStats,
  CommitConversationTurnInput
} from '../src/conversation-store'
import type { ReferenceAudioAsset, VoicePreset } from '../../../packages/contracts/ts/voice-preset'
import type {
  GptSoVitsProcessRequest,
  GptSoVitsProcessStatus
} from '../src/gpt-sovits-process'
import type {
  ReferenceAudioValidationInput,
  ReferenceAudioValidationResponse
} from '../src/reference-audio'

export type VoicePresetBridge = {
  listVoicePresets(): Promise<VoicePreset[]>
  saveVoicePreset(preset: VoicePreset): Promise<VoicePreset[]>
  deleteVoicePreset(presetId: string): Promise<VoicePreset[]>
  setActiveVoicePresetForAvatarSession(
    avatarId: string | null,
    sessionId: string | null,
    presetId: string
  ): Promise<Record<string, string>>
  pickAndImportReferenceAudio(input: {
    transcriptText: string
    language: ReferenceAudioAsset['language']
  }): Promise<ReferenceAudioAsset | null>
  validateReferenceAudio(input: ReferenceAudioValidationInput): Promise<ReferenceAudioValidationResponse>
  deleteReferenceAudio(assetId: string): Promise<ReferenceAudioAsset[]>
}

export type GptSoVitsAudioBridge = {
  getAudioProviders(): Promise<AudioProviderCatalog>
  testSttProvider(input: STTTestRequest): Promise<STTTestResult>
  getSttModels(input: STTTestRequest): Promise<STTModelCacheCatalog>
  downloadSttModel(input: STTModelCacheOperationRequest): Promise<STTModelCacheOperationResult>
  removeSttModel(input: STTModelCacheOperationRequest): Promise<STTModelCacheOperationResult>
  getVoiceInputReadiness(): Promise<VoiceInputReadiness>
  requestMicrophonePermission(): Promise<VoiceInputReadiness['permission_state']>
  transcribeVoiceInput(input: Omit<VoiceInputTranscriptionRequest, 'config'>): Promise<VoiceInputTranscriptionResult>
  checkGptSoVitsHealth(input: GptSoVitsHealthRequest): Promise<AudioProviderHealth>
  testGptSoVitsSynthesis(input: GptSoVitsTestSynthesisRequest): Promise<GptSoVitsTestSynthesisResult>
  startGptSoVits(input: GptSoVitsProcessRequest): Promise<GptSoVitsProcessStatus>
  getGptSoVitsProcessStatus(): Promise<GptSoVitsProcessStatus>
  stopGptSoVits(): Promise<GptSoVitsProcessStatus>
  restartGptSoVits(input?: GptSoVitsProcessRequest | null): Promise<GptSoVitsProcessStatus>
}

export type AvatarImportBridge = {
  getCurrentAvatarId(): Promise<string>
  getCurrentAvatarPlan(): Promise<AvatarImportPlan | null>
  pickAvatarFolder(): Promise<string | null>
  requestImportPlan(folder: string): Promise<AvatarImportPlan>
  commitAvatarOverrides(plan: AvatarImportPlan): Promise<{ status: string; path: string }>
}

export type ConversationHistoryBridge = {
  listConversationSessions(): Promise<ConversationSessionSummary[]>
  getActiveConversationSession(): Promise<ConversationSession>
  createConversationSession(): Promise<ConversationSession>
  selectConversationSession(id: string): Promise<ConversationSession>
  renameConversationSession(id: string, title: string): Promise<ConversationSession>
  deleteConversationSession(id: string): Promise<ConversationSession>
  clearConversationHistory(): Promise<ConversationSession>
  commitConversationTurn(input: CommitConversationTurnInput): Promise<ConversationSession>
  truncateConversationBeforeMessage(sessionId: string, messageId: string): Promise<ConversationSession>
  getConversationStats(): Promise<ConversationStats>
}

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
