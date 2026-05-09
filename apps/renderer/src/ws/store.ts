// Renderer-side WS dispatcher (Phase 2 plan 02-03).
//
// Routes the seven Phase 2 envelope variants plus the Phase 1 display-text
// passthrough into the streaming-chat reducer (useStreamingMessages.ts) and a
// log sink that AppShell subscribes to for the LogsDrawer.
//
// Phase 2 collapses chat state into useStreamingMessages -- the legacy
// pushBubble/useChatBubbles module-state from Phase 1 plan 01-02 is superseded.
// Chat.tsx now reads from useStreamingMessages exclusively.

import { useEffect, useState } from 'react'
import { subscribe, subscribeState } from './client'
import {
  isAudioPayload,
  isControl,
  isFullText,
  isForceNewMessage,
  isError,
  isLog,
  isDisplayText
} from '@contracts/ws-message'
import type { WSMessage } from '@contracts/ws-message'
import {
  appendUserMessage as _appendUserMessage,
  setThinking,
  appendAssistantSentence,
  getCompletedTurnCandidate,
  markCompletedTurnConsumed,
  setForceNewMessage,
  setInputDisabled,
  setBanner,
  setSpeaking
} from '@/screens/Chat/useStreamingMessages'
import { commitConversationTurnFromDispatcher } from '@/state/conversation-history'

// -- log channel: sidecar log envelopes flow through here to AppShell --------

type LogSink = (line: string) => void
const logSinks = new Set<LogSink>()
export function subscribeWSLog(cb: LogSink): () => void {
  logSinks.add(cb)
  return () => {
    logSinks.delete(cb)
  }
}

// -- WS dispatcher -----------------------------------------------------------

subscribe((msg: WSMessage) => {
  if (isControl(msg)) {
    if (msg.text === 'conversation-chain-start') {
      setThinking(true)
      setInputDisabled(true)
      setSpeaking(false)
    } else if (msg.text === 'conversation-chain-end') {
      const completedTurn = getCompletedTurnCandidate()
      if (completedTurn) {
        void commitConversationTurnFromDispatcher(completedTurn).then((session) => {
          if (session) markCompletedTurnConsumed()
        })
      }
      setInputDisabled(false)
      setSpeaking(false)
    }
    return
  }
  if (isFullText(msg)) {
    // Sidecar already created the assistant bubble via chain-start ->
    // setThinking. The full-text envelope carries "Thinking..." which matches
    // the placeholder we already render. No-op (UI-SPEC IP-6).
    return
  }
  if (isAudioPayload(msg)) {
    appendAssistantSentence(msg.display_text.text, msg.sentence_id)
    setSpeaking(true)
    return
  }
  if (isForceNewMessage(msg)) {
    setForceNewMessage()
    return
  }
  if (isError(msg)) {
    const kind = msg.message.startsWith('Conversation got too long')
      ? 'CONTEXT_OVERFLOW'
      : 'STREAM_ERROR'
    setBanner(kind)
    // Re-enable input so the user can retry.
    setInputDisabled(false)
    setSpeaking(false)
    return
  }
  if (isLog(msg)) {
    for (const cb of logSinks) cb(msg.message)
    return
  }
  if (isDisplayText(msg)) {
    // Phase 1 fallback path -- non-TTS surfaces (errors, system messages,
    // full-text echo). Treat as a single-sentence assistant message so the
    // legacy echo flow still produces a visible bubble.
    appendAssistantSentence(msg.text, 0)
    return
  }
  // Unknown envelope types silently dropped (matches OLVT _route_message).
})

// -- re-exports preserved from Phase 1 ---------------------------------------

/**
 * Append a user message to the streaming chat reducer. Phase 1 callers used
 * this to push a local user bubble immediately on Enter.
 */
export function appendUserMessage(text: string, sessionId?: string): void {
  _appendUserMessage(text, sessionId)
}

/** Phase 1 connection-state hook -- still consumed by Chat.tsx. */
export function useWSConnected(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => subscribeState(setOpen), [])
  return open
}

// Phase 2 BREAKING CHANGE from plan 01-02: useChatBubbles is removed. Chat.tsx
// now reads from useStreamingMessages directly. Surfacing the Phase 1 hook
// would only delay the inevitable migration.
