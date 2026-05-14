/* SPEC §Chat -- empty-state branching, banner stack, input row.
 *
 * Ported from prototype src/shell.jsx ChatView (lines 245-359).
 * Phase 1 plan 01-02: mockEcho swapped for real WS round-trip.
 * Phase 2 plan 02-03: chat state collapses to useStreamingMessages -- one
 * growing assistant bubble per turn (UI-SPEC IP-1); banner above input row
 * for STREAM_ERROR / CONTEXT_OVERFLOW; sticky-scroll with 40px slack (IP-2);
 * input disabled while turn is in flight (IP-3).
 */
import { useEffect, useRef, useState } from 'react'
import { Send, Square } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { useConversationHistory } from '@/state/conversation-history'
import {
  consumeFinalCandidate,
  promoteQueuedFinalCandidate,
  queueFinalCandidate,
  useVoiceInput
} from '@/state/voice-input-store'
import { send } from '@/ws/client'
import { stopAudioPlayback } from '@/ws/audio-player'
import { appendUserMessage, useWSConnected } from '@/ws/store'
import {
  useStreamingMessages,
  useStreamingBanner,
  useInputDisabled,
  useSpeaking,
  useTurnSettling,
  stopActiveTurn,
  restartStoppedTurn
} from './useStreamingMessages'
import type { ConversationMessage } from '@preload-types'
import { VoiceInputControl } from './VoiceInputControl'

