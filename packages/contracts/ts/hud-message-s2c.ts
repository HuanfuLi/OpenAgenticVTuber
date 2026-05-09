// GENERATED FROM packages/contracts/py/contracts/hud_message.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

/**
 * Full snapshot pushed at 15Hz per CONTEXT D-C4 (no delta encoding).
 */
export interface HudParamFrameMessage {
  kind: 'param-frame';
  locked_ids: string[];
  params: Params;
  tick_n: number
}
export interface Params {
  [k: string]: number
}
export interface HudLockConfirmedMessage {
  kind: 'lock-confirmed';
  param_id: string;
  value: number
}
/**
 * ERROR-log channel only per CONTEXT D-C5; never surfaces in renderer UI.
 */
export interface HudLockRejectedMessage {
  kind: 'lock-rejected';
  param_id: string;
  reason: string
}

export type HudMessageS2C = HudParamFrameMessage | HudLockConfirmedMessage | HudLockRejectedMessage;
