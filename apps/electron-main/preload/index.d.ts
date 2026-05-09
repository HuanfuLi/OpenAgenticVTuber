import type { RendererApi } from './index'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'
import type {
  ConversationSession,
  ConversationSessionSummary,
  ConversationStats,
  CommitConversationTurnInput
} from '../src/conversation-store'

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
  getConversationStats(): Promise<ConversationStats>
}

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
