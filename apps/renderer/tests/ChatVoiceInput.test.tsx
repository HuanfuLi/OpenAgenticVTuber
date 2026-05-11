import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { VoiceInputReadiness, VoiceInputTranscriptionResult } from '@contracts/audio-provider'
import type { ConversationSession } from '@preload-types'

const sendMock = vi.hoisted(() => vi.fn(() => true))
const captureStartMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureStopMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureCancelMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureDisposeMock = vi.hoisted(() => vi.fn())

vi.mock('@/ws/client', () => ({
  send: sendMock,
  subscribe: vi.fn(() => () => undefined),
  subscribeSidecarReconnect: vi.fn(() => () => undefined),
  subscribeState: vi.fn((listener: (open: boolean) => void) => {
    listener(true)
    return () => undefined
  })
}))

vi.mock('@/ws/audio-player', () => ({
  playAudioPayload: vi.fn()
}))

vi.mock('@/audio/voice-capture', () => ({
  VoiceCapture: vi.fn(function VoiceCaptureMock() {
    return {
      get active() {
        return true
      },
      start: captureStartMock,
      stop: captureStopMock,
      cancel: captureCancelMock,
      dispose: captureDisposeMock
    }
  })
}))

vi.mock('@/state/conversation-history', async () => {
  const actual = await vi.importActual<typeof import('@/state/conversation-history')>('@/state/conversation-history')
  return {
    ...actual,
    commitConversationTurnFromDispatcher: vi.fn()
  }
})

import { AppStoreProvider } from '@/state/app-store'
import { COPY } from '@/lib/copy'
import { Chat } from '@/screens/Chat/Chat'
import {
  applyFinalResult,
  getVoiceInputState,
  resetVoiceInputStoreForTests,
  setTransientPreview
} from '@/state/voice-input-store'
import { saveVoiceInputSettings } from '@/state/audio-settings'
import {
  appendAssistantSentence,
  resetStreaming,
  setInputDisabled,
  setSpeaking
} from '@/screens/Chat/useStreamingMessages'
import { commitConversationTurnFromDispatcher } from '@/state/conversation-history'

function readiness(patch: Partial<VoiceInputReadiness> = {}): VoiceInputReadiness {
  return {
    ready: true,
    stt_enabled: true,
    provider_id: 'funasr',
    readiness: {
      health_check_passed: true,
      test_transcription_passed: true,
      last_health_checked_at: null,
      last_test_transcription_at: null,
      fingerprint: 'ready',
      active_allowed: true,
      invalidation_reason: 'never_tested'
    },
    permission_state: 'granted',
    capture_status: 'idle',
    blocked_reason: null,
    setup_destination: null,
    summary: 'Ready.',
    ...patch
  }
}

function finalResult(transcript: string, sequenceId = 'voice-final-1'): VoiceInputTranscriptionResult {
  return {
    ok: true,
    mode: 'final',
    sequence_id: sequenceId,
    transcript,
    is_final: true,
    provider_id: 'funasr',
    duration_ms: 900,
    latency_ms: 12,
    readiness: null,
    summary: 'ok',
    failure: null,
    redacted_diagnostics: null
  }
}

function sessionWithHistory(): ConversationSession {
  return {
    id: 's1',
    title: 'Persisted session',
    titleSource: 'manual',
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:01:00.000Z',
    lastMessageAt: '2026-05-09T12:01:00.000Z',
    messages: [
      {
        id: 'm1',
        role: 'user',
        text: '你好',
        createdAt: '2026-05-09T12:00:00.000Z'
      },
      {
        id: 'm2',
        role: 'assistant',
        text: 'Hello.',
        createdAt: '2026-05-09T12:01:00.000Z'
      }
    ]
  }
}

function installApi(session = sessionWithHistory(), voiceReadiness = readiness()): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      getStoredConfig: vi.fn().mockResolvedValue(null),
      getReadyUrl: vi.fn().mockResolvedValue('ws://127.0.0.1:54321/ws'),
      getVtsStatus: vi.fn().mockResolvedValue({
        state: 'authenticated',
        detail: 'VTS authenticated.',
        authenticated: true,
        windowDetected: true
      }),
      getChromeState: vi.fn().mockResolvedValue({
        logsDrawerEnabled: false,
        logsDrawerHeight: 200,
        logsDrawerCollapsed: true
      }),
      saveChromeState: vi.fn().mockResolvedValue({}),
      onSidecarReady: vi.fn().mockReturnValue(() => undefined),
      onSidecarCrash: vi.fn().mockReturnValue(() => undefined),
      listConversationSessions: vi.fn().mockResolvedValue([
        {
          id: session.id,
          title: session.title,
          titleSource: session.titleSource,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastMessageAt: session.lastMessageAt,
          messageCount: session.messages.length,
          preview: session.messages.at(-1)?.text ?? ''
        }
      ]),
      getActiveConversationSession: vi.fn().mockResolvedValue(session),
      getConversationStats: vi.fn().mockResolvedValue({
        sessionCount: 1,
        messageCount: session.messages.length,
        activeSessionId: session.id,
        persistence: 'local'
      }),
      openVtsDocs: vi.fn().mockResolvedValue(undefined),
      restartSidecar: vi.fn().mockResolvedValue(undefined),
      getVoiceInputReadiness: vi.fn().mockResolvedValue(voiceReadiness),
      requestMicrophonePermission: vi.fn().mockResolvedValue('granted')
    }
  })
}

function renderChat() {
  return render(
    <AppStoreProvider>
      <Chat />
    </AppStoreProvider>
  )
}

