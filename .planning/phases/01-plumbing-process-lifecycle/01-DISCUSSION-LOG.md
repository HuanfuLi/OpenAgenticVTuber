# Phase 1: Plumbing & Process Lifecycle — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 01-plumbing-process-lifecycle
**Areas presented:** Port allocation + READY signal, pyvts vendoring approach, Sidecar lifecycle on Windows, LLM setup screen scope & credential storage
**Areas selected for discussion:** pyvts vendoring approach, LLM setup screen scope & credential storage

---

## Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Port allocation + READY signal | port:0 ephemeral + stdout READY parse vs. fixed-port + handshake | |
| pyvts vendoring approach | Vendor day-one snapshot vs. PyPI dep + vendor-when-patched | ✓ |
| Sidecar lifecycle on Windows | Watchdog mechanism, graceful-shutdown handshake, crash-mid-session policy | |
| LLM setup screen scope & credential storage | Provider list, credential storage backend, test-display verbosity, unblock criterion | ✓ |

**User's choice:** pyvts vendoring approach + LLM setup screen scope & credential storage
**Notes:** Unselected areas resolved to documented defaults (port:0 + stdout READY per ROADMAP.md; sidecar lifecycle to Claude's discretion with planner-validatable defaults captured in CONTEXT.md `<decisions>` "Claude's Discretion").

---

## pyvts vendoring approach

### Vendor mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Plain copy + PROVENANCE.md (Recommended) | Copy upstream snapshot into sidecar/vendor/pyvts/, commit PROVENANCE.md noting commit SHA, license, future patches | ✓ |
| Git subtree | `git subtree add --prefix sidecar/vendor/pyvts ...` keeps subtree-pull capability for upstream updates | |

**User's choice:** Plain copy + PROVENANCE.md
**Notes:** Aligns with the recommended default. Git subtree's main payoff (pulling upstream updates) is irrelevant given upstream is dormant since 2024-09-10.

### Snapshot revision

| Option | Description | Selected |
|--------|-------------|----------|
| PyPI v0.3.3 release (Recommended) | Pin to last released version (2024-09-10); reproducible across machines | ✓ |
| Upstream GitHub HEAD | Latest commit; HEAD ≈ v0.3.3 today but may drift | |

**User's choice:** PyPI v0.3.3 release
**Notes:** Reproducibility wins over picking up untagged post-release fixes (none known to exist).

### Import path

| Option | Description | Selected |
|--------|-------------|----------|
| uv local-path source (Recommended) | pyproject.toml [tool.uv.sources] pyvts = { path = "sidecar/vendor/pyvts" }; clean `import pyvts` | ✓ |
| sys.path insert at sidecar entrypoint | Add vendor dir to sys.path before any imports; couples to entrypoint, breaks linters/IDE | |

**User's choice:** uv local-path source
**Notes:** Lockfile-aware, IDE-friendly, no entrypoint coupling.

### Patch policy

| Option | Description | Selected |
|--------|-------------|----------|
| In-tree edits + PROVENANCE.md log (Recommended) | Modify vendored files when bugs surface; record each patch in PROVENANCE.md | ✓ |
| No-touch vendor + adapter wrapper | Keep vendored code pristine; all workarounds in pyvts_adapter.py | |

**User's choice:** In-tree edits + PROVENANCE.md log
**Notes:** Adapter wrapper has no payoff when upstream is dormant. Adapter can only intercept call surface, not internal `recv()` race fixes (Phase 4 / pyvts issue #51).

### Continue?

| Option | Description | Selected |
|--------|-------------|----------|
| Move to next area (Recommended) | Vendor mechanics pinned; Phase 1 just needs `import pyvts` to succeed | ✓ |
| More pyvts questions | Per-file checksums, CI lints, README surfacing | |

**User's choice:** Move to next area

---

## LLM setup screen scope & credential storage

### Provider scope

| Option | Description | Selected |
|--------|-------------|----------|
| LM Studio + Custom OpenAI-compatible only (Recommended) | Strict reading of LLM-01; cleanest skeleton | |
| LM Studio + Custom + grayed-out OpenAI/Anthropic/Gemini stubs | Show hosted providers in dropdown but disabled with "Coming in v2" tooltip | ✓ |
| LM Studio + Custom + working OpenAI/Anthropic/Gemini | Wire hosted providers via LiteLLM (which supports them); LLM-01 scope creep | |

**User's choice:** LM Studio + Custom + grayed-out OpenAI/Anthropic/Gemini stubs
**Notes:** Sets v2 expectations in UI. Adds disabled-state CSS + tooltip copy to Phase 1's UI surface — planner should size 01-02 accordingly.

### Credential storage

| Option | Description | Selected |
|--------|-------------|----------|
| Electron safeStorage (Recommended) | DPAPI on Windows / Keychain on macOS; built into Electron 40; no native module | ✓ |
| electron-store plain JSON | Already in stack for window-pos; plaintext on disk | |
| keytar (native module) | Pure OS-keyring; needs electron-rebuild on each Electron bump; unmaintained as of 2024 | |

**User's choice:** Electron safeStorage
**Notes:** electron-store stays for non-secret state (window pos, last avatar, theme). safeStorage handles all credentials + the `hasCompletedSetup` flag.

### Test-connection display

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal spinner + ok/fail badge (Recommended) | Spinner; '✓ Connected (ms)' or single error line; logs to dev console | |
| Verbose log panel during test | Step-by-step status: 'Resolving URL... Sending 1-token completion... Received N tokens in Xms (model: <name>)' | ✓ |

**User's choice:** Verbose log panel during test
**Notes:** First-time-setup debugging value (LM Studio "no model loaded" is opaque). Real UI build — design a `<TestLog>` component, not a status badge. On failure, show LiteLLM error verbatim.

### Unblock criterion

| Option | Description | Selected |
|--------|-------------|----------|
| Persist hasCompletedSetup flag in safeStorage (Recommended) | Once test passes, write flag; subsequent launches skip setup screen | ✓ |
| Re-test on every launch until it passes that session | No persistent flag; silent background test on every launch | |

**User's choice:** Persist hasCompletedSetup flag in safeStorage
**Notes:** "Re-test connection" surface in settings deferred to v2 (no settings UI in skeleton beyond LLM setup itself).

### Wrap?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context (Recommended) | Write CONTEXT.md with captured decisions; defaults apply for unselected areas | ✓ |
| Explore more gray areas | Monorepo layout, WS envelope field set, echo contract shape, Windows watchdog | |

**User's choice:** I'm ready for context

---

## Claude's Discretion

For unselected gray areas, defaults from ROADMAP.md / research apply with planner-validatable choices captured in `01-CONTEXT.md`:

- Port allocation: `port:0` ephemeral + `[READY] ws://127.0.0.1:<port>/ws` stdout parse (planner locks regex + discovery timeout)
- Sidecar lifecycle on Windows: psutil parent-PID poll @ 2s, 5s graceful-shutdown timeout, single auto-respawn on crash
- Reasoning-UI scope in setup-screen test: parser-strip-only at LiteLLM-gateway boundary
- Monorepo layout: `apps/electron-main/` + `apps/renderer/` + `sidecar/` + `packages/contracts/`
- WS envelope shape: OLVT-mirror (planner reads OLVT's `_route_message()` to lock the field set)

## Deferred Ideas

None — discussion stayed within Phase 1 scope. UX-01 (per-message reasoning chevron) was already a v2 deferral before this session.
