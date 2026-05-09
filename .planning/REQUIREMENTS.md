# Requirements: AgenticLLMVTuber

**Defined:** 2026-05-09
**Milestone:** v2.1 Mock/Reality Cleanup
**Core Value:** Multi-avatar identity persistence (v1 horizon; v2.1 makes the current UI truthful before larger v3/v4 features)

This milestone removes misleading mocks and hardcoded user-facing state so the app accurately reflects what has shipped through v2.0 and clearly labels what remains deferred. It also adds first-class conversation history sessions and makes the v2.0 plugin developer path documented, swappable, and diagnosable before v3.0 voice work.

## v2.1 Requirements

### Status & App State

- [x] **STAT-01**: User can see the configured LLM provider and model in the status popover without hardcoded `qwen2.5` or scripted latency text.
- [x] **STAT-02**: User can see sidecar readiness from the real Electron sidecar lifecycle, preserving existing crash/respawn banner behavior.
- [x] **STAT-03**: User can see VTube Studio connection/auth status derived from real sidecar or VTS health state, not from `mockStatus`.
- [x] **STAT-04**: Status retry/reconnect actions invoke real setup/restart/reconnect paths or are disabled with accurate copy; no mock timeout changes status to green.
- [x] **STAT-05**: Renderer app state persists through real Electron storage APIs where available; production flows do not rely on `mockSafeStorage`.

### Settings Reality

- [x] **SET-01**: Settings > Avatars shows the active avatar identity and links to the existing Avatar Import/review flow instead of a generic milestone placeholder.
- [x] **SET-02**: Settings > per-avatar settings shows real editable avatar override/catalog state when available, or a precise disabled state when editing is not yet implemented.
- [x] **SET-03**: Settings > VTube Studio shows real connection/auth/token state and available re-auth/reconnect actions where supported.
- [x] **SET-04**: Settings > Conversation shows truthful current conversation behavior: single in-memory thread, reset-on-relaunch, provider/model, and no fake conversation-history controls.
- [x] **SET-05**: Settings > Memory is disabled/deferred with copy that states memory ships with the agentic system in v4.0.
- [x] **SET-06**: Settings > Log level is wired to a real log-level preference/effect or is disabled with accurate copy; it must not say "Coming in milestone-2."
- [x] **SET-07**: Settings copy references current milestone intent accurately: v3.0 for STT/TTS, v4.0 for agentic system plus memory.

### Conversation History

- [x] **HIST-01**: User can create, switch, rename/title, and delete ChatGPT-style conversation sessions from normal chat/history UI.
- [x] **HIST-02**: Active session messages persist across app restart and restore without relying on scripted conversation fixtures.
- [x] **HIST-03**: Sending a message appends to the active session while preserving the existing LLM streaming, TTS, and VTS response pipeline.
- [x] **HIST-04**: Settings > Conversation reflects real session/history behavior and exposes truthful controls for retention/reset where supported.
- [x] **HIST-05**: Conversation history is transcript/session persistence only; semantic memory, retrieval, and per-avatar memory remain deferred to v4.0.

### Plugin Developer Docs & Swap Hardening

- [ ] **PLUGDOC-01**: Human plugin developers can read a top-level plugin guide covering directory layout, `plugin.yaml`, `BodyMotionPlugin`, `ParamFrame`, trusted in-sidecar execution, dependency expectations, and local test workflow.
- [x] **PLUGDOC-02**: AI plugin-author agents have a compact brief naming the source files to inspect, plugin invariants, forbidden patterns, and regression commands.
- [ ] **PLUGDOC-03**: Plugin selection clearly reflects the boot-time swap model: choosing a new active plugin either restarts the sidecar or shows an explicit restart-required state.
- [x] **PLUGDOC-04**: Invalid manifests, missing entrypoints, incompatible API versions, and `NullPlugin` fallback are surfaced through Settings/status/log surfaces with actionable copy.
- [ ] **PLUGDOC-05**: Automated tests cover plugin discovery/listing parity, active-plugin persistence, restart behavior, and invalid-plugin/fallback reporting.

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
| STAT-01 | Phase 11 | Complete |
| STAT-02 | Phase 11 | Complete |
| STAT-03 | Phase 11 | Complete |
| STAT-04 | Phase 11 | Complete |
| STAT-05 | Phase 11 | Complete |
| SET-01 | Phase 12 | Complete |
| SET-02 | Phase 12 | Complete |
| SET-03 | Phase 12 | Complete |
| SET-04 | Phase 12 | Complete |
| SET-05 | Phase 12 | Complete |
| SET-06 | Phase 12 | Complete |
| SET-07 | Phase 12 | Complete |
| HIST-01 | Phase 13 | Complete |
| HIST-02 | Phase 13 | Complete |
| HIST-03 | Phase 13 | Complete |
| HIST-04 | Phase 13 | Complete |
| HIST-05 | Phase 13 | Complete |
| PLUGDOC-01 | Phase 14 | Gap closure pending |
| PLUGDOC-02 | Phase 14 | Complete |
| PLUGDOC-03 | Phase 14 | Gap closure pending |
| PLUGDOC-04 | Phase 14 | Complete |
| PLUGDOC-05 | Phase 14 | Gap closure pending |
| MOCK-01 | Phase 15 | Pending |
| MOCK-02 | Phase 15 | Pending |
| MOCK-03 | Phase 15 | Pending |
| MOCK-04 | Phase 15 | Pending |

**Coverage:**
- v2.1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 after Phase 14 UAT gaps diagnosed*
