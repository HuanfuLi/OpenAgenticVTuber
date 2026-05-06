/* SPEC §Chat -- empty-state branching, banner stack, input row.
 *
 * Ported from prototype src/shell.jsx ChatView (lines 245-359).
 * Plan 01-02: mockEcho swapped for real WS round-trip via @/ws/client + @/ws/store.
 *  - User input: append local user bubble + send({type: 'text-input', text}).
 *  - Assistant reply: handled in @/ws/store subscribe() -> pushBubble on display-text.
 *  - Banners stay wired to mockBanners (per DELTA: real connection state binding
 *    is layered later when the LLM connection-status manager lands; the WS
 *    open/close flag controls the input row's `disabled` instead).
 */
import { useEffect, useRef, useState } from 'react'
import { Send } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { mockBanners, SCRIPTED_CONVO } from '@/dev/__mocks__/mock-backend'
import { send } from '@/ws/client'
import { appendUserMessage, useChatBubbles, useWSConnected } from '@/ws/store'

export function Chat() {
  const { status, banners, chatMessages, setChatMessages } = useStore()
  const wsBubbles = useChatBubbles()
  const wsOpen = useWSConnected()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Inject scripted convo via window event from dev panel (DEV-only).
  // The scripted convo writes to the local app-store's chatMessages slice so
  // it doesn't fight the WS bubble stream.
  useEffect(() => {
    const onInject = (): void =>
      setChatMessages(
        SCRIPTED_CONVO.map((m, i) => ({ id: Date.now() + i, role: m.role, text: m.text }))
      )
    window.addEventListener('chat:inject', onInject)
    return () => window.removeEventListener('chat:inject', onInject)
  }, [setChatMessages])

  // Combine the (DEV-injected) scripted convo with the live WS bubble stream.
  // Live messages append after any scripted ones, in order.
  const merged = [
    ...chatMessages.map((m) => ({
      id: String(m.id),
      role: m.role,
      text: m.text
    })),
    ...wsBubbles
  ]

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [merged.length])

  const onSend = (): void => {
    const text = input.trim()
    if (!text) return
    if (banners.llm) return // disabled by banner
    setInput('')
    appendUserMessage(text)
    // OLVT-shape envelope per packages/contracts/ts/ws-message.ts.
    const ok = send({ type: 'text-input', text })
    if (!ok) {
      // WS not ready — no-op for skeleton (the local-echo bubble is still added).
      // 01-02 doesn't ship send-failure UX; that's UX-10 in v2.
    }
  }

  const empty = merged.length === 0
  const vtsReady = status.vts === 'green'
  const inputDisabled = banners.llm || !wsOpen

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
                onClick={() => alert('(mock) Would open: VTube Studio docs')}
              >
                {COPY.CHAT.EMPTY_VTS_LINK}
              </button>
            </div>
          )
        ) : (
          merged.map((m) => {
            // numeric ids come from prototype scripted convo; UUID strings come
            // from WS bubbles. Both are stable for the lifetime of the bubble.
            const numericTs = Number(m.id)
            const ts = !Number.isNaN(numericTs)
              ? new Date(numericTs).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="meta">
                  <span className="semibold">{m.role === 'user' ? 'You' : 'Teto'}</span>
                  <span>{ts}</span>
                </div>
                <div className="body">{m.text}</div>
              </div>
            )
          })
        )}
      </div>

      {/* Banners (above input row) */}
      {banners.llm && (
        <div className="banner">
          ⚠ {COPY.ERRORS.LLM_UNREACHABLE_BANNER}
          <button
            className="btn btn-secondary"
            style={{ height: 26, padding: '0 10px', fontSize: 12 }}
            onClick={() => mockBanners.set({ llm: false })}
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
            onClick={() => mockBanners.set({ vtsAuth: false })}
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
            onClick={() => mockBanners.set({ sidecarRepeat: false })}
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
    </div>
  )
}
