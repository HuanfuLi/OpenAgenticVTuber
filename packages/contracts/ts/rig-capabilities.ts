// GENERATED FROM packages/contracts/py/contracts/rig_capabilities.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { DefaultPluginActionBinding } from './action-binding';
export interface RigCapabilities {
  cdi3_display_names: Cdi3DisplayNames;
  default_plugin_action_bindings: DefaultPluginActionBinding[];
  expressions: Expression[];
  hotkeys: Hotkey[];
  param_ranges: ParamRanges;
  sign_inversions: string[];
  writable_param_ids: string[]
}
export interface Cdi3DisplayNames {
  [k: string]: string
}

export interface Expression {
  file: string;
  name: string
}
export interface Hotkey {
  hotkey_id: string;
  name: string;
  type: string
}
export interface ParamRanges {
  [k: string]: [number, number] | null
}
