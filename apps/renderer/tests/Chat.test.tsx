import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('@/ws/client', () => ({
  send: () => true
}))

vi.mock('@/ws/store', () => ({
  appendUserMessage: () => undefined,
  useWSConnected: () => true
}))

import { AppStoreProvider } from '@/state/app-store'
import { COPY } from '@/lib/copy'
import { Chat } from '@/screens/Chat/Chat'
import {
  resetStreaming,
  setInputDisabled,
  setSpeaking
} from '@/screens/Chat/useStreamingMessages'


describe('Chat speaking affordance', () => {
  beforeEach(() => {
    resetStreaming()
  })

  function renderChat() {
    return render(
      <AppStoreProvider>
        <Chat />
      </AppStoreProvider>
    )
  }

  it('hides the speaking label initially', () => {
    renderChat()
    expect(screen.queryByTestId('speaking-label')).toBeNull()
  })

  it('shows the speaking label on speaking state', () => {
    renderChat()
    act(() => {
      setSpeaking(true)
    })
    expect(screen.getByTestId('speaking-label')).toHaveTextContent(COPY.CHAT.SPEAKING)
  })

  it('clears the speaking label when speaking ends', () => {
    renderChat()
    act(() => {
      setSpeaking(true)
    })
    expect(screen.getByTestId('speaking-label')).toBeInTheDocument()

    act(() => {
      setSpeaking(false)
    })
    expect(screen.queryByTestId('speaking-label')).toBeNull()
  })

  it('keeps the input disabled while speaking', () => {
    renderChat()
    act(() => {
      setInputDisabled(true)
      setSpeaking(true)
    })

    expect(screen.getByLabelText('Chat input')).toBeDisabled()
    expect(screen.getByLabelText('Send')).toBeDisabled()
    expect(screen.getByTestId('speaking-label')).toHaveTextContent(COPY.CHAT.SPEAKING)
  })
})
