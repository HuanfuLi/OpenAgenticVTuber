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
import { Send } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { useConversationHistory } from '@/state/conversation-history'
import { send } from '@/ws/client'
import { appendUserMessage, useWSConnected } from '@/ws/store'
import {
  useStreamingMessages,
  useStreamingBanner,
  useInputDisabled,
  useSpeaking
} from './useStreamingMessages'

export function Chat() {
  const { status, banners, refreshStatus, restartSidecar, setBanners } = useStore()
  const { activeSession } = useConversationHistory()
  const messages = useStreamingMessages()
  const streamBanner = useStreamingBanner()
  const turnInFlight = useInputDisabled()
  const isSpeaking = useSpeaking()
  const wsOpen = useWSConnected()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const merged = [
    ...activeSession.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      isThinking: false,
      audioFailures: [],
      createdAt: m.createdAt
    })),
    ...messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      isThinking: m.isThinking ?? false,
      audioFailures: m.audioFailures,
      createdAt: null
    }))
  ]

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

  const onSend = (): void => {
    const text = input.trim()
    if (!text) return
    if (banners.llm || turnInFlight) return // disabled by banner or turn-in-flight
    setInput('')
    appendUserMessage(text, activeSession.id)
    // OLVT-shape envelope per packages/contracts/ts/ws-message.ts.
    const ok = send({
      type: 'text-input',
      text,
      session_id: activeSession.id,
      history: activeSession.messages.map((message) => ({
        role: message.role,
        text: message.text
      }))
    })
    if (!ok) {
      // WS not ready -- no-op for skeleton (the local-echo bubble is still added).
    }
  }

  const empty = merged.length === 0
  const vtsReady = status.vts === 'green'
  const inputDisabled = turnInFlight || banners.llm || !wsOpen

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
                </div>
                <div className="body">
                  {m.isThinking ? (
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

      <div className="input-row">
        <input
          className="input"
          placeholder={COPY.CHAT.INPUT_PLACEHOLDER}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          disabled={inputDisabled}
          aria-label="Chat input"
        />
        <button
          className="send"
          onClick={onSend}
          disabled={!input.trim() || inputDisabled}
          aria-label="Send"
        >
          <Send size={16} />
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
