/* SPEC §Chat — empty-state branching, banner stack, input row.
 *
 * Ported from prototype src/shell.jsx ChatView (lines 245–359).
 * Plan 01-01: uses mockEcho for round-trip (DEV-only). Plan 01-02 will swap
 * `await mockEcho(text, 200)` for the real WS client send/await.
 */
import { useEffect, useRef, useState } from 'react'
import { Send } from '@/lib/icons'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { mockEcho, mockBanners, SCRIPTED_CONVO } from '@/dev/__mocks__/mock-backend'

export function Chat() {
  const { status, banners, chatMessages, setChatMessages } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Inject scripted convo via window event from dev panel.
  useEffect(() => {
    const onInject = (): void =>
      setChatMessages(
        SCRIPTED_CONVO.map((m, i) => ({ id: Date.now() + i, role: m.role, text: m.text }))
      )
    window.addEventListener('chat:inject', onInject)
    return () => window.removeEventListener('chat:inject', onInject)
  }, [setChatMessages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatMessages.length, sending])

  const onSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || sending) return
    if (banners.llm) return // disabled by banner
    setInput('')
    setSending(true)
    const userMsg = { id: Date.now(), role: 'user' as const, text }
    setChatMessages((m) => [...m, userMsg])
    const reply = await mockEcho(text, 200)
    setChatMessages((m) => [...m, { id: Date.now() + 1, role: 'assistant' as const, text: reply }])
    setSending(false)
  }

  const empty = chatMessages.length === 0
  const vtsReady = status.vts === 'green'
  const inputDisabled = banners.llm

  return (
    <div className="view">
      <div className="chat-scroll" ref={scrollRef}>
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
          chatMessages.map((m) => {
            const ts = new Date(m.id).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
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
        {sending && (
          <div className="bubble assistant">
            <div className="meta">
              <span className="semibold">Teto</span>
              <span>…</span>
            </div>
            <div className="body muted">…</div>
          </div>
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
        />
        <button
          className="send"
          onClick={onSend}
          disabled={!input.trim() || sending || inputDisabled}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
