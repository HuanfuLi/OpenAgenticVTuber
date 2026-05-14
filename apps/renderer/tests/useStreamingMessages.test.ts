/**
 * useStreamingMessages reducer tests -- UI-SPEC IP-1, IP-6, IP-7.
 *
 * Phase 2 plan 02-03 Task 1 -- exercises the OLVT-port merge logic and the
 * canonical envelope sequence for a single turn / multi-turn flow.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  appendUserMessage,
  setThinking,
  appendAssistantSentence,
  getCompletedTurnCandidate,
  beginTurnSettlement,
  finishTurnSettlement,
  markCompletedTurnConsumed,
  setForceNewMessage,
  setInputDisabled,
  setBanner,
  resetStreaming,
  _internalState
} from '@/screens/Chat/useStreamingMessages'
import { COPY } from '@/lib/copy'

beforeEach(() => {
  resetStreaming()
})

describe('useStreamingMessages reducer', () => {
  it('appendAssistantSentence merges into last AI bubble', () => {
    appendUserMessage('hi')
    appendAssistantSentence('Hello', 1)
    appendAssistantSentence(' world.', 2)
    const m = _internalState().messages
    expect(m).toHaveLength(2)
    expect(m[0]!.role).toBe('user')
    expect(m[1]!.role).toBe('assistant')
    expect(m[1]!.text).toBe('Hello world.')
  })

  it('force-new-message seals turn -- next sentence lands in fresh bubble', () => {
    appendUserMessage('hi')
    appendAssistantSentence('First.', 1)
    setForceNewMessage()
    appendAssistantSentence('Second turn first sentence.', 2)
    appendAssistantSentence(' Continued.', 3)
    const m = _internalState().messages
    expect(m).toHaveLength(3)
    expect(m[1]!.text).toBe('First.')
    // Subsequent sentences after the seal merge into the new bubble.
    expect(m[2]!.text).toBe('Second turn first sentence. Continued.')
    // Flag reset on first new sentence (OLVT chat-history-context.tsx:89).
    expect(_internalState().forceNewMessage).toBe(false)
  })

  it('THINKING placeholder is wholesale-replaced by first audio sentence', () => {
    appendUserMessage('hi')
    setThinking(true)
    const before = _internalState().messages
    expect(before[before.length - 1]!.text).toBe(COPY.CHAT.THINKING)
    expect(before[before.length - 1]!.isThinking).toBe(true)

    appendAssistantSentence('First sentence.', 1)
    const after = _internalState().messages
    // Length unchanged -- still one assistant bubble (the Thinking one was
    // updated in-place, not replaced with a new entry).
    expect(after).toHaveLength(2)
    // Wholesale replacement -- NOT THINKING + 'First sentence.'.
    expect(after[1]!.text).toBe('First sentence.')
    expect(after[1]!.isThinking).toBe(false)
  })

  it('duplicate chain-start keeps one THINKING placeholder for the turn', () => {
    appendUserMessage('hi')
    setThinking(true)
    setThinking(true)

    const beforeAudio = _internalState().messages
    expect(beforeAudio).toHaveLength(2)
    expect(beforeAudio[1]!.text).toBe(COPY.CHAT.THINKING)
    expect(beforeAudio[1]!.isThinking).toBe(true)

    appendAssistantSentence('First sentence.', 1)
    const afterAudio = _internalState().messages
    expect(afterAudio).toHaveLength(2)
    expect(afterAudio[1]!.text).toBe('First sentence.')
    expect(afterAudio[1]!.isThinking).toBe(false)
  })

  it('IP-6 edge: full-text arrives but no audio -- bubble stays, banner can fire', () => {
    appendUserMessage('hi')
    setThinking(true)
    // No appendAssistantSentence call (the LLM errored mid-thought).
    setBanner('STREAM_ERROR')
    const s = _internalState()
    expect(s.messages[s.messages.length - 1]!.text).toBe(COPY.CHAT.THINKING)
    expect(s.banner?.kind).toBe('STREAM_ERROR')
    expect(s.banner?.text).toBe(COPY.CHAT.STREAM_ERROR)
  })

  it('full canonical sequence -- single turn produces ONE growing bubble', () => {
    // Simulate the WS dispatcher firing in order.
    appendUserMessage('tell me a 3-sentence story')
    setThinking(true)
    setInputDisabled(true) // chain-start
    // full-text("Thinking...") -- no-op; placeholder already rendered.
    appendAssistantSentence('On a quiet afternoon, the cat noticed a glint.', 1)
    appendAssistantSentence(' She leaned forward.', 2)
    appendAssistantSentence(' Her tail flicked once.', 3)
    setForceNewMessage() // force-new-message
    setInputDisabled(false) // chain-end

    const m = _internalState().messages
    // user + ONE growing assistant bubble (NOT 3 bubbles).
    expect(m).toHaveLength(2)
    expect(m[1]!.text).toContain('quiet afternoon')
    expect(m[1]!.text).toContain('leaned forward')
    expect(m[1]!.text).toContain('tail flicked')
    expect(_internalState().inputDisabled).toBe(false)
    expect(_internalState().forceNewMessage).toBe(true)
  })

  it('two consecutive turns -- second turn lands in a fresh bubble (seal works)', () => {
    // Turn 1.
    appendUserMessage('q1')
    setThinking(true)
    appendAssistantSentence('A1.', 1)
    setForceNewMessage()
    // Turn 2.
    appendUserMessage('q2')
    setThinking(true)
    appendAssistantSentence('A2.', 2)
    setForceNewMessage()

    const m = _internalState().messages
    // u1 + a1 + u2 + a2 -- four bubbles total.
    expect(m).toHaveLength(4)
    expect(m[1]!.text).toBe('A1.')
    expect(m[3]!.text).toBe('A2.')
  })

  it('error envelope sets banner state', () => {
    appendUserMessage('hi')
    setThinking(true)
    setBanner('CONTEXT_OVERFLOW')
    setInputDisabled(false)
    const s = _internalState()
    expect(s.banner?.kind).toBe('CONTEXT_OVERFLOW')
    expect(s.banner?.text).toBe(COPY.CHAT.CONTEXT_OVERFLOW)
  })

  it('a fresh turn clears the banner', () => {
    setBanner('STREAM_ERROR')
    expect(_internalState().banner).not.toBeNull()
    setThinking(true)
    expect(_internalState().banner).toBeNull()
  })

  it('appendUserMessage disables input until chain-end', () => {
    appendUserMessage('hi')
    expect(_internalState().inputDisabled).toBe(true)
    setInputDisabled(false)
    expect(_internalState().inputDisabled).toBe(false)
  })

  it('setBanner(null) clears the banner', () => {
    setBanner('STREAM_ERROR')
    expect(_internalState().banner).not.toBeNull()
    setBanner(null)
    expect(_internalState().banner).toBeNull()
  })

  it('exposes a one-shot completed turn candidate and clears it after commit', () => {
    appendUserMessage('save this turn')
    setThinking(true)
    appendAssistantSentence('Saved locally.', 1)

    expect(getCompletedTurnCandidate()).toMatchObject({
      userMessageId: expect.any(String),
      userText: 'save this turn',
      assistantText: 'Saved locally.'
    })

    const candidate = getCompletedTurnCandidate()
    markCompletedTurnConsumed(candidate?.userMessageId)

    expect(getCompletedTurnCandidate()).toBeNull()
    expect(_internalState().messages).toHaveLength(0)
  })

  it('consumes a completed turn by identity without deleting a newer pending turn', () => {
    appendUserMessage('first')
    const firstId = _internalState().pendingTurn!.userMessageId
    appendAssistantSentence('First answer.', 1)
    beginTurnSettlement(firstId)

    appendUserMessage('second')
    const secondId = _internalState().pendingTurn!.userMessageId

    markCompletedTurnConsumed(firstId)
    finishTurnSettlement(firstId)

    const state = _internalState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({ id: secondId, role: 'user', text: 'second' })
    expect(state.pendingTurn?.userMessageId).toBe(secondId)
    expect(state.turnSettlingUserMessageId).toBeNull()
  })

  it('does not expose failed or interrupted turns for persistence', () => {
    appendUserMessage('will fail')
    setThinking(true)
    appendAssistantSentence('Partial', 1)
    setBanner('STREAM_ERROR')

    expect(getCompletedTurnCandidate()).toBeNull()
  })
})
