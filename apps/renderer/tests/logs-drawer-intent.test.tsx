/**
 * LogsDrawer [DISPATCH] prefix coloring -- Phase 7 dispatch logs.
 *
 * The LogsDrawer reads `logsDrawer.enabled` and `logsDrawer.open` from the
 * AppStoreProvider; on a fresh provider both default to false (drawer renders
 * nothing). The test below mounts the drawer + a tiny in-test "Opener" child
 * that calls setLogsDrawer({enabled: true, open: true}) on mount so the body
 * actually renders the lines we want to assert against.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, type RenderResult } from '@testing-library/react'
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

describe('LogsDrawer [DISPATCH] coloring', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        openLogFolder: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('renders [DISPATCH] prefix in --success color', () => {
    const line = '[DISPATCH] kind=action name=joy'
    renderDrawer([line])
    const greens = document.querySelectorAll('span[style*="--success"]')
    expect(greens.length).toBeGreaterThan(0)
    expect(greens[0]?.textContent).toBe('[DISPATCH]')
    // The remainder lives in a sibling span.
    const lineEl = document.querySelector('.line')
    expect(lineEl?.textContent).toContain('kind=action')
    expect(lineEl?.textContent).toContain('name=joy')
  })

  it('old [INTENT] lines render plain (no green span)', () => {
    renderDrawer(['[INTENT] kind=action name=joy'])
    const greens = document.querySelectorAll('span[style*="--success"]')
    expect(greens.length).toBe(0)
    const lineEl = document.querySelector('.line')
    expect(lineEl?.textContent).toBe('[INTENT] kind=action name=joy')
  })

  it('[STUB-TTS] lines render plain (UI-SPEC IP-5)', () => {
    renderDrawer(['[STUB-TTS] sentence_id=1 text="Hello world."'])
    const greens = document.querySelectorAll('span[style*="--success"]')
    expect(greens.length).toBe(0)
    const lineEl = document.querySelector('.line')
    expect(lineEl?.textContent).toContain('[STUB-TTS]')
  })

  it('mixed lines: DISPATCH colors green, others plain', () => {
    renderDrawer([
      '[INFO] LLM warmup complete.',
      '[DISPATCH] kind=action name=joy',
      '[STUB-TTS] sentence_id=1 text="Hi."'
    ])
    const greens = document.querySelectorAll('span[style*="--success"]')
    // Exactly one green span -- only the [DISPATCH] line.
    expect(greens.length).toBe(1)
    expect(greens[0]?.textContent).toBe('[DISPATCH]')
  })

  it('opens the log folder through the Electron bridge', () => {
    renderDrawer(['[READY] sidecar ws://127.0.0.1:54321/ws'])

    fireEvent.click(screen.getByRole('button', { name: /Open log folder/i }))

    expect(window.api.openLogFolder).toHaveBeenCalledTimes(1)
  })
})
