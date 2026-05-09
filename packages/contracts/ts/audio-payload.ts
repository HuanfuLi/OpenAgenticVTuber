// GENERATED FROM packages/contracts/py/contracts/audio_payload.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

import type { Dispatch } from './dispatch';
export interface AudioPayloadMessage {
  audio: string | null;
  dispatches: Dispatch[];
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
