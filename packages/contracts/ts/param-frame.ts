// GENERATED FROM packages/contracts/py/contracts/param_frame.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

export type ParamMode = 'add' | 'set';

/**
 * One tick's worth of merged param values bound for VTS.
 */
export interface ParamFrame {
  add_params: AddParams;
  emitted_at_monotonic: number;
  set_params: SetParams;
  tick_n: number
}
export interface AddParams {
  [k: string]: number
}
export interface SetParams {
  /**
   * @minItems 2
   * @maxItems 2
   */
  [k: string]: [number, number]
}
