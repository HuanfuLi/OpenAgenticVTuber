// GENERATED FROM packages/contracts/py/contracts/avatar_import_plan.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { VariantEntry } from './variant-entry';
import type { EventEntry } from './event-entry';
import type { AvatarOverrides, Voice } from './avatar-overrides';
export interface AvatarImportPlan {
  avatar_id: string;
  avatar_name: string;
  detected_type: string;
  events: EventEntry[];
  existing_overrides: AvatarOverrides | null;
  source_rig_path: string;
  variants: VariantEntry[];
  voice: Voice | null;
  warnings: ImportWarning[]
}

export interface Notes {
  [k: string]: string
}

export interface PhysicsChainProxies {
  [k: string]: string
}


export interface ImportWarning {
  kind: string;
  message: string;
  related_code: string | null
}
