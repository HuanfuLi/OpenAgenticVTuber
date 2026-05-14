import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { VoiceInputReadiness, VoiceInputTranscriptionResult } from '@contracts/audio-provider'
import type { ConversationSession } from '@preload-types'

const sendMock = vi.hoisted(() => vi.fn(() => true))
const captureStartMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureStopMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureCancelMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureDisposeMock = vi.hoisted(() => vi.fn())
const vadStartMock = vi.hoisted(() => vi.fn(async () => undefined))
const vadStopMock = vi.hoisted(() => vi.fn(async () => undefined))
const captureOptionsMock = vi.hoisted(() => ({ latest: null as unknown }))
const vadOptionsMock = vi.hoisted(() => ({ latest: null as unknown }))
const vadDepsMock = vi.hoisted(() => ({
  latest: null as {
    onMonitoringChange?: (monitoring: boolean) => void
    onLevel?: (diagnostics: {
      level: number
      threshold: number
      sensitivity: 'low' | 'medium' | 'high'
      speechDetected: boolean
      monitoring: boolean
      recording: boolean
      ignoredReason: 'turn_in_progress' | null
    }) => void
  } | null
}))

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
  playAudioPayload: vi.fn(),
  stopAudioPlayback: vi.fn(),
  getAudioPlaybackState: vi.fn(() => ({ active: false })),
  subscribeAudioPlaybackState: vi.fn((listener: (state: { active: boolean }) => void) => {
    listener({ active: false })
    return () => undefined
  })
}))

