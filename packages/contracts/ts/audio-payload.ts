// GENERATED FROM packages/contracts/py/contracts/audio_payload.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { ActionIntent } from './action-intent';
export interface AudioPayloadMessage {
  actions: ActionIntent[];
  audio: string | null;
  display_text: DisplayTextField;
  forwarded: boolean;
  sentence_id: number;
  slice_length: number;
  type: 'audio';
  volumes: number[]
}

export interface DisplayTextField {
  avatar: string;
  name: string;
  text: string
}
