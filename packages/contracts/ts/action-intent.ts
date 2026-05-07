// Hand-written mirror of packages/contracts/py/contracts/action_intent.py.
// Codegen replaces this in Phase 5 (SC-02).
export interface ActionIntent {
  kind: 'expression' | 'action' | 'reaction'
  name: string
  strength: number
  duration_ms: number | null
  avatar_id: string
}
