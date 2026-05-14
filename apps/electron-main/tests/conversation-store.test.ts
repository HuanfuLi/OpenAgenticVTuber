import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeData = vi.hoisted(() => new Map<string, unknown>())

vi.mock('electron-store', () => ({
  default: class MockStore {
    constructor(options: { defaults?: Record<string, unknown> } = {}) {
      for (const [key, value] of Object.entries(options.defaults ?? {})) {
        if (!storeData.has(key)) storeData.set(key, value)
      }
    }

    get(key: string) {
      return storeData.get(key)
    }

    set(key: string, value: unknown) {
      storeData.set(key, value)
    }
  }
}))

import {
  clearConversationHistory,
  commitConversationTurn,
  truncateConversationBeforeMessage
} from '../src/conversation-store'

describe('conversation-store edit/regenerate truncation', () => {
  beforeEach(() => {
    storeData.clear()
  })

  it('truncates before a middle user message and preserves earlier messages', () => {
    const session = clearConversationHistory()
    const first = commitConversationTurn({
      sessionId: session.id,
      userText: 'first prompt',
      assistantText: 'first answer',
      createdAt: '2026-05-12T10:00:00.000Z'
    })
    const second = commitConversationTurn({
      sessionId: session.id,
      userText: 'bad transcript',
      assistantText: 'bad answer',
      createdAt: '2026-05-12T10:01:00.000Z'
    })

    const truncated = truncateConversationBeforeMessage(session.id, second.messages[2]!.id)

    expect(truncated.messages.map((message) => message.text)).toEqual(['first prompt', 'first answer'])
    expect(truncated.title).toBe(first.title)
    expect(truncated.titleSource).toBe('auto')
    expect(truncated.lastMessageAt).toBe(first.messages[1]!.createdAt)
    expect(truncated.updatedAt).toBeTruthy()
  })

  it('truncates the latest user message and its assistant answer', () => {
    const session = clearConversationHistory()
    const committed = commitConversationTurn({
      sessionId: session.id,
      userText: 'latest prompt',
      assistantText: 'latest answer'
    })

    const truncated = truncateConversationBeforeMessage(session.id, committed.messages[0]!.id)

    expect(truncated.messages).toEqual([])
    expect(truncated.lastMessageAt).toBeNull()
  })

  it('rejects assistant and unknown message targets', () => {
    const session = clearConversationHistory()
    const committed = commitConversationTurn({
      sessionId: session.id,
      userText: 'prompt',
      assistantText: 'answer'
    })

    expect(() => truncateConversationBeforeMessage(session.id, committed.messages[1]!.id))
      .toThrow(/user message/)
    expect(() => truncateConversationBeforeMessage(session.id, 'missing-message'))
      .toThrow(/not found/)
  })
})
