/* PLUMB-04 — Verbose multi-line streaming test log.
 *
 * The renderer-side consumer of /admin/llm-test (POST, text/plain chunked
 * transfer). Reads the response with body.getReader() + TextDecoder and
 * renders one CSS-classed line per yielded chunk.
 *
 * Per 01-PROTOTYPE-DELTA.md the TestLog is conceptually "inline JSX inside
 * LLMSetup". This file extracts that JSX into a standalone component so the
 * pattern is reusable (Settings §1 "Re-test" will lift this in a later
 * milestone) without changing the user-visible behavior. LLMSetup mounts a
 * fresh <TestLog> on each test press by bumping a `key` prop, which clears
 * the line buffer (RESEARCH.md Open Q #4).
 *
 * Color tagging via the prototype's `.test-log .line.{kind}` CSS classes
 * (already in index.css):
 *   info    -> default text  (▸ progress lines)
 *   error   -> destructive   (✕ failure lines)
 *   ok      -> success green (✓ Received N tokens in X ms)
 *   ok-bold -> foreground bold (the SUCCESS_SENTINEL)
 *   muted   -> muted-foreground (blank lines + helper guidance)
 *
 * Sidecar SSE wire format (matches mockTestConnection async-generator
 * contract from prototype src/lib/mock.js lines 35-86):
 *   text/plain chunked transfer, one log line per chunk, terminated by '\n'.
 *   The SUCCESS_SENTINEL "Connection looks good. You can continue." flips
 *   the parent's phase to 'success'.
 *
 * The test-log scroll region uses `font-mono text-xs leading-normal` via
 * the `.test-log` CSS class (UI-SPEC §Typography mono variant); accessibility
 * uses role="log" + aria-live="polite".
 */

import { useEffect, useRef, useState } from 'react'
import { COPY } from '@/lib/copy'
import type { Provider } from '@/state/setup-store'

export type LineKind = 'info' | 'error' | 'muted' | 'ok' | 'ok-bold'

export interface LogLine {
  kind: LineKind
  text: string
}

export interface TestLogForm {
  provider: Provider
  endpointUrl: string
  apiKey: string
  modelName: string
}

const SUCCESS_SENTINEL = COPY.LLM_SETUP.SUCCESS_FINAL

function classify(line: string): LineKind {
  if (!line) return 'muted'
  if (line.startsWith('▸')) return 'info'
  if (line.startsWith('✕')) return 'error'
  if (line.startsWith('✓')) return 'ok'
  if (line.includes(SUCCESS_SENTINEL)) return 'ok-bold'
  return 'muted'
}

async function resolveAdminUrl(): Promise<string | null> {
  const ws = await window.api.getReadyUrl()
  if (!ws) return null
  // ws://127.0.0.1:<port>/ws -> http://127.0.0.1:<port>/admin/llm-test
  return ws.replace(/^ws/, 'http').replace(/\/ws$/, '') + '/admin/llm-test'
}

interface Props {
  form: TestLogForm
  onResult: (success: boolean, errorKind: 'unreachable' | null) => void
}

export function TestLog({ form, onResult }: Props) {
  const [lines, setLines] = useState<LogLine[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    let cancelled = false

    async function run(): Promise<void> {
      const url = await resolveAdminUrl()
      if (!url) {
        if (cancelled) return
        setLines([
          { kind: 'error', text: '✕ Sidecar is not ready yet.' },
          { kind: 'muted', text: 'Wait a moment and Test connection again.' }
        ])
        onResultRef.current(false, null)
        return
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: form.provider,
            endpoint_url: form.endpointUrl,
            api_key: form.apiKey,
            model_name: form.modelName
          })
        })
        if (!res.body) {
          if (cancelled) return
          setLines((prev) => [...prev, { kind: 'error', text: '✕ Empty response from sidecar.' }])
          onResultRef.current(false, null)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let sawSuccess = false
        let sawRefused = false

        while (true) {
          if (cancelled) {
            reader.cancel().catch(() => {})
            return
          }
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const newlineIdx = buffer.lastIndexOf('\n')
          if (newlineIdx === -1) continue
          const ready = buffer.slice(0, newlineIdx)
          buffer = buffer.slice(newlineIdx + 1)
          const newLines = ready.split('\n').map<LogLine>((text) => ({
            kind: classify(text),
            text
          }))
          setLines((prev) => [...prev, ...newLines])
          for (const ln of newLines) {
            if (ln.text.includes(SUCCESS_SENTINEL)) sawSuccess = true
            if (
              ln.text.includes("doesn't seem to be running") ||
              ln.text.includes('Connection refused')
            ) {
              sawRefused = true
            }
          }
        }
        if (buffer) {
          if (cancelled) return
          setLines((prev) => [...prev, { kind: classify(buffer), text: buffer }])
          if (buffer.includes(SUCCESS_SENTINEL)) sawSuccess = true
        }

        if (!cancelled) {
          onResultRef.current(sawSuccess, sawRefused ? 'unreachable' : null)
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setLines((prev) => [...prev, { kind: 'error', text: `✕ Test failed: ${msg}` }])
        onResultRef.current(false, null)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [form.provider, form.endpointUrl, form.apiKey, form.modelName])

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines.length])

  return (
    <div
      className="test-log"
      ref={scrollRef}
      role="log"
      aria-live="polite"
    >
      <div className="title font-mono text-xs">{COPY.SETUP.LOG_TITLE}</div>
      {lines.length === 0 ? (
        <div className="line muted">▸ Starting test...</div>
      ) : (
        lines.map((l, i) => (
          <div key={i} className={`line ${l.kind}`}>
            {l.text || ' ' /* preserve blank lines */}
          </div>
        ))
      )}
    </div>
  )
}
