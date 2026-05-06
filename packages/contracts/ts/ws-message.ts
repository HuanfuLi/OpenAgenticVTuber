// Hand-written mirror of packages/contracts/py/ws_message.py.
// Codegen replaces this in Phase 5 (SC-02). Pydantic is source-of-truth.
// Match Pydantic discriminator field exactly: `type`.

export interface TextInputMessage {
  type: 'text-input'
  text: string
}

export interface DisplayTextMessage {
  type: 'display-text'
  text: string
}

export interface ShutdownMessage {
  type: 'shutdown'
}

export type WSMessage = TextInputMessage | DisplayTextMessage | ShutdownMessage

// Type guards (match by string literal — same shape Pydantic discriminator uses)
export const isTextInput = (m: WSMessage): m is TextInputMessage => m.type === 'text-input'
export const isDisplayText = (m: WSMessage): m is DisplayTextMessage =>
  m.type === 'display-text'
export const isShutdown = (m: WSMessage): m is ShutdownMessage => m.type === 'shutdown'
