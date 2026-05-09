# Requirements: AgenticLLMVTuber

**Defined:** 2026-05-09
**Milestone:** v2.1 Mock/Reality Cleanup
**Core Value:** Multi-avatar identity persistence (v1 horizon; v2.1 makes the current UI truthful before larger v3/v4 features)

This milestone does not add major new product capabilities. It removes misleading mocks and hardcoded user-facing state so the app accurately reflects what has shipped through v2.0 and clearly labels what remains deferred.

## v2.1 Requirements

### Status & App State

- [ ] **STAT-01**: User can see the configured LLM provider and model in the status popover without hardcoded `qwen2.5` or scripted latency text.
- [ ] **STAT-02**: User can see sidecar readiness from the real Electron sidecar lifecycle, preserving existing crash/respawn banner behavior.
- [ ] **STAT-03**: User can see VTube Studio connection/auth status derived from real sidecar or VTS health state, not from `mockStatus`.
- [ ] **STAT-04**: Status retry/reconnect actions invoke real setup/restart/reconnect paths or are disabled with accurate copy; no mock timeout changes status to green.
- [ ] **STAT-05**: Renderer app state persists through real Electron storage APIs where available; production flows do not rely on `mockSafeStorage`.

### Settings Reality

- [ ] **SET-01**: Settings > Avatars shows the active avatar identity and links to the existing Avatar Import/review flow instead of a generic milestone placeholder.
- [ ] **SET-02**: Settings > per-avatar settings shows real editable avatar override/catalog state when available, or a precise disabled state when editing is not yet implemented.
- [ ] **SET-03**: Settings > VTube Studio shows real connection/auth/token state and available re-auth/reconnect actions where supported.
- [ ] **SET-04**: Settings > Conversation shows truthful current conversation behavior: single in-memory thread, reset-on-relaunch, provider/model, and no fake conversation-history controls.
- [ ] **SET-05**: Settings > Memory is disabled/deferred with copy that states memory ships with the agentic system in v4.0.
- [ ] **SET-06**: Settings > Log level is wired to a real log-level preference/effect or is disabled with accurate copy; it must not say "Coming in milestone-2."
- [ ] **SET-07**: Settings copy references current milestone intent accurately: v3.0 for STT/TTS, v4.0 for agentic system plus memory.

### Mock Boundary

- [ ] **MOCK-01**: Production user flows do not import or mutate `mockStatus`, `mockBanners`, `mockToasts`, `mockSafeStorage`, or scripted conversation fixtures.
- [ ] **MOCK-02**: Dev-only mock controls remain isolated to development panels or test utilities and cannot be reached from normal app chrome in production mode.
- [ ] **MOCK-03**: Alert-only mock actions such as "would open logs/docs" are replaced with real actions or disabled controls with truthful copy.
- [ ] **MOCK-04**: Automated tests cover the removal or isolation of mocks for status, Settings, app state persistence, and placeholder/deferred sections.

## Future Requirements

### v3.0 STT/TTS

- **VOICE-01**: User can use speech-to-text input with explicit push-to-talk or equivalent activation.
- **VOICE-02**: User can configure TTS voice/backend settings beyond the current fixed Piper path.
- **VOICE-03**: Voice input and TTS settings integrate with the existing conversation and VTS lipsync flow.

### v4.0 Agentic System + Memory

- **AGENT-01**: User can opt into agent mode for screen/file/web tasks with clear permission boundaries.
- **MEM-01**: User gets per-avatar episodic memory and shared user-facts storage.
- **MEM-02**: User can inspect, delete, and control memory entries.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Implementing memory storage/retrieval | Deferred to v4.0 with the agentic system; v2.1 only makes the Settings surface truthful. |
| Agent mode, goal loop, scheduler, and skills bridge | Deferred to v4.0. |
| STT implementation or new TTS backend work | Deferred to v3.0 STT/TTS. |
| Multi-avatar identity and memory-backed switching | Depends on memory/identity work beyond v2.1. |
| New avatar import extractor formats | v2.1 only wires existing avatar import/review state into Settings. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAT-01 | Phase 11 | Pending |
| STAT-02 | Phase 11 | Pending |
| STAT-03 | Phase 11 | Pending |
| STAT-04 | Phase 11 | Pending |
| STAT-05 | Phase 11 | Pending |
| SET-01 | Phase 12 | Pending |
| SET-02 | Phase 12 | Pending |
| SET-03 | Phase 12 | Pending |
| SET-04 | Phase 12 | Pending |
| SET-05 | Phase 12 | Pending |
| SET-06 | Phase 12 | Pending |
| SET-07 | Phase 12 | Pending |
| MOCK-01 | Phase 13 | Pending |
| MOCK-02 | Phase 13 | Pending |
| MOCK-03 | Phase 13 | Pending |
| MOCK-04 | Phase 13 | Pending |

**Coverage:**
- v2.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 after v2.1 milestone initialization*