describe('Chat voice input', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = ''
    sendMock.mockClear()
    captureStartMock.mockClear()
    captureStopMock.mockClear()
    captureCancelMock.mockClear()
    captureDisposeMock.mockClear()
    resetStreaming()
    resetVoiceInputStoreForTests()
    vi.mocked(commitConversationTurnFromDispatcher).mockClear()
    installApi()
  })

  it('keeps the mic visible but disabled when STT is not ready', async () => {
    installApi(sessionWithHistory(), readiness({
      ready: false,
      stt_enabled: false,
      permission_state: 'unknown',
      capture_status: 'idle',
      blocked_reason: 'stt_disabled',
      setup_destination: 'voice_settings',
      summary: 'Enable STT first.'
    }))

    renderChat()

    expect(await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })).toBeDisabled()
    expect(screen.getByText('Enable STT first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.CHAT.VOICE_SETUP })).toBeInTheDocument()
  })

  it('routes setup action to Settings voice input', async () => {
    installApi(sessionWithHistory(), readiness({
      ready: false,
      setup_destination: 'voice_settings',
      summary: 'Set up voice input.'
    }))
    renderChat()

    fireEvent.click(await screen.findByRole('button', { name: COPY.CHAT.VOICE_SETUP }))

    expect(window.location.hash).toBe('#sec-voice-in')
  })

  it('hold-to-talk starts and stops voice capture', async () => {
    renderChat()
    await screen.findByText('Hello.')
    const mic = await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })

    fireEvent.pointerDown(mic)
    await waitFor(() => expect(captureStartMock).toHaveBeenCalledTimes(1))

    fireEvent.pointerUp(mic)
    await waitFor(() => expect(captureStopMock).toHaveBeenCalledTimes(1))
  })

  it('uses the configured PTT shortcut for keyboard capture', async () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Alt+M',
      vad: { enabled: false, sensitivity: 'medium', silenceTimeoutMs: 1200 }
    })
    renderChat()
    await screen.findByText('Hello.')
    await screen.findByTitle('PTT (Ctrl+Alt+M)')

    fireEvent.keyDown(window, { key: 'm', ctrlKey: true, altKey: true })
    await waitFor(() => expect(captureStartMock).toHaveBeenCalledTimes(1))

    fireEvent.keyUp(window, { key: 'm', ctrlKey: true, altKey: true })
    await waitFor(() => expect(captureStopMock).toHaveBeenCalledTimes(1))
  })

  it('requests microphone permission on first use when the preload bridge reports prompt state', async () => {
    const promptReadiness = readiness({
      ready: false,
      permission_state: 'prompt',
      capture_status: 'permission_needed',
      blocked_reason: 'permission_needed',
      setup_destination: 'microphone_permission',
      summary: 'Microphone permission is needed.'
    })
    installApi(sessionWithHistory(), promptReadiness)
    vi.mocked(window.api.getVoiceInputReadiness)
      .mockResolvedValueOnce(promptReadiness)
      .mockResolvedValueOnce(readiness())

    renderChat()
    const mic = await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })

    fireEvent.pointerDown(mic)

    await waitFor(() => {
      expect(window.api.requestMicrophonePermission).toHaveBeenCalledTimes(1)
      expect(captureStartMock).toHaveBeenCalledTimes(1)
    })
  })

  it('renders preview outside chat bubbles and never commits it to history', async () => {
    renderChat()

    act(() => {
      setTransientPreview('preview-1', 'transient preview only')
    })

    const preview = await screen.findByTestId('voice-preview')
    expect(preview).toHaveTextContent('transient preview only')
    expect(preview.closest('.bubble')).toBeNull()
    expect(commitConversationTurnFromDispatcher).not.toHaveBeenCalled()
  })

  it('sends final transcript through the typed text-input envelope with session history', async () => {
    renderChat()
    await screen.findByText('Hello.')

    act(() => {
      applyFinalResult(finalResult('你好 Teto, keep this English phrase unchanged.'))
    })

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({
        type: 'text-input',
        text: '你好 Teto, keep this English phrase unchanged.',
        session_id: 's1',
        history: [
          { role: 'user', text: '你好' },
          { role: 'assistant', text: 'Hello.' }
        ]
      })
    })
  })

  it('queues final transcript during an active turn and sends after the turn ends', async () => {
    renderChat()
    await screen.findByText('Hello.')

    act(() => {
      setInputDisabled(true)
      setSpeaking(true)
      applyFinalResult(finalResult('queued voice text'), true)
    })

    expect(await screen.findByTestId('voice-queued')).toHaveTextContent('queued voice text')
    expect(sendMock).not.toHaveBeenCalled()

    act(() => {
      setSpeaking(false)
      setInputDisabled(false)
    })

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'text-input',
        text: 'queued voice text',
        session_id: 's1'
      }))
    })
  })

  it('cancels queued transcript without touching active playback state', async () => {
    renderChat()

    act(() => {
      setSpeaking(true)
      applyFinalResult(finalResult('cancel me'), true)
      appendAssistantSentence('Active speech continues.', 1)
    })

    const queued = await screen.findByTestId('voice-queued')
    fireEvent.click(within(queued).getByRole('button', { name: COPY.CHAT.VOICE_QUEUED_CANCEL }))

    expect(getVoiceInputState().queuedFinalCandidate).toBeNull()
    expect(screen.getByTestId('speaking-label')).toHaveTextContent(COPY.CHAT.SPEAKING)
    expect(screen.getByText('Active speech continues.')).toBeInTheDocument()
    expect(sendMock).not.toHaveBeenCalled()
  })
})
