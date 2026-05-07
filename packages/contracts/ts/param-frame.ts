// Hand-written mirror of packages/contracts/py/contracts/param_frame.py.
// Codegen replaces this in Phase 5 (SC-02).
export type ParamMode = 'add' | 'set'

export interface ParamFrame {
  add_params: Record<string, number>
  set_params: Record<string, [number, number]>
  tick_n: number
  emitted_at_monotonic: number
}
