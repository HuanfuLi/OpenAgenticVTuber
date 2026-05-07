"""Compositor package -- Phase 4 seeds the resolver and ParamFrame surface."""

from .param_frame import ParamFrame, ParamMode
from .param_id_resolver import RendererName, resolve_param_id

__all__ = ["ParamFrame", "ParamMode", "RendererName", "resolve_param_id"]
