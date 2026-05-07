"""Adapted from OLVT prompts/prompt_loader.py (MIT) -- see PROVENANCE.md.

Skeleton-only need: load_util(prompt_name) for the live2d_expression_prompt.
Drops OLVT's load_persona (not used by skeleton) and chardet fallback (skeleton
prompts are utf-8 only).
"""
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_util(prompt_name: str) -> str:
    """Load `<prompt_name>.txt` from sidecar/src/sidecar/orchestrator/prompts/."""
    path = _PROMPTS_DIR / f"{prompt_name}.txt"
    return path.read_text(encoding="utf-8")
