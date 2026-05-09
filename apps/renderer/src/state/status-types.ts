export type StatusValue = 'green' | 'amber' | 'red'
export type StatusOverall = StatusValue

export interface StatusSnapshot {
  llm: StatusValue
  vts: StatusValue
  sidecar: StatusValue
  llmDetail: string
  vtsDetail: string
  sidecarDetail: string
}

export function worstOf(s: StatusSnapshot): StatusOverall {
  if (s.llm === 'red' || s.vts === 'red' || s.sidecar === 'red') return 'red'
  if (s.llm === 'amber' || s.vts === 'amber' || s.sidecar === 'amber') return 'amber'
  return 'green'
}
