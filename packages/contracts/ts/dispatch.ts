// GENERATED FROM packages/contracts/py/contracts/dispatch.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

export interface ActionCode {
  kind: 'action';
  name: string
}
export interface VariantToggle {
  hotkey_id: string;
  kind: 'variant';
  name: string
}
export interface EventFire {
  duration_ms: number;
  hotkey_id: string;
  kind: 'event';
  name: string
}

export type Dispatch = ActionCode | VariantToggle | EventFire;