vi.mock('@/audio/voice-capture', () => ({
  VoiceCapture: vi.fn(function VoiceCaptureMock(options: unknown) {
    captureOptionsMock.latest = options
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

vi.mock('@/audio/vad-controller', () => ({
  VadController: vi.fn(function VadControllerMock(
    options: unknown,
    deps: NonNullable<typeof vadDepsMock.latest>
  ) {
    vadOptionsMock.latest = options
    vadDepsMock.latest = deps
    return {
      start: vi.fn(async () => {
        await vadStartMock()
        deps.onMonitoringChange?.(true)
      }),
      stop: vi.fn(async () => {
        await vadStopMock()
        deps.onMonitoringChange?.(false)
      })
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
  resetVoiceInputStoreForTests
} from '@/state/voice-input-store'
import { saveVoiceInputSettings } from '@/state/audio-settings'
import {
  appendUserMessage as appendStreamingUserMessage,
  appendAssistantSentence,
  beginTurnSettlement,
  finishTurnSettlement,
  _internalState,
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
      invalidation_reason: 'ready'
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
      truncateConversationBeforeMessage: vi.fn().mockResolvedValue(session),
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
    vadStartMock.mockClear()
    vadStopMock.mockClear()
    captureOptionsMock.latest = null
    vadOptionsMock.latest = null
    vadDepsMock.latest = null
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

  it('passes the selected microphone source into PTT and VAD capture', async () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Shift+Space',
      microphone: {
        deviceId: 'mic-usb',
        label: 'USB Microphone',
        suspectedSystemAudio: false
      },
      noHeadphones: { status: 'ready', unsafeOverride: false },
      vad: { enabled: true, sensitivity: 'low', silenceTimeoutMs: 1800 }
    })
    renderChat()
    await waitFor(() => expect(vadStartMock).toHaveBeenCalledTimes(1))
    const mic = await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })

    fireEvent.pointerDown(mic)
    await waitFor(() => expect(captureStartMock).toHaveBeenCalledTimes(1))

    expect(captureOptionsMock.latest).toMatchObject({
      microphone: {
        deviceId: 'mic-usb',
        label: 'USB Microphone',
        suspectedSystemAudio: false
      }
    })
    expect(vadOptionsMock.latest).toMatchObject({
      microphone: {
        deviceId: 'mic-usb',
        label: 'USB Microphone',
        suspectedSystemAudio: false
      }
    })
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

  it('keeps VAD disabled by default in Chat', async () => {
    renderChat()
    await screen.findByText('Hello.')

    expect(vadStartMock).not.toHaveBeenCalled()
    expect(screen.queryByText(COPY.SETTINGS.VOICE_IN_INPUT_VAD)).toBeNull()
  })

  it('starts VAD monitoring only after settings opt-in and readiness are ready', async () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Shift+Space',
      noHeadphones: { status: 'ready', unsafeOverride: false },
      vad: { enabled: true, sensitivity: 'low', silenceTimeoutMs: 1800 }
    })
    installApi(sessionWithHistory(), readiness({
      ready: false,
      permission_state: 'prompt',
      capture_status: 'permission_needed',
      blocked_reason: 'permission_needed',
      setup_destination: 'microphone_permission',
      summary: 'Microphone permission is needed.'
    }))
    renderChat()

    await screen.findByText('Microphone permission is needed.')
    expect(vadStartMock).not.toHaveBeenCalled()
  })

  it('shows VAD state after explicit opt-in and readiness pass', async () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Shift+Space',
      noHeadphones: { status: 'ready', unsafeOverride: false },
      vad: { enabled: true, sensitivity: 'low', silenceTimeoutMs: 1800 }
    })
    renderChat()

    await waitFor(() => expect(vadStartMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(COPY.CHAT.VOICE_VAD_ACTIVE)).toBeInTheDocument()
    expect(screen.getByText(COPY.SETTINGS.VOICE_IN_INPUT_VAD)).toBeInTheDocument()
    expect(screen.getByTestId('voice-vad-meter')).toHaveTextContent(COPY.CHAT.VOICE_VAD_STARTING)
  })

  it('shows live VAD level and speech detection feedback', async () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Shift+Space',
      noHeadphones: { status: 'ready', unsafeOverride: false },
      vad: { enabled: true, sensitivity: 'low', silenceTimeoutMs: 1800 }
    })
    renderChat()

    await waitFor(() => expect(vadStartMock).toHaveBeenCalledTimes(1))
    act(() => {
      vadDepsMock.latest?.onLevel?.({
        level: 0.01,
        threshold: 0.035,
        sensitivity: 'low',
        speechDetected: false,
        monitoring: true,
        recording: false,
        ignoredReason: null
      })
    })

    const meter = await screen.findByTestId('voice-vad-meter')
    expect(meter).toHaveTextContent(COPY.CHAT.VOICE_VAD_BELOW_THRESHOLD)
    expect(within(meter).getByRole('meter', { name: COPY.CHAT.VOICE_VAD_LEVEL }))
      .toHaveAttribute('aria-valuenow', '29')

    act(() => {
      vadDepsMock.latest?.onLevel?.({
        level: 0.04,
        threshold: 0.035,
        sensitivity: 'low',
        speechDetected: true,
        monitoring: true,
        recording: false,
        ignoredReason: null
      })
    })

    expect(meter).toHaveTextContent(COPY.CHAT.VOICE_VAD_DETECTED)
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

  it('hides recoverable sidecar startup readiness, then enables PTT after sidecar-ready', async () => {
    const unavailable = readiness({
      ready: false,
      permission_state: 'unknown',
      capture_status: 'idle',
      blocked_reason: 'sidecar_unavailable',
      setup_destination: 'voice_settings',
      summary: 'Voice input readiness unavailable: sidecar request failed.'
    })
    const sidecarReadyHandlers: Array<(url: string) => void> = []
    installApi(sessionWithHistory(), unavailable)
    vi.mocked(window.api.getVoiceInputReadiness)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValue(readiness({ summary: 'Voice input is ready.' }))
    vi.mocked(window.api.onSidecarReady).mockImplementation((cb: (url: string) => void) => {
      sidecarReadyHandlers.push(cb)
      return () => undefined
    })

    renderChat()

    const mic = await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })
    expect(mic).toBeDisabled()
    expect(screen.queryByText('Voice input readiness unavailable: sidecar request failed.')).toBeNull()

    await waitFor(() => expect(sidecarReadyHandlers.length).toBeGreaterThan(1))
    act(() => {
      sidecarReadyHandlers.forEach((handler) => handler('ws://127.0.0.1:54321/ws'))
    })

    await waitFor(() => expect(window.api.getVoiceInputReadiness).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getVoiceInputState().readiness?.ready).toBe(true))
    await waitFor(() => expect(mic).not.toBeDisabled())
    expect(screen.queryByText('Voice input readiness unavailable: sidecar request failed.')).toBeNull()
  })

  it('keeps retrying recoverable sidecar startup readiness when no ready event arrives', async () => {
    const unavailable = readiness({
      ready: false,
      permission_state: 'unknown',
      capture_status: 'idle',
      blocked_reason: 'sidecar_unavailable',
      setup_destination: 'voice_settings',
      summary: 'Voice input readiness unavailable: sidecar request failed.'
    })
    installApi(sessionWithHistory(), unavailable)
    vi.mocked(window.api.getVoiceInputReadiness)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValue(readiness({ summary: 'Voice input is ready.' }))

    renderChat()

    const mic = await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })
    expect(mic).toBeDisabled()
    expect(screen.queryByText('Voice input readiness unavailable: sidecar request failed.')).toBeNull()

    await waitFor(() => expect(window.api.getVoiceInputReadiness).toHaveBeenCalledTimes(3), { timeout: 3_000 })
    await waitFor(() => expect(mic).not.toBeDisabled())
  })

  it('shows voice readiness HTTP failures as real errors instead of waiting for sidecar', async () => {
    installApi(sessionWithHistory(), readiness({
      ready: false,
      permission_state: 'granted',
      capture_status: 'idle',
      blocked_reason: 'unexpected_failure',
      setup_destination: 'voice_settings',
      summary: 'Voice input readiness failed: HTTP 422.'
    }))

    renderChat()

    const mic = await screen.findByRole('button', { name: COPY.CHAT.VOICE_MIC })
    expect(mic).toBeDisabled()
    expect(await screen.findByText('Voice input readiness failed: HTTP 422.')).toBeInTheDocument()
    expect(screen.queryByText('Voice input is waiting for the sidecar.')).toBeNull()
  })

  it('does not render preview transcription while recording', async () => {
    renderChat()

    expect(screen.queryByTestId('voice-preview')).toBeNull()
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

  it('submits mixed Chinese and English final text unchanged without preview bubbles', async () => {
    renderChat()
    await screen.findByText('Hello.')

    act(() => {
      applyFinalResult(finalResult('请把 brightness 调到 fifty percent', 'voice-final-code-switch'))
    })

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'text-input',
        text: '请把 brightness 调到 fifty percent',
        session_id: 's1'
      }))
    })
    expect(screen.queryByTestId('voice-preview')).toBeNull()
    expect(screen.queryByText('Finalizing')).toBeNull()
    expect(screen.getByText('请把 brightness 调到 fifty percent')).toBeInTheDocument()
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

  it('waits for the previous turn to settle before dispatching queued voice', async () => {
    renderChat()
    await screen.findByText('Hello.')

    let firstUserMessageId = ''
    act(() => {
      appendStreamingUserMessage('first voice question', 's1')
      appendAssistantSentence('first voice answer', 1)
      firstUserMessageId = _internalState().pendingTurn!.userMessageId
      beginTurnSettlement(firstUserMessageId)
      setInputDisabled(false)
      setSpeaking(false)
      applyFinalResult(finalResult('second voice question', 'voice-final-2'), true)
    })

    expect(await screen.findByTestId('voice-queued')).toHaveTextContent('second voice question')
    expect(sendMock).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'text-input',
      text: 'second voice question'
    }))

    act(() => {
      finishTurnSettlement(firstUserMessageId)
    })

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'text-input',
        text: 'second voice question',
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

  it('shows that VAD waits while Teto is speaking', async () => {
    saveVoiceInputSettings({
      pttShortcut: 'Ctrl+Shift+Space',
      noHeadphones: { status: 'ready', unsafeOverride: false },
      vad: { enabled: true, sensitivity: 'low', silenceTimeoutMs: 1800 }
    })
    renderChat()

    act(() => {
      setSpeaking(true)
    })

    expect(await screen.findByTestId('voice-vad-blocked')).toHaveTextContent(COPY.CHAT.VOICE_VAD_BLOCKED)
    expect(screen.getByTestId('speaking-label')).toHaveTextContent(COPY.CHAT.SPEAKING)
    expect(screen.queryByTestId('voice-vad-meter')).toBeNull()
  })
})
