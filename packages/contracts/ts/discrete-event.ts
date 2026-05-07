// Hand-written mirror of packages/contracts/py/contracts/discrete_event.py.
// Codegen replaces this in Phase 5 (SC-02).
export interface DiscreteEvent {
  hotkey_id: string
  name: string
  triggered_at: number
}
