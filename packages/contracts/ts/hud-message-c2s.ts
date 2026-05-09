// GENERATED FROM packages/contracts/py/contracts/hud_message.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

export interface HudSetLockMessage {
  kind: 'set-lock';
  param_id: string;
  value: number
}
export interface HudClearLockMessage {
  kind: 'clear-lock';
  param_id: string
}

export type HudMessageC2S = HudSetLockMessage | HudClearLockMessage;
