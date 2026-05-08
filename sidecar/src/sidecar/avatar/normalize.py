"""Variant/event code normalization helpers."""

from __future__ import annotations

import re
import unicodedata


RESERVED_NAMES = {
    "think",
    "thinking",
    "function_call",
    "function_calls",
    "tool_call",
    "tool_calls",
    "system",
}


def slug_from_hotkey_name(name: str) -> str:
    text = name.strip()
    text = re.sub(r"\s*\[[^\]]+\]\s*$", "", text)
    text = re.sub(r"【([^】]+)】", r"\1-", text)
    text = re.sub(r"\[([^\]]+)\]", r"\1-", text)
    text = text.replace("＆", "&").replace("&", "-")
    text = text.replace("/", "-")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:31]


def is_placeholder_code(code: str) -> bool:
    return re.fullmatch(r"exp_?\d+", code or "", re.IGNORECASE) is not None


def is_reserved_name(code: str) -> bool:
    return (code or "").lower() in RESERVED_NAMES
