# Phase 18 UAT: Rich Voice Settings + Persistence

## Automated UAT

- PASS: Settings renders a functional Voice in section rather than a milestone placeholder.
- PASS: Selecting a local STT provider and saving persists `audio.stt` settings without committing a conversation turn.
- PASS: Selecting a cloud STT provider shows consent/API key controls and blocks provider tests until consent and key are present.
- PASS: Sidecar STT diagnostics redact API keys, user paths, and transcript-like fields.

## Manual Follow-Up

- Optional: open Settings and confirm the Voice in anchor scrolls to the new section.
- Optional: select OpenAI or Groq STT, verify the test button remains blocked until consent and an API key are entered.

