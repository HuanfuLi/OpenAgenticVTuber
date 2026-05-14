// GENERATED FROM packages/contracts/py/contracts/ws_message.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { Dispatch } from './dispatch';
import type { AudioPayloadMessage, DisplayTextField } from './audio-payload';
export type WSMessage = TextInputMessage
  | DisplayTextMessage
  | ShutdownMessage
  | StopTurnMessage
  | AudioPayloadMessage
  | ControlMessage
  | FullTextMessage
  | ForceNewMessageMessage
  | ErrorMessage
  | LogMessage;
export type RedactedDiagnostics = {
  [k: string]: string
} | null;
export type State =
  | 'ok'
  | 'unavailable'
  | 'missing_credential'
  | 'external_service_failure'
  | 'timeout'
  | 'misconfigured';

export interface TextInputMessage {
  history: TextInputHistoryMessage[];
  session_id: string | null;
  text: string;
  type: 'text-input'
}
export interface TextInputHistoryMessage {
  role: 'user' | 'assistant';
  text: string
}
export interface DisplayTextMessage {
  text: string;
  type: 'display-text'
}
export interface ShutdownMessage {
  type: 'shutdown'
}
export interface StopTurnMessage {
  type: 'stop-turn'
}


export interface ControlMessage {
  text: string;
  type: 'control'
}
/**
 * OLVT conversation_utils.py:143 -- turn-start 'Thinking...' echo (D-03).
 */
export interface FullTextMessage {
  text: string;
  type: 'full-text'
}
/**
 * OLVT conversation_utils.py:181 -- turn seal (D-04).
 */
export interface ForceNewMessageMessage {
  type: 'force-new-message'
}
/**
 * Surfaced as a banner above the chat input (CHAT.STREAM_ERROR or
 * CHAT.CONTEXT_OVERFLOW per UI-SPEC Copywriting Contract).
 */
export interface ErrorMessage {
  message: string;
  type: 'error'
}
/**
 * Sidecar stdout/loguru bridge to renderer Logs drawer (Phase 1 channel,
 * re-used for structured sidecar log lines per D-14, D-23).
 */
export interface LogMessage {
  level: string;
  message: string;
  type: 'log'
}


export const isTextInput = (message: WSMessage): message is TextInputMessage =>
  message.type === 'text-input';

export const isDisplayText = (message: WSMessage): message is DisplayTextMessage =>
  message.type === 'display-text';

export const isShutdown = (message: WSMessage): message is ShutdownMessage =>
  message.type === 'shutdown';

export const isAudioPayload = (message: WSMessage): message is AudioPayloadMessage =>
  message.type === 'audio';

export const isControl = (message: WSMessage): message is ControlMessage =>
  message.type === 'control';

export const isFullText = (message: WSMessage): message is FullTextMessage =>
  message.type === 'full-text';

export const isForceNewMessage = (message: WSMessage): message is ForceNewMessageMessage =>
  message.type === 'force-new-message';

export const isError = (message: WSMessage): message is ErrorMessage =>
  message.type === 'error';

export const isLog = (message: WSMessage): message is LogMessage =>
  message.type === 'log';
