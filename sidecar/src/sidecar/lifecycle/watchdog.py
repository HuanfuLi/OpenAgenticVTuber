"""Parent-PID watchdog for the Python sidecar.

Polls Electron's PID every 2s; on any orphan signal, exits via os._exit(0)
to skip cleanup that no one is listening for.

Verbatim from RESEARCH.md "Pattern: Python sidecar lifecycle on Windows".
Pitfall references: 11 (orphan port), port:0-race.
"""

import asyncio
import os

import psutil


async def parent_watchdog(parent_pid: int, poll_interval: float = 2.0) -> None:
    """Self-terminate if Electron parent dies. Windows has no PR_SET_PDEATHSIG.

    Polls parent PID every 2s via psutil.pid_exists(). On Windows, getppid()
    returns the cached original parent PID even after the parent dies, so
    pid_exists() is the authoritative check.

    Uses os._exit(0) (not sys.exit) to skip cleanup — when orphaned, there is
    no one to receive a graceful shutdown.

    Re-parenting check: POSIX SIGCHLD orphans get re-parented to init/PID 1, so
    getppid() will diverge from the original immediate parent. We compare
    against the ORIGINAL `os.getppid()` snapshot — NOT against `parent_pid`,
    because on Windows the spawn chain is electron.exe → cmd.exe → uv.exe →
    python.exe, so `getppid()` returns uv.exe's PID while `parent_pid` is
    Electron's (passed via AGENTICLLMVTUBER_PARENT_PID). They are expected to
    differ at boot; only divergence FROM THE BOOT-TIME VALUE indicates orphan.
    """
    original_ppid = os.getppid()
    while True:
        await asyncio.sleep(poll_interval)
        try:
            if not psutil.pid_exists(parent_pid):
                # Parent gone. Exit immediately — don't await graceful shutdown,
                # we're orphaned and there's no one to receive a goodbye.
                os._exit(0)
            current_ppid = os.getppid()
            if current_ppid != original_ppid:
                # POSIX: re-parented to init/PID 1; Windows: stale PID — both indicate orphan.
                os._exit(0)
        except (psutil.NoSuchProcess, ProcessLookupError):
            os._exit(0)
