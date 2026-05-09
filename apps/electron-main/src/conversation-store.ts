import Store from 'electron-store'

export type ConversationRole = 'user' | 'assistant'
export type ConversationTitleSource = 'auto' | 'manual'

export interface ConversationMessage {
  id: string
  role: ConversationRole
  text: string
  createdAt: string
}

export interface ConversationSession {
  id: string
  title: string
  titleSource: ConversationTitleSource
  createdAt: string
  updatedAt: string
  lastMessageAt: string | null
  messages: ConversationMessage[]
}

export interface ConversationSessionSummary {
  id: string
  title: string
  titleSource: ConversationTitleSource
  createdAt: string
  updatedAt: string
  lastMessageAt: string | null
  messageCount: number
  preview: string
}

export interface ConversationStats {
  sessionCount: number
  messageCount: number
  activeSessionId: string
  persistence: 'local'
}

export interface CommitConversationTurnInput {
  sessionId: string
  userText: string
  assistantText: string
  createdAt?: string
}

interface ConversationStoreSchema {
  schemaVersion: 1
  activeSessionId: string
  sessions: ConversationSession[]
}

const NEW_CHAT_TITLE = 'New chat'
const TITLE_MAX = 80
const PREVIEW_MAX = 120

const conversationStore = new Store<ConversationStoreSchema>({
  name: 'conversation-history',
  defaults: {
    schemaVersion: 1,
    activeSessionId: '',
    sessions: []
  }
})

