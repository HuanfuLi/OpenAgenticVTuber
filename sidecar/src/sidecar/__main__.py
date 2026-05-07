"""Sidecar entry point. DPI awareness must be set before sidecar imports."""

import sys

if sys.platform == "win32":
    import ctypes

    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        ctypes.windll.user32.SetProcessDPIAware()

from .main import main

if __name__ == "__main__":
    main()
