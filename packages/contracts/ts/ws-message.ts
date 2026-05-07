// Hand-written mirror of packages/contracts/py/ws_message.py (Phase 1+2).
// Codegen replaces this in Phase 5 (SC-02). Pydantic is source-of-truth.
import type { AudioPayloadMessage } from './audio-payload'
export type { AudioPayloadMessage } from './audio-payload'
export type { ActionIntent } from './action-intent'
export type { DisplayTextField } from './audio-payload'

// Phase 1:
export interface TextInputMessage { type: 'text-input'; text: string }
export interface DisplayTextMessage { type: 'display-text'; text: string }
export interface ShutdownMessage { type: 'shutdown' }

// Phase 2:
export interface ControlMessage { type: 'control'; text: string }
export interface FullTextMessage { type: 'full-text'; text: string }
export interface ForceNewMessageMessage { type: 'force-new-message' }
export interface ErrorMessage { type: 'error'; message: string }
export interface LogMessage { type: 'log'; level: string; message: string }

export type WSMessage =
  | TextInputMessage
  | DisplayTextMessage
  | ShutdownMessage
  | AudioPayloadMessage
  | ControlMessage
  | FullTextMessage
  | ForceNewMessageMessage
  | ErrorMessage
  | LogMessage

// Type guards (Phase 1 -- unchanged):
export const isTextInput = (m: WSMessage): m is TextInputMessage => m.type === 'text-input'
export const isDisplayText = (m: WSMessage): m is DisplayTextMessage => m.type === 'display-text'
export const isShutdown = (m: WSMessage): m is ShutdownMessage => m.type === 'shutdown'

// Type guards (Phase 2 -- new):
export const isAudioPayload = (m: WSMessage): m is AudioPayloadMessage => m.type === 'audio'
export const isControl = (m: WSMessage): m is ControlMessage => m.type === 'control'
export const isFullText = (m: WSMessage): m is FullTextMessage => m.type === 'full-text'
export const isForceNewMessage = (m: WSMessage): m is ForceNewMessageMessage => m.type === 'force-new-message'
export const isError = (m: WSMessage): m is ErrorMessage => m.type === 'error'
export const isLog = (m: WSMessage): m is LogMessage => m.type === 'log'
