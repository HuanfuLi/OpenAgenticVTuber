from __future__ import annotations

import re
from pathlib import Path
from typing import Any


_SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|authorization|bearer|token|secret)\s*[:=]\s*[^,\s;]+"),
    re.compile(r"(?i)\bsk-[A-Za-z0-9_-]{8,}\b"),
]
_WINDOWS_PATH = re.compile(r"[A-Za-z]:\\(?:[^\\/:*?\"<>|\r\n]+\\)+[^\\/:*?\"<>|\r\n]*")
_POSIX_HOME_PATH = re.compile(r"/(?:Users|home)/[^/\s]+(?:/[^\s,;]+)*")
_TRANSCRIPT_KEYS = {"transcript", "transcript_text", "prompt_text", "text", "utterance"}
_SECRET_KEYS = {"api_key", "authorization", "bearer", "token", "secret", "password"}


def _redact_string(value: str) -> str:
    redacted = value
    for pattern in _SECRET_PATTERNS:
        redacted = pattern.sub(lambda m: f"{m.group(1)}=[redacted]" if m.groups() else "[redacted]", redacted)
    redacted = _WINDOWS_PATH.sub(lambda m: f"[path:{Path(m.group(0)).name or 'redacted'}]", redacted)
    redacted = _POSIX_HOME_PATH.sub(lambda m: f"[path:{Path(m.group(0)).name or 'redacted'}]", redacted)
    return redacted


def redact_audio_diagnostics(value: Any, *, key: str | None = None) -> Any:
    normalized_key = key.lower() if key else None
    if normalized_key in _SECRET_KEYS:
        return "[redacted]" if value else None
    if normalized_key in _TRANSCRIPT_KEYS:
        return "[transcript redacted]" if value else None
    if isinstance(value, str):
        return _redact_string(value)
    if isinstance(value, list):
        return [redact_audio_diagnostics(item) for item in value]
    if isinstance(value, tuple):
        return [redact_audio_diagnostics(item) for item in value]
    if isinstance(value, dict):
        return {str(k): redact_audio_diagnostics(v, key=str(k)) for k, v in value.items()}
    return value

