// Renderer-side observable: turn incoming WS messages into chat bubbles.
//
// Plan 01-02: only display-text messages produce assistant bubbles. The
// existing app-store keeps its own chatMessages slice for the prototype-ported
// ChatView. We bridge to it by exposing appendUserMessage / appendAssistantMessage
// helpers that the Chat surface calls directly. This avoids forking the store.

import { useEffect, useState } from 'react'
import { subscribe, subscribeState } from './client'
import type { WSMessage, DisplayTextMessage } from '@contracts/ws-message'

export interface ChatBubble {
  id: string
  role: 'user' | 'assistant'
  text: string
}

let bubbles: ChatBubble[] = []
const bubbleSubs = new Set<(b: ChatBubble[]) => void>()

function pushBubble(b: ChatBubble): void {
  bubbles = [...bubbles, b]
  for (const cb of bubbleSubs) cb(bubbles)
}

// Convert incoming display-text WS messages into assistant bubbles.
subscribe((msg: WSMessage) => {
  if (msg.type === 'display-text') {
    const dt = msg as DisplayTextMessage
    pushBubble({ id: crypto.randomUUID(), role: 'assistant', text: dt.text })
  }
})

export function appendUserMessage(text: string): void {
  pushBubble({ id: crypto.randomUUID(), role: 'user', text })
}

export function useChatBubbles(): ChatBubble[] {
  const [b, setB] = useState(bubbles)
  useEffect(() => {
    const cb = (next: ChatBubble[]) => setB(next)
    bubbleSubs.add(cb)
    return () => {
      bubbleSubs.delete(cb)
    }
  }, [])
  return b
}

export function useWSConnected(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => subscribeState(setOpen), [])
  return open
}
