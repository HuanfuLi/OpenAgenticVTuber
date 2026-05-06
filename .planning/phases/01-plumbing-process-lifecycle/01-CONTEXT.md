# Phase 1: Plumbing & Process Lifecycle — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a typed WebSocket round-trip end-to-end with no AI logic yet:

1. `npm run dev` boots Electron → spawns Python sidecar from a uv-managed venv → renderer connects via WS → log panel shows `[READY]` + connected
2. Force-quitting Electron and immediately relaunching brings the sidecar back cleanly with no port collision
3. First-launch shows a mandatory LLM setup screen that blocks the app until a real 1-token LM Studio completion succeeds
4. Typing `hello` round-trips through the sidecar and renders `echo: hello` in the renderer (proves OLVT-shape WSMessage envelope end-to-end)
5. `sidecar/vendor/pyvts/` exists, is importable, and stub-loads without contacting VTS

Out of this phase: real LLM replies (Phase 2), TTS (Phase 3), action compositor / VTS bridge (Phase 4), §14 verification (Phase 5). New capabilities (memory, agent, multi-avatar) are not in scope of *this milestone* — see PROJECT.md "Out of Scope (this milestone)".

</domain>

<decisions>
## Implementation Decisions

### pyvts vendoring (PLUMB-05)

- **D-01: Vendor mechanism — plain copy + PROVENANCE.md.** Copy the upstream snapshot into `sidecar/vendor/pyvts/`, commit a `sidecar/vendor/pyvts/PROVENANCE.md` recording upstream commit SHA, license (MIT), and any patches we apply. No git subtree / submodule juggling.
- **D-02: Snapshot — pin to PyPI v0.3.3 release (2024-09-10).** Reproducible; matches what `uv add pyvts==0.3.3` would have resolved. Avoids drift if Genteki/pyvts later bumps HEAD with unreleased changes.
- **D-03: Import path — uv local-path source.** `pyproject.toml` declares `[tool.uv.sources] pyvts = { path = "sidecar/vendor/pyvts" }` so `import pyvts` works the same in dev, CI, and packaged builds. No `sys.path` manipulation; lockfile-aware; IDE/type-checker friendly.
- **D-04: Patch policy — in-tree edits with PROVENANCE.md log.** When bugs surface (Phase 4 will hit pyvts open issue #51), edit the vendored files directly and append a patch entry to PROVENANCE.md (purpose + diff summary). Upstream is dormant, so adapter-wrapper indirection has no payoff worth the file overhead.
- **D-05: Phase 1 scope is import-only.** Success criterion #5 is satisfied by `import pyvts` succeeding without contacting VTS. The single-writer asyncio wrapper (AVT-04) is Phase 4's deliverable, not Phase 1's — do not pre-build it here.

### LLM setup screen (PLUMB-04, LLM-01)

- **D-06: Provider dropdown scope — LM Studio + Custom OpenAI-compatible (working) + OpenAI / Anthropic / Gemini (grayed-out stubs).** The two LLM-01 providers are fully functional. The three hosted providers appear in the dropdown but are disabled with a "Coming in v2" tooltip — sets expectations in UI, costs no LiteLLM wiring, but the disabled-state CSS + tooltip copy are now part of Phase 1's UI surface.
  - *Note:* User explicitly chose this over the strict-LLM-01 minimum. Planner: do not silently scope-cut to "two providers only" — the grayed stubs are part of the deliverable.
- **D-07: Credential storage — Electron `safeStorage` (DPAPI-encrypted on Windows).** Built into Electron 40; no native module rebuild burden. Linux without a keyring drops to plaintext (acceptable per OS-isolation stance). The `electron-store` package stays for non-secret state (window pos, last avatar, theme — per CLAUDE.md). Provider URL + API key + model name + the `hasCompletedSetup` flag all go through safeStorage.
- **D-08: Test-connection UI — verbose log panel during test.** Show step-by-step status to the user, e.g.:
  ```
  ▸ Resolving URL: http://localhost:1234/v1...
  ▸ Sending 1-token completion (model: <auto-detect or user-specified>)...
  ✓ Received 1 token in 423 ms (model: qwen2.5-7b-instruct)
  ```
  On failure, show the LiteLLM error message verbatim (LM Studio "no model loaded" is otherwise opaque to first-time users). Logs persist in the panel until the user retries — they do not auto-clear.
  - *Note:* User explicitly chose this over the minimal spinner+badge default. Planner: this is a real UI build — design a `<TestLog>` component, not just a status badge.
- **D-09: First-launch unblock criterion — persist `hasCompletedSetup: true` flag in safeStorage after a successful test.** Subsequent launches skip the setup screen and proceed to the chat panel. A "Re-test connection" surface in settings is **deferred to v2** (no settings UI in skeleton beyond LLM setup itself per PROJECT.md "Out of Scope this milestone").
- **D-10: Test-completion contract — real 1-token completion call via LiteLLM.** Locked by PLUMB-04 / SC #3 — `/v1/models` ping is **not** sufficient. Test prompt is fixed (`"hi"`) with `max_tokens=1` to minimize latency.

### Claude's Discretion

User chose to defer these to research/planner judgment with documented defaults:

- **Port-allocation strategy (PLUMB-03):** Default per ROADMAP.md is `port:0` ephemeral with stdout `[READY] ws://127.0.0.1:<port>/ws` line that Electron main parses. Planner: lock the exact READY-line regex (proposed `^\[READY\] ws://127\.0\.0\.1:(\d+)/ws$`) and the discovery timeout (proposed 10s; uvicorn typically hits READY in <1s, but cold venv on Windows can be slower).
- **Sidecar lifecycle on Windows (PLUMB-02):** Reasonable defaults that planner should lock —
  - Watchdog: child sidecar polls parent PID every 2s via `psutil.Process(os.getppid()).is_running()` and self-exits if False (Windows has no `prctl(PR_SET_PDEATHSIG)` equivalent).
  - Graceful shutdown: Electron's `before-quit` sends WS `{type:"shutdown"}`; sidecar runs cleanup (close pyvts, flush logs); 5s soft timeout, then `child.kill()`.
  - Crash mid-session: Electron logs the exit code, surfaces a non-blocking renderer toast ("Sidecar crashed — restarting..."), auto-respawns once. Two crashes within 30s → surface a permanent error banner with a "Retry" button.
  - Planner: validate these on a real Windows force-quit test (Task Manager → End Task) per success criterion #2.
- **Reasoning-UI scope in Phase 1's setup-screen test:** Parser-strip-only per ROADMAP.md cross-cutting default. If the test prompt (`"hi"` with `max_tokens=1`) somehow reaches a DeepSeek-R1 distill mid-`<think>`, strip the `<think>` block at the LiteLLM-gateway boundary before showing it in the test-log panel. The chevron-expand UX is UX-01, deferred to v2.
- **Monorepo layout:** Default per research/SUMMARY.md is `apps/electron-main/` + `apps/renderer/` + `sidecar/` + `packages/contracts/`. Phase 1 will create all four directories; `packages/contracts/` ships hand-written Pydantic + hand-mirrored TS in skeleton (codegen replaces the hand-written TS in Phase 5 per SC-02).
- **WS envelope shape:** OLVT-mirror per PLUMB-03. Planner: read OLVT's `_route_message()` and freeze the exact envelope contract (`{type, payload, requestId?, timestamp?}` or whatever OLVT uses) into `packages/contracts/ws_message.py` + the matching hand-mirrored TS. The echo message becomes the first concrete `WSMessage` subtype that exercises the envelope end-to-end.

### Chrome IA & User Flow (added post-discussion 2026-05-06)

User locked the v1-target chrome architecture during a follow-up brainstorm. Skeleton **builds the chrome shell + placeholders** (Path 1) so v1 surfaces drop into pre-existing slots without rewrites. Full reference: `01-USERFLOW.md` — UI researcher MUST read it.

- **D-11: Layout — single chat-only window; VTS runs separately.** Our app is one window, chat-only (option #3 from layout discussion). VTube Studio runs in its own process the user manages. **Cursor-in-canvas tracking (AVT-10) is implemented as OS-level cursor + VTS window bounds detection — no transparent overlay window.** From the user's perspective, two visible windows exist: our app + VTS.
- **D-12: Window dimensions — 400×700 default, resizable, any aspect ratio, bottom rail always visible.** Minimum width TBD by UI researcher (~280px soft floor before icon labels become illegible).
- **D-13: Chrome — top bar + bottom rail.** Top bar (~32px): `☰` hamburger (Chat-view only) + `Agent ⏵` toggle + `⬢` status icon. Bottom rail (~48px): `⌂ Chat` / `⏷ Agent` / `⚙ Settings` — three equal-width tap targets, icon + small label, always visible.
- **D-14: Status icon format C — single composite `⬢` icon, worst-of-three color, click expands popover.** Popover lists LLM / VTS / Sidecar with details + `[Re-test connection]` button. Skeleton has no `[Change provider]`; that lands in v1.
- **D-15: History slide-in — covers chat ~80% width, dimmed strip dismisses.** Triggered by `☰`. ChatGPT-mobile pattern. Skeleton renders panel with placeholder copy (no real threads — single in-memory thread per LLM-04).
- **D-16: Logs drawer — entirely hidden when off.** No heading, no chevron when disabled. Toggle in Settings → Diagnostics. When enabled, `▾` chevron strip appears above bottom rail; click expands height-resizable drawer; state persists across launches.
- **D-17: Agent — toggle in top bar (session enable) + tab in bottom rail (manage goals/audits/saved templates).** Two affordances are intentional. Toggle is per-session, resets to OFF on app close. Bottom-rail Agent tab is the surface for goal management.
- **D-18: Agent in-chat reporting — portal-card pattern, à la Claude-Code tool-call display.** When chat-detected agent intent fires:
  - **OFF state** → upsell card with `[Turn on Agent ▶]`
  - **ON state** → goal-proposed card auto-filed by router, with `[Approve ▶] [Modify] [Cancel]`. **`[Modify]` is inline-expand within the card, not a modal.**
  - **Running state** → live-updating card with step counter, screenshot thumbnail, elapsed timer, `[Pause] [Stop] [Open ↗]` controls
  - **Sticky pill** anchors at bottom of chat surface (above input) when scrolled past; tap → jumps back to portal card
  - **Verification gate** → `[Done ✓] [Keep going]` confirmation before declaring DONE
  - **Terminal state** → persistent summary card with `[View report ↗]` link to Agent page
- **D-19: One active agent session at a time.** New goal queues or replaces (TBD by agent-runtime milestone). Concurrency excluded.
- **D-20: Manual goal entry — `[+ New goal]` button at top of Sessions list in Agent page.** Not in chat; not in Settings.
- **D-21: Settings — single long scroll, sectioned, 16 sections.** Anchor pills at top for quick jump. Full IA enumerated in `01-USERFLOW.md` §10. Skeleton renders all 16 section headers with placeholder copy; only **§1 Connection / Models**, **§15 Diagnostics** (Show log toggle + Open log folder + Reset state), and **§16 About** are functional.
- **D-22: Skeleton scope — Path 1 (chrome shell + placeholders).** All non-functional surfaces render as branded placeholder copy ("Coming in milestone-N. {what'll land}") rather than being absent. This costs ~1 phase of UI work but locks IA so v2/v3 milestones drop into existing slots without chrome rewrites. Chrome work belongs primarily to Phase 1 (PLUMB-01 Electron shell scope), with chat-content functionality landing in Phases 2–4.

### Folded Todos

None — todo cross-reference returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary specs (project-level)

- `PROJECT_DESIGN.md` — 28-round brainstorm, 112 resolved decisions. Phase 1 directly relevant: §1.4 (stack philosophy), §13.1 (Electron over Tauri), §13.8 (Python sidecar), §13.40 (electron-store for non-secrets), §14 (walking-skeleton success criteria), §16 (out-of-scope).
- `PROJECT_DESIGN.md` §5.3.1 — VTS rig architecture realities; relevant only as background for why pyvts-vendoring matters in Phase 4. Phase 1 itself does not exercise §5.3.1.
- `.planning/PROJECT.md` — Active requirements list, Risks (R-OPEN-1, R-OPEN-2), Key Decisions table.
- `.planning/REQUIREMENTS.md` — PLUMB-01 through PLUMB-05 (Phase 1's full requirement set), LLM-01 (provider scope referenced from setup-screen decisions).

### Phase contract

- `.planning/phases/01-plumbing-process-lifecycle/01-USERFLOW.md` — **MANDATORY READ for UI researcher and planner.** Comprehensive v1-target user flow with chrome IA, all 13 flows (cold launch through closing), 16-section Settings IA, agent portal-card lifecycle, error states, and the skeleton cut-list (which flow lands in which phase).
- `.planning/ROADMAP.md` Phase 1 section (lines 23–43) — phase goal, success criteria, plans (01-01 + 01-02), and the three "Open questions to resolve at plan-time" that this CONTEXT.md resolves.
- `.planning/ROADMAP.md` Phase 4 cross-phase note (line 103) — confirms Phase 1's PLUMB-05 deliverable scope is *vendor checkout + import only*, NOT the single-writer wrapper.

### Research outputs (read end-to-end before planning)

- `.planning/research/SUMMARY.md` — synthesis of stack/features/architecture/pitfalls. Lines 88–93 propose the `apps/electron-main/` + `apps/renderer/` + `sidecar/` + `packages/contracts/` layout that this CONTEXT.md endorses as Claude's-discretion default.
- `.planning/research/STACK.md` — pinned versions: Electron 40.x, React 19.2.x, Vite 6.x, TS 5.7.x, npm (not pnpm), Python 3.12, FastAPI 0.136.1, uvicorn 0.46.0, uv-managed venv, LiteLLM 1.83.x stable line.
- `.planning/research/ARCHITECTURE.md` — sidecar→VTS direct (NOT through renderer), monorepo layout rationale, 5-phase sequential build order.
- `.planning/research/PITFALLS.md` — orphan sidecar port-collision pattern, OLVT envelope shape, BPE tokenization (not relevant Phase 1 but referenced from setup-test-reply parser-strip), `<think>` boundary handling.

### Convention / config

- `CLAUDE.md` (project root) — locked stack table; reaffirms npm-not-pnpm, electron-vite-not-Forge, electron-store for non-secrets.
- `.planning/STATE.md` — current phase position, blockers/concerns, open risks.

### External (no in-repo path — paste URL in plans)

- VTube Studio API spec — https://github.com/DenchiSoft/VTubeStudio (referenced from PROVENANCE.md if/when patches involve API surface).
- pyvts upstream — https://github.com/Genteki/pyvts (snapshot v0.3.3 = the vendored revision; record the commit SHA in PROVENANCE.md).
- Electron safeStorage docs — https://www.electronjs.org/docs/latest/api/safe-storage (DPAPI/Keychain/libsecret abstraction).

</canonical_refs>

<code_context>
## Existing Code Insights

**Greenfield repo.** Only `CLAUDE.md`, `PROJECT_DESIGN.md`, and `README.md` exist at repo root — no `apps/`, `sidecar/`, or `packages/` yet. Phase 1 creates the entire scaffolding from scratch.

### Reusable Assets

None — nothing to reuse. The repo's only inheritance is *conceptual*:
- OLVT codebase (separate repo) for the WS envelope shape (`_route_message()` precedent), the `sentence_divider`/`actions_extractor`/`tts_filter` decorator chain (Phase 2 dependency, not Phase 1), and the `actionMap` pattern (Phase 4 dependency).

### Established Patterns

None yet — Phase 1 *establishes* the patterns subsequent phases inherit. Specifically:
- The `WSMessage` envelope contract (Pydantic in `packages/contracts/`, hand-mirrored TS) sets the shape every later phase's protocol message uses.
- Electron-main → sidecar lifecycle (spawn, watchdog, graceful shutdown) is the precedent for any future child process (none currently planned for skeleton — VTS runs externally, not as a child).
- Provider config storage (Electron safeStorage) is the precedent for any future secret (API keys for hosted providers in v2, GPT-SoVITS endpoint creds in TTSv2-02, etc.).

### Integration Points

- **Electron-main spawns sidecar:** `child_process.spawn('uv', ['run', 'python', '-m', 'sidecar'])` (or equivalent) with stdio piped so main can read the `[READY] ws://...` line.
- **Renderer connects to sidecar:** `new WebSocket(readyUrl)` where `readyUrl` is forwarded from main via `contextBridge` IPC after parsing the READY line.
- **Renderer ↔ main IPC:** `contextBridge` exposes a minimal API — at minimum `getReadyUrl()`, `onSidecarCrash(callback)`, `getStoredConfig()`, `setStoredConfig(payload)`. No 60 Hz traffic ever crosses this bridge (per AVT-01 — sidecar→VTS direct in Phase 4).

</code_context>

<specifics>
## Specific Ideas

- **User explicitly upgraded the LLM setup screen scope** (D-06, D-08) above the strict LLM-01 minimum. The dropdown shows OpenAI/Anthropic/Gemini grayed-out with a "Coming in v2" tooltip; the test-connection feedback is a verbose multi-line log panel rather than a spinner+badge. Both choices add real UI build time to Phase 1 — the planner should size 01-02 (LLM setup gate) accordingly and not silently revert to a minimal implementation to fit a budget.
- **The test prompt is fixed** (`"hi"` with `max_tokens=1`) — not user-configurable. Keeps the test deterministic and minimizes LM Studio cold-start cost.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope. The reasoning-UI per-message expand chevron (UX-01) was already deferred to v2 in REQUIREMENTS.md before this session and was not re-litigated here.

</deferred>

---

*Phase: 01-plumbing-process-lifecycle*
*Context gathered: 2026-05-06*
