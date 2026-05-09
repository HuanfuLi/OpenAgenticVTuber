export type StatusValue = 'green' | 'amber' | 'red'
export type StatusOverall = StatusValue

export interface StatusSnapshot {
  llm: StatusValue
  vts: StatusValue
  sidecar: StatusValue
  plugin: StatusValue
  llmDetail: string
  vtsDetail: string
  sidecarDetail: string
  pluginDetail: string
  pluginLifecycleState:
    | 'active'
    | 'restart pending'
    | 'load failed'
    | 'fallback/null'
    | 'circuit open'
    | 'invalid manifest'
    | 'unknown/loading'
  pluginDeveloperDetails?: string | null
}

export function worstOf(s: StatusSnapshot): StatusOverall {
  if (s.llm === 'red' || s.vts === 'red' || s.sidecar === 'red') return 'red'
  if (s.llm === 'amber' || s.vts === 'amber' || s.sidecar === 'amber') return 'amber'
  return 'green'
}
