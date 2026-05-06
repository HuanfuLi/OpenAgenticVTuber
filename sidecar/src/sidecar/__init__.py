"""AgenticLLMVTuber Python sidecar package.

Side-effect on import: prepend `<repo>/sidecar/vendor/` to sys.path so
`import pyvts` resolves to the vendored copy at sidecar/vendor/pyvts/
rather than the wheel that uv installed into .venv/Lib/site-packages/.

Why: per CONTEXT.md D-01..D-05 + must_haves.truths, the vendored pyvts is
the canonical source — patches under sidecar/vendor/pyvts/ must be picked
up without re-running `uv sync`. Hatch's editable-install mode for our
pyvts pyproject layout (where __init__.py lives directly inside the
package dir, not under a nested pyvts/ subdir) does not produce a usable
.pth pointing at the parent of vendor/pyvts/, so we install pyvts as a
regular wheel for dependency resolution AND prepend the vendor/ dir on
sys.path here so the import resolves to the vendor copy at runtime.
"""

import sys
from pathlib import Path

# This file lives at sidecar/src/sidecar/__init__.py — vendor/ is two parents up
# from `src/sidecar/`, then `vendor/`.
_VENDOR_DIR = (Path(__file__).resolve().parent.parent.parent / "vendor").resolve()
if _VENDOR_DIR.is_dir() and str(_VENDOR_DIR) not in sys.path:
    # Prepend so vendor/pyvts wins over any site-packages install.
    sys.path.insert(0, str(_VENDOR_DIR))
