// GENERATED FROM packages/contracts/py/contracts/avatar_overrides.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { VariantEntry } from './variant-entry';
import type { EventEntry } from './event-entry';
import type { DefaultPluginActionBinding } from './action-binding';
export interface AvatarOverrides {
  body_sway_strategy: 'head_only' | 'proxy_param' | 'exp3_modulation';
  default_plugin_action_bindings: DefaultPluginActionBinding[];
  discovered_hotkeys: DiscoveredHotkey[];
  events: EventEntry[];
  exp3_body_pose: string | null;
  notes: Notes;
  orphan_params: string[];
  param_probes: ParamProbeResult[];
  physics_chain_proxies: PhysicsChainProxies;
  proxy_body_param: string | null;
  sign_inversions: string[];
  source_rig_path: string;
  variants: VariantEntry[];
  voice: Voice
}

export interface DiscoveredHotkey {
  file: string;
  hotkey_id: string;
  is_meta: boolean;
  llm_emittable: boolean;
  name: string;
  type: string
}

export interface Notes {
  [k: string]: string
}
export interface ParamProbeResult {
  blend_partial: boolean;
  name: string;
  orphan_face_tracker: boolean;
  readback: number;
  visible: boolean;
  wrote: number
}
export interface PhysicsChainProxies {
  [k: string]: string
}

export interface Voice {
  backend: string;
  lipsync_mode: string;
  model: string
}
