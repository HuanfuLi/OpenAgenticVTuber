#!/usr/bin/env bash
# packages/contracts/codegen.sh
# Pydantic source-of-truth -> JSON Schema -> TypeScript codegen entry-point.
# Run from any CWD; resolves paths relative to the script.
# Phase 5 plan 05-01 (SC-02). Pydantic is source-of-truth; this script
# regenerates packages/contracts/ts/*.ts and packages/contracts/generated/json-schema/*.json.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Use the sidecar venv's Python (has pydantic + the contracts package installed).
PYTHON="$REPO_ROOT/sidecar/.venv/Scripts/python.exe"
if [ ! -x "$PYTHON" ]; then
  PYTHON="$REPO_ROOT/sidecar/.venv/bin/python"
fi

if [ ! -x "$PYTHON" ]; then
  echo "ERROR: sidecar venv not found. Run 'cd sidecar && uv sync' first." >&2
  exit 1
fi

cd "$REPO_ROOT"
exec "$PYTHON" packages/contracts/scripts/codegen.py "$@"
