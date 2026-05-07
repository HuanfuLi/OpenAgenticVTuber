// Hand-mirrored TS — codegen replaces in Phase 5 (SC-02).
// In-process queue payload — NOT a WS message variant.
export interface SpeechEnvelopePayload {
  sentence_id: number
  volumes: number[]
  slice_length: number
  started_at: number
}
