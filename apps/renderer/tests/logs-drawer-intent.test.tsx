/**
 * LogsDrawer [INTENT] prefix coloring -- UI-SPEC IP-4 (plan 02-03).
 *
 * The LogsDrawer reads `logsDrawer.enabled` and `logsDrawer.open` from the
 * AppStoreProvider; on a fresh provider both default to false (drawer renders
 * nothing). The test below mounts the drawer + a tiny in-test "Opener" child
 * that calls setLogsDrawer({enabled: true, open: true}) on mount so the body
 * actually renders the lines we want to assert against.
 */
import { describe, it, expect } from 'vitest'
import { render, type RenderResult } from '@testing-library/react'
import { useEffect } from 'react'
import { LogsDrawer } from '@/chrome/LogsDrawer'
import { AppStoreProvider, useStore } from '@/state/app-store'

function Opener() {
  const { setLogsDrawer } = useStore()
  useEffect(() => {
    setLogsDrawer({ enabled: true, open: true })
  }, [setLogsDrawer])
  return null
}

function renderDrawer(logLines: string[]): RenderResult {
  return render(
    <AppStoreProvider>
      <Opener />
      <LogsDrawer logLines={logLines} />
    </AppStoreProvider>
  )
}

describe('LogsDrawer [INTENT] coloring (UI-SPEC IP-4)', () => {
  it('renders [INTENT] prefix in --success color', () => {
    const line = '[INTENT] kind=expression name=joy strength=1.0 avatar=teto'
    renderDrawer([line])
    const greens = document.querySelectorAll('span[style*="--success"]')
    expect(greens.length).toBeGreaterThan(0)
    expect(greens[0]?.textContent).toBe('[INTENT]')
    // The remainder lives in a sibling span.
    const lineEl = document.querySelector('.line')
    expect(lineEl?.textContent).toContain('kind=expression')
    expect(lineEl?.textContent).toContain('name=joy')
  })

  it('non-INTENT lines render plain (no green span)', () => {
    renderDrawer(['[INFO] LLM warmup complete.'])
    const greens = document.querySelectorAll('span[style*="--success"]')
    expect(greens.length).toBe(0)
    const lineEl = document.querySelector('.line')
    expect(lineEl?.textContent).toBe('[INFO] LLM warmup complete.')
  })

  it('[STUB-TTS] lines render plain (UI-SPEC IP-5)', () => {
    renderDrawer(['[STUB-TTS] sentence_id=1 text="Hello world."'])
    const greens = document.querySelectorAll('span[style*="--success"]')
    expect(greens.length).toBe(0)
    const lineEl = document.querySelector('.line')
    expect(lineEl?.textContent).toContain('[STUB-TTS]')
  })

  it('mixed lines: INTENT colors green, others plain', () => {
    renderDrawer([
      '[INFO] LLM warmup complete.',
      '[INTENT] kind=expression name=joy strength=1.0 avatar=teto',
      '[STUB-TTS] sentence_id=1 text="Hi."'
    ])
    const greens = document.querySelectorAll('span[style*="--success"]')
    // Exactly one green span -- only the [INTENT] line.
    expect(greens.length).toBe(1)
    expect(greens[0]?.textContent).toBe('[INTENT]')
  })
})
