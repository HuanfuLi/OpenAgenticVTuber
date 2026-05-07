# pyvts vendor provenance

**Upstream:** https://github.com/Genteki/pyvts
**License:** MIT (preserved verbatim in vendor/pyvts/LICENSE)
**Snapshot:** PyPI release v0.3.3, published 2024-09-10
**Upstream commit SHA:** 2792d6a33a4e51bf24670225244f7e2a586ea83e
**Vendored at:** 2026-05-06

## Why vendored

Upstream maintenance has been dormant since 2024-09-10 (verified via PyPI release date and GitHub releases page — no commits or releases in 2025–2026). Per CONTEXT.md D-01 through D-05, we vendor from day one so the project owns its dependency graph for VTS WebSocket communication. The single-writer asyncio wrapper that prevents pyvts open issue #51 (`recv()` race during concurrent `asyncio.gather`) is implemented in Phase 4 (AVT-04) — Phase 1's deliverable is import-only.

## Patches applied

(None as of vendoring date.)

## Patch log format

When a patch is applied, append an entry below:

### YYYY-MM-DD — short-description

**Author:** name
**Files touched:** path/to/file.py
**Reason:** one-line summary of why we patched
**Diff summary:** copy of `git diff --stat` for the change
**Upstream issue/PR (if any):** https://github.com/Genteki/pyvts/issues/NN
**Tests added:** path/to/test (if applicable)

### 2026-05-07 - phase-4-safe-writer-wrapper

**Author:** Codex
**Files touched:** sidecar/vendor/pyvts/PROVENANCE.md
**Reason:** Documented the Phase 4 issue-#51 mitigation decision without modifying vendored pyvts code.
**Diff summary:** 1 file changed, provenance entry added for wrapper-not-patch decision
**Upstream issue/PR (if any):** https://github.com/Genteki/pyvts/issues/51
**Tests added:** sidecar/tests/vts/test_pyvts_writer.py

We intentionally kept `sidecar/vendor/pyvts/vts.py` unchanged. Phase 4 routes
all concurrent compositor and discrete-event traffic through
`sidecar/src/sidecar/vts/pyvts_writer.py`, where `PyvtsSafeWriter` owns the
only `websocket.recv()` loop and dispatches responses by `requestID`. This
contains the concurrency fix to project code, minimizes vendor drift, and keeps
future upstream replacement or local fork decisions straightforward.
