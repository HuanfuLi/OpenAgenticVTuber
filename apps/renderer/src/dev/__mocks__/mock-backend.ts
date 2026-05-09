import type { StatusSnapshot } from '@/state/status-types'

// Mock backend — single source of mocked IPC/safeStorage/network. DEV-only.
//
// Ported from prototype src/lib/mock.js (2026-05-06).
//
// Plan 01-01 ships this for the design-review path (DevPanel triggers + chrome
// renders against mocked status/banners). Plan 01-02 will replace mockEcho
// with the real WS client and mockSafeStorage with window.api.{get,set}StoredValue.
//
// Production builds tree-shake this entire module via the
// `if (import.meta.env.DEV)` gate at the App.tsx + DevPanel mount points.

const LS_KEY = 'alvtuber_mock_safestorage_v1'

function load(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function save(data: Record<string, unknown>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export const mockSafeStorage = {
  get(key: string): unknown {
    return load()[key]
  },
  set(key: string, value: unknown): void {
    const d = load()
    d[key] = value
    save(d)
  },
  delete(key: string): void {
    const d = load()
    delete d[key]
    save(d)
  },
  clear(): void {
    localStorage.removeItem(LS_KEY)
  }
}

// ---------------- mockEcho ----------------
export function mockEcho(text: string, delayMs = 200): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(`echo: ${text}`), delayMs)
  })
}

// ---------------- mockStatus (observable) ----------------
export type { StatusOverall, StatusSnapshot, StatusValue } from '@/state/status-types'

const statusListeners = new Set<(s: StatusSnapshot) => void>()
const statusState: StatusSnapshot = {
  llm: 'amber',
  vts: 'amber',
  sidecar: 'green',
  llmDetail: 'qwen2.5-7b · LM Studio · last reply 423ms',
  vtsDetail: 'awaiting connection',
  sidecarDetail: 'ws://127.0.0.1:53811/ws'
}

function emitStatus(): void {
  for (const l of statusListeners) l({ ...statusState })
}

export const mockStatus = {
  get(): StatusSnapshot {
    return { ...statusState }
  },
  subscribe(fn: (s: StatusSnapshot) => void): () => void {
    statusListeners.add(fn)
    fn({ ...statusState })
    return () => {
      statusListeners.delete(fn)
    }
  },
  set(patch: Partial<StatusSnapshot>): void {
    Object.assign(statusState, patch)
    emitStatus()
  }
}

// ---------------- Banners / toasts ----------------
export interface Banners {
  llm: boolean
  vts: boolean
  vtsAuth: boolean
  sidecarRepeat: boolean
  tts: boolean
}

const bannerListeners = new Set<(b: Banners) => void>()
const banners: Banners = {
  llm: false,
  vts: false,
  vtsAuth: false,
  sidecarRepeat: false,
  tts: false
}

export const mockBanners = {
  subscribe(fn: (b: Banners) => void): () => void {
    bannerListeners.add(fn)
    fn({ ...banners })
    return () => {
      bannerListeners.delete(fn)
    }
  },
  set(patch: Partial<Banners>): void {
    Object.assign(banners, patch)
    for (const l of bannerListeners) l({ ...banners })
  }
}

// ---------------- Toasts ----------------
export interface Toast {
  id: string
  text: string
}

type ToastEvent = { kind: 'add'; id: string; text: string } | { kind: 'remove'; id: string }
const toastListeners = new Set<(evt: ToastEvent) => void>()

export const mockToasts = {
  subscribe(fn: (evt: ToastEvent) => void): () => void {
    toastListeners.add(fn)
    return () => {
      toastListeners.delete(fn)
    }
  },
  push(arg: string | { id?: string; text: string }, ms = 3000): string {
    const id =
      (typeof arg === 'object' && arg.id) ||
      Math.random().toString(36).slice(2)
    const text = typeof arg === 'string' ? arg : arg.text
    for (const l of toastListeners) l({ kind: 'add', id, text })
    setTimeout(() => {
      for (const l of toastListeners) l({ kind: 'remove', id })
    }, ms)
    return id
  },
  remove(id: string): void {
    for (const l of toastListeners) l({ kind: 'remove', id })
  }
}

// ---------------- Sidecar logs sample (dev-only when no real sidecar feed) ----------------
const SAMPLE_LOGS = [
  '[READY] sidecar ws://127.0.0.1:53811/ws',
  '[VTS] connected; rig=teto; injecting @60Hz',
  '[INTENT] expression="joy" weight=1.0 → fade 300ms',
  '[TTS] sentence 2/3 synth 312ms',
  '[LLM] stream chunk: "Curiosity sparkles in her eyes..."',
  '[VTS] HotkeyTriggerRequest hk=test_prop',
  '[INTENT] gaze x=0.12 y=-0.04 → smooth 120ms',
  '[SIDECAR] heartbeat ok (parent pid alive)'
]

export function startSidecarLogs(onLine: (line: string) => void): () => void {
  let i = 0
  let running = true
  const initialLines = [SAMPLE_LOGS[0]!, SAMPLE_LOGS[1]!, SAMPLE_LOGS[2]!]
  initialLines.forEach((l, idx) => setTimeout(() => running && onLine(l), 50 + idx * 60))
  function tick(): void {
    if (!running) return
    const line = SAMPLE_LOGS[i % SAMPLE_LOGS.length]!
    i = (i + 1) % SAMPLE_LOGS.length
    onLine(line)
    setTimeout(tick, 2000 + Math.random() * 3000)
  }
  setTimeout(tick, 2200)
  return () => {
    running = false
  }
}

// ---------------- Scripted echo conversation ----------------
export interface ScriptedMessage {
  role: 'user' | 'assistant'
  text: string
}

export const SCRIPTED_CONVO: ScriptedMessage[] = [
  { role: 'user', text: 'hello' },
  { role: 'assistant', text: 'echo: hello' },
  { role: 'user', text: 'how does this prototype work?' },
  { role: 'assistant', text: 'echo: how does this prototype work?' },
  { role: 'user', text: 'thanks Teto' }
]

// ---------------- Placeholder thread list (dev panel toggle) ----------------
export const PLACEHOLDER_THREADS: Record<string, Array<{ title: string }>> = {
  Today: [{ title: 'Cat story' }, { title: 'How to build a website' }],
  Yesterday: [{ title: 'Genshin daily routine' }, { title: 'Recipe brainstorm' }],
  Earlier: [
    { title: 'Onboarding' },
    { title: 'Naming a goldfish' },
    { title: 'First chat' }
  ]
}