export function Chat() {
  const { status, banners, refreshStatus, restartSidecar, setBanners, setView } = useStore()
  const { activeSession, truncateBeforeMessage } = useConversationHistory()
  const messages = useStreamingMessages()
  const streamBanner = useStreamingBanner()
  const turnInFlight = useInputDisabled()
  const isSpeaking = useSpeaking()
  const turnSettling = useTurnSettling()
  const wsOpen = useWSConnected()
  const voice = useVoiceInput()
  const [input, setInput] = useState('')
  const [editing, setEditing] = useState<{ id: string; source: 'persisted' | 'streaming'; text: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputDisabled = turnInFlight || turnSettling || banners.llm || !wsOpen
  const turnActive = turnInFlight || isSpeaking

  const merged = [
    ...activeSession.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      isThinking: false,
      audioFailures: [],
      createdAt: m.createdAt,
      source: 'persisted' as const
    })),
    ...messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      isThinking: m.isThinking ?? false,
      audioFailures: m.audioFailures,
      createdAt: m.createdAt,
      source: 'streaming' as const
    }))
  ].sort((a, b) => {
    const aTime = Date.parse(a.createdAt)
    const bTime = Date.parse(b.createdAt)
    if (Number.isNaN(aTime) || Number.isNaN(bTime) || aTime === bTime) return 0
    return aTime - bTime
  })

  // UI-SPEC IP-2 sticky-scroll: respect user scroll-up by 40px. Recompute when
  // a new bubble appears OR an existing bubble's text grew (sentence merged
  // into Thinking placeholder or appended to a streaming bubble).
  const textKey = merged.map((m) => m.text).join('|')
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [merged.length, textKey])

  const submitFinalText = (
    rawText: string,
    options: { history?: ConversationMessage[]; reuseStopped?: boolean; messageId?: string } = {}
  ): boolean => {
    const text = rawText.trim()
    if (!text) return false
    if (banners.llm || turnInFlight || turnSettling || !wsOpen) return false
    if (options.reuseStopped) {
      if (!options.messageId || !restartStoppedTurn(options.messageId, text, activeSession.id)) return false
    } else {
      appendUserMessage(text, activeSession.id)
    }
    const history = options.history ?? activeSession.messages
    // OLVT-shape envelope per packages/contracts/ts/ws-message.ts.
    const ok = send({
      type: 'text-input',
      text,
      session_id: activeSession.id,
      history: history.map((message) => ({
        role: message.role,
        text: message.text
      }))
    })
    if (!ok) {
      // WS not ready -- no-op for skeleton (the local-echo bubble is still added).
    }
    return true
  }

  const canEditMessages = !turnActive && !turnSettling && !banners.llm && wsOpen

  const saveEdit = async (message: { id: string; source: 'persisted' | 'streaming'; text: string }): Promise<void> => {
    const nextText = editing?.text.trim() ?? ''
    if (!nextText || !canEditMessages) return
    if (message.source === 'persisted') {
      try {
        const truncated = await truncateBeforeMessage(activeSession.id, message.id)
        if (submitFinalText(nextText, { history: truncated.messages })) setEditing(null)
      } catch (error) {
        console.warn('[chat] edit/regenerate failed:', error)
      }
      return
    }
    if (submitFinalText(nextText, { history: activeSession.messages, reuseStopped: true, messageId: message.id })) {
      setEditing(null)
    }
  }

  const onSend = (): void => {
    const submitted = submitFinalText(input)
    if (submitted) setInput('')
  }

  const onStop = (): void => {
    stopActiveTurn()
    stopAudioPlayback()
    if (wsOpen) {
      send({ type: 'stop-turn' })
    }
  }

  useEffect(() => {
    const candidate = voice.finalCandidate
    if (!candidate) return
    if (inputDisabled || isSpeaking) {
      queueFinalCandidate(candidate, COPY.CHAT.VOICE_QUEUE_REPLACED)
      return
    }
    const submitted = submitFinalText(candidate.transcript)
    if (submitted) {
      consumeFinalCandidate()
    }
  }, [
    activeSession.id,
    activeSession.messages,
    banners.llm,
    inputDisabled,
    isSpeaking,
    turnInFlight,
    voice.finalCandidate,
    wsOpen
  ])

  useEffect(() => {
    if (!voice.queuedFinalCandidate || inputDisabled || turnSettling || isSpeaking || !wsOpen || banners.llm) return
    const candidate = promoteQueuedFinalCandidate()
    if (!candidate) return
    const submitted = submitFinalText(candidate.transcript)
    if (submitted) {
      consumeFinalCandidate()
    } else {
      queueFinalCandidate(candidate, COPY.CHAT.VOICE_QUEUE_REPLACED)
    }
  }, [
    activeSession.id,
    activeSession.messages,
    banners.llm,
    inputDisabled,
    isSpeaking,
    turnSettling,
    voice.queuedFinalCandidate,
    wsOpen
  ])

  const empty = merged.length === 0
  const vtsReady = status.vts === 'green'

  return (
    <div className="view">
      <div
        className="chat-scroll"
        ref={scrollRef}
        role="log"
        aria-live="polite"
      >
        {empty ? (
          vtsReady ? (
            <div className="empty-state">
              <h2>{COPY.CHAT.EMPTY_READY_HEAD}</h2>
              <p>{COPY.CHAT.EMPTY_READY_BODY}</p>
              <p className="footer-cap">{COPY.CHAT.EMPTY_READY_FOOTER}</p>
            </div>
          ) : (
            <div className="empty-state">
              <h2>{COPY.CHAT.EMPTY_VTS_HEAD}</h2>
              <p>{COPY.CHAT.EMPTY_VTS_BODY}</p>
              <button
                className="btn btn-link"
                onClick={() => void window.api?.openVtsDocs?.()}
              >
                {COPY.CHAT.EMPTY_VTS_LINK}
              </button>
            </div>
          )
        ) : (
          merged.map((m) => {
            // UUID strings come from persisted history or the streaming reducer.
            // Numeric fallback keeps older in-memory message shapes readable.
            const numericTs = Number(m.id)
            const date =
              m.createdAt ? new Date(m.createdAt) :
              !Number.isNaN(numericTs) ? new Date(numericTs) :
              new Date()
            const ts = date.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
            return (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="meta">
                  <span className="semibold">{m.role === 'user' ? 'You' : 'Teto'}</span>
                  <span>{ts}</span>
                  {m.role === 'user' && canEditMessages && (
                    <button
                      type="button"
                      className="bubble-action"
                      aria-label={COPY.CHAT.EDIT_MESSAGE}
                      onClick={() => setEditing({ id: m.id, source: m.source, text: m.text })}
                    >
                      {COPY.CHAT.EDIT}
                    </button>
                  )}
                </div>
                <div className="body">
                  {editing?.id === m.id ? (
                    <div className="bubble-edit">
                      <textarea
                        className="input"
                        value={editing.text}
                        aria-label={COPY.CHAT.EDIT_MESSAGE}
                        onChange={(event) => setEditing({ ...editing, text: event.target.value })}
                      />
                      <div className="bubble-edit-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditing(null)}
                        >
                          {COPY.CHAT.CANCEL_EDIT}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!editing.text.trim() || !canEditMessages}
                          onClick={() => void saveEdit(m)}
                        >
                          {COPY.CHAT.SAVE_EDIT}
                        </button>
                      </div>
                    </div>
                  ) : m.isThinking ? (
                    <span style={{ fontStyle: 'italic', color: 'var(--muted-foreground)' }}>
                      {m.text}
                    </span>
                  ) : (
                    m.text
                  )}
                  {m.audioFailures.length > 0 && (
                    <div className="audio-failure" role="note">
                      <span>{COPY.CHAT.GPT_SOVITS_AUDIO_FAILED_SENTENCE}</span>
                      <span className="footer-cap"> {COPY.CHAT.GPT_SOVITS_OPEN_LOGS}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Phase 2 streaming-error banners -- STREAM_ERROR / CONTEXT_OVERFLOW. */}
      {streamBanner && (
        <div className="banner" role="alert" data-banner-kind={streamBanner.kind}>
          <span aria-hidden="true">⚠ </span>
          {streamBanner.text}
        </div>
      )}

      {/* Phase 1 banners -- driven by app-store.banners (mock for skeleton). */}
      {banners.llm && (
        <div className="banner">
          ⚠ {COPY.ERRORS.LLM_UNREACHABLE_BANNER}
          <button
            className="btn btn-secondary"
            style={{ height: 26, padding: '0 10px', fontSize: 12 }}
            onClick={() => {
              void refreshStatus().then(() => setBanners({ llm: false }))
            }}
          >
            Retry
          </button>
        </div>
      )}
      {banners.vts && <div className="banner warn">{COPY.ERRORS.VTS_DISCONNECTED}</div>}
      {banners.vtsAuth && (
        <div className="banner warn">
          {COPY.ERRORS.VTS_AUTH_DENIED}
          <button
            className="btn btn-secondary"
            style={{ height: 26, padding: '0 10px', fontSize: 12 }}
            onClick={() => {
              void restartSidecar().then(() => setBanners({ vtsAuth: false }))
            }}
          >
            Re-request
          </button>
        </div>
      )}
      {banners.sidecarRepeat && (
        <div className="banner">
          {COPY.ERRORS.SIDECAR_REPEAT}
          <button
            className="btn btn-secondary"
            style={{ height: 26, padding: '0 10px', fontSize: 12 }}
            onClick={() => {
              void restartSidecar().then(() => setBanners({ sidecarRepeat: false }))
            }}
          >
            Restart sidecar
          </button>
        </div>
      )}
      {banners.tts && <div className="banner warn">{COPY.ERRORS.TTS_UNAVAILABLE}</div>}

      <VoiceInputControl
        sessionId={activeSession.id}
        turnInProgress={Boolean(inputDisabled || isSpeaking)}
        onOpenSetup={() => {
          setView('settings')
          window.location.hash = 'sec-voice-in'
        }}
      />
      <div className="input-row">
        <input
          className="input"
          placeholder={COPY.CHAT.INPUT_PLACEHOLDER}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (!turnActive) onSend()
            }
          }}
          disabled={inputDisabled}
          aria-label="Chat input"
        />
        <button
          className={`send${turnActive ? ' stop' : ''}`}
          onClick={turnActive ? onStop : onSend}
          disabled={turnActive ? false : (!input.trim() || inputDisabled)}
          aria-label={turnActive ? COPY.CHAT.STOP_RESPONSE : COPY.CHAT.SEND}
        >
          {turnActive ? <Square size={14} fill="currentColor" /> : <Send size={16} />}
        </button>
      </div>
      {isSpeaking && (
        <div
          className="speaking-label"
          role="status"
          aria-live="polite"
          data-testid="speaking-label"
          style={{
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--muted-foreground)',
            fontStyle: 'italic'
          }}
        >
          {COPY.CHAT.SPEAKING}
        </div>
      )}
    </div>
  )
}
