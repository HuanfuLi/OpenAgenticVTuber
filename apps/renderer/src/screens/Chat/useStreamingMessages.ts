/**
 * Streaming chat reducer -- port of OLVT chat-history-context.tsx:79-111.
 *
 * State machine for a single turn (UI-SPEC IP-1):
 *   chain-start  -> setThinking(true) -- fresh assistant bubble shows THINKING
 *   full-text    -> confirms Thinking placeholder content (also sent by sidecar)
 *   audio (Nx)   -> first replaces THINKING; subsequent merge into same bubble
 *   force-new    -> setForceNewMessage() -- flags the seal; no visual change
 *   chain-end    -> setInputDisabled(false)
 *   error        -> setBanner('STREAM_ERROR' | 'CONTEXT_OVERFLOW')
 *
 * Owned state is module-level (mirrors apps/renderer/src/ws/store.ts's pattern)
 * so WS dispatcher functions can write without prop-drilling. React components
 * read via useStreamingMessages() / useStreamingBanner() / useInputDisabled().
 *
 * Ported from Open-LLM-VTuber (MIT) -- see apps/renderer/src/PROVENANCE.md.
 * Upstream: frontend-src/web/src/renderer/src/context/chat-history-context.tsx
 * lines 79-111 (`appendAIMessage`).
 */
import { useEffect, useState } from 'react'
import { COPY } from '@/lib/copy'

export type ChatRole = 'user' | 'assistant'

export interface StreamingMessage {
  id: string
  role: ChatRole
  text: string // bubble body -- accumulates per audio envelope
  createdAt: string
  isThinking?: boolean // true while sidecar is between chain-start and first audio
  audioFailures: SentenceAudioFailure[]
}

export interface SentenceAudioFailure {
  sentenceId: number
  failedProviderId: string
  failureSummary: string
}

export type BannerKind = 'STREAM_ERROR' | 'CONTEXT_OVERFLOW' | 'GPT_SOVITS_AUDIO_FAILED'

export interface BannerState {
  kind: BannerKind
  text: string
}

export interface CompletedTurnCandidate {
  userMessageId: string
  sessionId?: string
  userText: string
  assistantText: string
  createdAt: string
}

interface PendingTurn {
  userMessageId: string
  sessionId?: string
  userText: string
  createdAt: string
  failed: boolean
  stopped: boolean
  consumed: boolean
}

interface StreamingState {
  messages: StreamingMessage[]
  forceNewMessage: boolean
  inputDisabled: boolean
  turnSettlingUserMessageId: string | null
  banner: BannerState | null
  isSpeaking: boolean
  pendingTurn: PendingTurn | null
  stoppedTurns: Record<string, PendingTurn>
}

let state: StreamingState = {
  messages: [],
  forceNewMessage: false,
  inputDisabled: false,
  turnSettlingUserMessageId: null,
  banner: null,
  isSpeaking: false,
  pendingTurn: null,
  stoppedTurns: {}
}

const subs = new Set<(s: StreamingState) => void>()
function notify(): void {
  for (const cb of subs) cb(state)
}

