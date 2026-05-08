// GENERATED FROM packages/contracts/py/contracts/action_intent.py - do not edit;
// run packages/contracts/codegen.sh to regenerate.

export interface ActionIntent {
  avatar_id: string;
  duration_ms: number | null;
  kind: 'expression' | 'action' | 'reaction';
  name: string;
  strength: number
}