function isoNow(): string {
  return new Date().toISOString()
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function clampText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function normalizeTitle(title: string): string {
  return clampText(title, TITLE_MAX) || NEW_CHAT_TITLE
}

function createEmptySession(now = isoNow()): ConversationSession {
  return {
    id: genId('session'),
    title: NEW_CHAT_TITLE,
    titleSource: 'auto',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    messages: []
  }
}

function normalizeSession(session: ConversationSession): ConversationSession {
  const now = isoNow()
  const messages = Array.isArray(session.messages) ? session.messages : []
  const lastMessage = messages[messages.length - 1]
  return {
    id: session.id || genId('session'),
    title: normalizeTitle(session.title),
    titleSource: session.titleSource === 'manual' ? 'manual' : 'auto',
    createdAt: session.createdAt || now,
    updatedAt: session.updatedAt || lastMessage?.createdAt || now,
    lastMessageAt: session.lastMessageAt ?? lastMessage?.createdAt ?? null,
    messages: messages.map((message) => ({
      id: message.id || genId('message'),
      role: message.role === 'assistant' ? 'assistant' : 'user',
      text: String(message.text ?? ''),
      createdAt: message.createdAt || now
    }))
  }
}

function readState(): ConversationStoreSchema {
  const raw: ConversationStoreSchema = {
    schemaVersion: 1,
    activeSessionId: conversationStore.get('activeSessionId'),
    sessions: conversationStore.get('sessions') ?? []
  }
  const sessions = raw.sessions.map(normalizeSession)
  let activeSessionId = raw.activeSessionId
  if (!sessions.some((session) => session.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id ?? ''
  }
  if (sessions.length === 0) {
    const session = createEmptySession()
    const state = { schemaVersion: 1 as const, activeSessionId: session.id, sessions: [session] }
    writeState(state)
    return state
  }
  const state = { schemaVersion: 1 as const, activeSessionId, sessions }
  writeState(state)
  return state
}

function writeState(state: ConversationStoreSchema): void {
  conversationStore.set('schemaVersion', 1)
  conversationStore.set('activeSessionId', state.activeSessionId)
  conversationStore.set('sessions', state.sessions)
}

function findSessionOrThrow(state: ConversationStoreSchema, id: string): ConversationSession {
  const session = state.sessions.find((candidate) => candidate.id === id)
  if (!session) throw new Error(`Conversation session not found: ${id}`)
  return session
}

function summarizeSession(session: ConversationSession): ConversationSessionSummary {
  const lastMessage = session.messages[session.messages.length - 1]
  return {
    id: session.id,
    title: session.title,
    titleSource: session.titleSource,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt,
    messageCount: session.messages.length,
    preview: lastMessage ? clampText(lastMessage.text, PREVIEW_MAX) : ''
  }
}

export function listConversationSessions(): ConversationSessionSummary[] {
  return readState().sessions
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(summarizeSession)
}

export function getActiveConversationSession(): ConversationSession {
  const state = readState()
  return findSessionOrThrow(state, state.activeSessionId)
}

export function createConversationSession(): ConversationSession {
  const state = readState()
  const session = createEmptySession()
  writeState({
    ...state,
    activeSessionId: session.id,
    sessions: [session, ...state.sessions]
  })
  return session
}

export function selectConversationSession(id: string): ConversationSession {
  const state = readState()
  const session = findSessionOrThrow(state, id)
  writeState({ ...state, activeSessionId: session.id })
  return session
}

export function renameConversationSession(id: string, title: string): ConversationSession {
  const state = readState()
  const now = isoNow()
  let renamed: ConversationSession | null = null
  const sessions = state.sessions.map((session) => {
    if (session.id !== id) return session
    renamed = {
      ...session,
      title: normalizeTitle(title),
      titleSource: 'manual',
      updatedAt: now
    }
    return renamed
  })
  if (!renamed) throw new Error(`Conversation session not found: ${id}`)
  writeState({ ...state, sessions })
  return renamed
}

export function deleteConversationSession(id: string): ConversationSession {
  const state = readState()
  const remaining = state.sessions.filter((session) => session.id !== id)
  if (remaining.length === state.sessions.length) return getActiveConversationSession()
  if (remaining.length === 0) {
    const session = createEmptySession()
    writeState({ schemaVersion: 1, activeSessionId: session.id, sessions: [session] })
    return session
  }
  const activeSessionId =
    state.activeSessionId === id ? remaining[0]!.id : state.activeSessionId
  writeState({ ...state, activeSessionId, sessions: remaining })
  return findSessionOrThrow({ ...state, activeSessionId, sessions: remaining }, activeSessionId)
}

export function clearConversationHistory(): ConversationSession {
  const session = createEmptySession()
  writeState({ schemaVersion: 1, activeSessionId: session.id, sessions: [session] })
  return session
}

export function commitConversationTurn(input: CommitConversationTurnInput): ConversationSession {
  const state = readState()
  const session = findSessionOrThrow(state, input.sessionId)
  const userText = input.userText.trim()
  const assistantText = input.assistantText.trim()
  if (!userText || !assistantText) {
    throw new Error('Conversation turn requires non-empty user and assistant text.')
  }
  const userCreatedAt = input.createdAt ?? isoNow()
  const assistantCreatedAt = isoNow()
  const wasEmpty = session.messages.length === 0
  const userMessage: ConversationMessage = {
    id: genId('message'),
    role: 'user',
    text: userText,
    createdAt: userCreatedAt
  }
  const assistantMessage: ConversationMessage = {
    id: genId('message'),
    role: 'assistant',
    text: assistantText,
    createdAt: assistantCreatedAt
  }
  const nextSession: ConversationSession = {
    ...session,
    title:
      wasEmpty && session.titleSource === 'auto'
        ? normalizeTitle(userText)
        : session.title,
    updatedAt: assistantCreatedAt,
    lastMessageAt: assistantCreatedAt,
    messages: [...session.messages, userMessage, assistantMessage]
  }
  const sessions = state.sessions.map((candidate) =>
    candidate.id === session.id ? nextSession : candidate
  )
  writeState({ ...state, sessions })
  return nextSession
}

export function getConversationStats(): ConversationStats {
  const state = readState()
  return {
    sessionCount: state.sessions.length,
    messageCount: state.sessions.reduce((total, session) => total + session.messages.length, 0),
    activeSessionId: state.activeSessionId,
    persistence: 'local'
  }
}