function setState(patch: Partial<StreamingState>): void {
  state = { ...state, ...patch }
  notify()
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random()}`
}

// -- public mutators ---------------------------------------------------------

/**
 * Add a user message. Also disables input until chain-end (UI-SPEC IP-3).
 * User messages always start a NEW bubble; they implicitly seal any prior
 * assistant turn (a hung Thinking bubble will simply remain in the history;
 * a banner if any stays visible).
 */
export function appendUserMessage(text: string, sessionId?: string): void {
  const createdAt = new Date().toISOString()
  const next: StreamingMessage = { id: genId(), role: 'user', text, createdAt, audioFailures: [] }
  setState({
    messages: [...state.messages, next],
    inputDisabled: true,
    pendingTurn: {
      userMessageId: next.id,
      sessionId,
      userText: text,
      createdAt,
      failed: false,
      stopped: false,
      consumed: false
    }
  })
}

export function restartStoppedTurn(messageId: string, text: string, sessionId?: string): boolean {
  const pending = state.stoppedTurns[messageId] ?? (
    state.pendingTurn?.stopped && state.pendingTurn.userMessageId === messageId
      ? state.pendingTurn
      : null
  )
  if (!pending) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  const userIndex = state.messages.findIndex((message) => message.id === messageId)
  if (userIndex < 0) return false
  const messages = state.messages.slice()
  messages[userIndex] = { ...messages[userIndex]!, text: trimmed }
  const { [messageId]: _restarted, ...stoppedTurns } = state.stoppedTurns
  setState({
    messages,
    inputDisabled: true,
    forceNewMessage: false,
    banner: null,
    stoppedTurns,
    pendingTurn: {
      ...pending,
      sessionId,
      userText: trimmed,
      failed: false,
      stopped: false,
      consumed: false
    }
  })
  return true
}

function assistantCreatedAt(): string {
  const createdAt = state.pendingTurn?.createdAt
  if (!createdAt) return new Date().toISOString()
  const timestamp = Date.parse(createdAt)
  if (Number.isNaN(timestamp)) return new Date().toISOString()
  return new Date(timestamp + 1).toISOString()
}

/**
 * Called when the sidecar emits chain-start. Creates a fresh assistant bubble
 * holding the THINKING placeholder. The first audio-envelope arrival
 * (appendAssistantSentence) wholesale-replaces the placeholder text per
 * UI-SPEC IP-6. setThinking(false) is unused -- IP-6 edge case (full-text
 * arrived but no audio ever does) is handled by the banner state.
 */
export function setThinking(on: boolean): void {
  if (on) {
    if (state.pendingTurn?.stopped) return
    const messages = state.messages
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last.isThinking) {
      setState({
        // Duplicate chain-start envelopes can arrive for the same turn; keep
        // the existing placeholder so the first audio sentence still replaces it.
        forceNewMessage: false,
        banner: null
      })
      return
    }
    const next: StreamingMessage = {
      id: genId(),
      role: 'assistant',
      text: COPY.CHAT.THINKING,
      createdAt: assistantCreatedAt(),
      isThinking: true,
      audioFailures: []
    }
    setState({
      messages: [...messages, next],
      // The Thinking bubble IS the new turn's bubble, so the seal flag is
      // consumed here -- otherwise the first sentence's appendAssistantSentence
      // would see forceNewMessage=true and create yet another bubble. OLVT's
      // chat-history-context.tsx:89 resets the flag inside its new-bubble
      // branch; we mirror that semantics one envelope earlier.
      forceNewMessage: false,
      // A fresh turn clears any prior banner -- the user is trying again.
      banner: null
    })
  }
}

/**
 * OLVT-port from chat-history-context.tsx:83-111.
 * Merge the sentence into the last AI bubble unless the forceNewMessage flag
 * is set OR the last message is not an assistant bubble.
 */
export function appendAssistantSentence(
  text: string,
  sentenceId: number,
  audioFailure?: Omit<SentenceAudioFailure, 'sentenceId'>
): void {
  if (state.pendingTurn?.stopped) return
  const messages = state.messages
  const last = messages[messages.length - 1]
  const startNew = state.forceNewMessage || !last || last.role !== 'assistant'

  if (startNew) {
    const next: StreamingMessage = {
      id: genId(),
      role: 'assistant',
      text,
      createdAt: assistantCreatedAt(),
      audioFailures: audioFailure ? [{ sentenceId, ...audioFailure }] : []
    }
    setState({
      messages: [...messages, next],
      // Reset the seal flag (OLVT pattern -- chat-history-context.tsx:89).
      forceNewMessage: false
    })
    return
  }

  // Replace Thinking placeholder wholesale on first sentence (IP-6 wholesale
  // replacement); otherwise append to existing body (IP-1 string concat).
  const newText = last.isThinking ? text : last.text + text
  const updated: StreamingMessage = {
    ...last,
    text: newText,
    isThinking: false,
    audioFailures: audioFailure
      ? [...last.audioFailures, { sentenceId, ...audioFailure }]
      : last.audioFailures
  }
  setState({
    messages: [...messages.slice(0, -1), updated]
  })
}

/**
 * D-04 seal -- next sentence lands in a new bubble. No visual change at the
 * moment of receipt (UI-SPEC IP-7).
 */
export function setForceNewMessage(): void {
  if (state.pendingTurn?.stopped) return
  setState({ forceNewMessage: true })
}

export function setInputDisabled(disabled: boolean): void {
  setState({ inputDisabled: disabled })
}

export function setSpeaking(speaking: boolean): void {
  setState({ isSpeaking: speaking })
}

export function setBanner(kind: BannerKind | null): void {
  if (kind === null) {
    setState({ banner: null })
    return
  }
  const text =
    kind === 'STREAM_ERROR'
      ? COPY.CHAT.STREAM_ERROR
      : kind === 'GPT_SOVITS_AUDIO_FAILED'
        ? COPY.CHAT.GPT_SOVITS_NEXT_TURN_FALLBACK
        : COPY.CHAT.CONTEXT_OVERFLOW
  setState({
    banner: { kind, text },
    pendingTurn: state.pendingTurn ? { ...state.pendingTurn, failed: true } : null
  })
}

export function getCompletedTurnCandidate(): CompletedTurnCandidate | null {
  const pending = state.pendingTurn
  if (!pending || pending.failed || pending.stopped || pending.consumed) return null
  const userIndex = state.messages.findIndex((message) => message.id === pending.userMessageId)
  if (userIndex < 0) return null
  const assistantText = state.messages
    .slice(userIndex + 1)
    .filter((message) => message.role === 'assistant' && !message.isThinking)
    .map((message) => message.text)
    .join('')
    .trim()
  const userText = pending.userText.trim()
  if (!userText || !assistantText) return null
  return {
    userMessageId: pending.userMessageId,
    sessionId: pending.sessionId,
    userText,
    assistantText,
    createdAt: pending.createdAt
  }
}

export function beginTurnSettlement(userMessageId: string): void {
  setState({ turnSettlingUserMessageId: userMessageId })
}

export function finishTurnSettlement(userMessageId: string): void {
  if (state.turnSettlingUserMessageId !== userMessageId) return
  setState({ turnSettlingUserMessageId: null })
}

export function stopActiveTurn(): void {
  const pending = state.pendingTurn
  if (!pending) {
    setState({
      inputDisabled: false,
      isSpeaking: false,
      forceNewMessage: false
    })
    return
  }
  const userIndex = state.messages.findIndex((message) => message.id === pending.userMessageId)
  const messages = userIndex >= 0 ? state.messages.slice(0, userIndex + 1) : state.messages
  const stopped = {
    ...pending,
    stopped: true,
    failed: true
  }
  setState({
    messages,
    inputDisabled: false,
    isSpeaking: false,
    forceNewMessage: false,
    pendingTurn: stopped,
    stoppedTurns: { ...state.stoppedTurns, [pending.userMessageId]: stopped }
  })
}

export function markCompletedTurnConsumed(userMessageId = state.pendingTurn?.userMessageId): void {
  if (!userMessageId) return
  const pending = state.pendingTurn
  const userIndex = state.messages.findIndex((message) => message.id === userMessageId)
  const nextUserIndex = state.messages.findIndex((message, index) => index > userIndex && message.role === 'user')
  const nextMessages = userIndex >= 0
    ? [
        ...state.messages.slice(0, userIndex),
        ...state.messages.slice(nextUserIndex >= 0 ? nextUserIndex : state.messages.length)
      ]
    : state.messages
  const stoppedTurns = pending?.stopped && pending.userMessageId === userMessageId
    ? (({ [userMessageId]: _consumed, ...rest }) => rest)(state.stoppedTurns)
    : state.stoppedTurns
  setState({
    messages: nextMessages,
    pendingTurn: pending?.userMessageId === userMessageId ? { ...pending, consumed: true } : pending,
    stoppedTurns,
    forceNewMessage: false
  })
}

/** Reset all streaming state -- used on WS reconnect or test cleanup. */
export function resetStreaming(): void {
  state = {
    messages: [],
    forceNewMessage: false,
    inputDisabled: false,
    turnSettlingUserMessageId: null,
    banner: null,
    isSpeaking: false,
    pendingTurn: null,
    stoppedTurns: {}
  }
  notify()
}

// -- React hooks -------------------------------------------------------------

export function useStreamingMessages(): StreamingMessage[] {
  const [m, setM] = useState(state.messages)
  useEffect(() => {
    const cb = (s: StreamingState): void => setM(s.messages)
    subs.add(cb)
    // Emit current state on subscribe so a late-mounting component catches up.
    setM(state.messages)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return m
}

export function useStreamingBanner(): BannerState | null {
  const [b, setB] = useState(state.banner)
  useEffect(() => {
    const cb = (s: StreamingState): void => setB(s.banner)
    subs.add(cb)
    setB(state.banner)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return b
}

export function useInputDisabled(): boolean {
  const [d, setD] = useState(state.inputDisabled)
  useEffect(() => {
    const cb = (s: StreamingState): void => setD(s.inputDisabled)
    subs.add(cb)
    setD(state.inputDisabled)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return d
}

export function useTurnSettling(): boolean {
  const [turnSettling, setTurnSettling] = useState(Boolean(state.turnSettlingUserMessageId))
  useEffect(() => {
    const cb = (s: StreamingState): void => setTurnSettling(Boolean(s.turnSettlingUserMessageId))
    subs.add(cb)
    setTurnSettling(Boolean(state.turnSettlingUserMessageId))
    return () => {
      subs.delete(cb)
    }
  }, [])
  return turnSettling
}

export function useSpeaking(): boolean {
  const [speaking, setSpeakingState] = useState(state.isSpeaking)
  useEffect(() => {
    const cb = (s: StreamingState): void => setSpeakingState(s.isSpeaking)
    subs.add(cb)
    setSpeakingState(state.isSpeaking)
    return () => {
      subs.delete(cb)
    }
  }, [])
  return speaking
}

/** Test-only inspector. */
export function _internalState(): StreamingState {
  return state
}
