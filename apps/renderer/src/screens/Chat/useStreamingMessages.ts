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
  isThinking?: boolean // true while sidecar is between chain-start and first audio
}

export type BannerKind = 'STREAM_ERROR' | 'CONTEXT_OVERFLOW'

export interface BannerState {
  kind: BannerKind
  text: string
}

interface StreamingState {
  messages: StreamingMessage[]
  forceNewMessage: boolean
  inputDisabled: boolean
  banner: BannerState | null
}

let state: StreamingState = {
  messages: [],
  forceNewMessage: false,
  inputDisabled: false,
  banner: null
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
export function appendUserMessage(text: string): void {
  const next: StreamingMessage = { id: genId(), role: 'user', text }
  setState({
    messages: [...state.messages, next],
    inputDisabled: true
  })
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
    const next: StreamingMessage = {
      id: genId(),
      role: 'assistant',
      text: COPY.CHAT.THINKING,
      isThinking: true
    }
    setState({
      messages: [...state.messages, next],
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
export function appendAssistantSentence(text: string, _sentenceId: number): void {
  const messages = state.messages
  const last = messages[messages.length - 1]
  const startNew = state.forceNewMessage || !last || last.role !== 'assistant'

  if (startNew) {
    const next: StreamingMessage = {
      id: genId(),
      role: 'assistant',
      text
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
    isThinking: false
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
  setState({ forceNewMessage: true })
}

export function setInputDisabled(disabled: boolean): void {
  setState({ inputDisabled: disabled })
}

export function setBanner(kind: BannerKind | null): void {
  if (kind === null) {
    setState({ banner: null })
    return
  }
  const text = kind === 'STREAM_ERROR' ? COPY.CHAT.STREAM_ERROR : COPY.CHAT.CONTEXT_OVERFLOW
  setState({ banner: { kind, text } })
}

/** Reset all streaming state -- used on WS reconnect or test cleanup. */
export function resetStreaming(): void {
  state = {
    messages: [],
    forceNewMessage: false,
    inputDisabled: false,
    banner: null
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

/** Test-only inspector. */
export function _internalState(): StreamingState {
  return state
}
