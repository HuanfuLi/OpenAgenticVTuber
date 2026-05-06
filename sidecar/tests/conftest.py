"""Pytest hook — make sure the vendored pyvts at sidecar/vendor/pyvts is on
sys.path before any test imports `pyvts`. The sidecar package itself does the
same prepend in `sidecar/__init__.py`, but tests that import pyvts directly
(without first importing sidecar) need the same shim.
"""

import sys
from pathlib import Path

_TESTS_DIR = Path(__file__).resolve().parent
_VENDOR_DIR = (_TESTS_DIR.parent / "vendor").resolve()
if _VENDOR_DIR.is_dir() and str(_VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(_VENDOR_DIR))
