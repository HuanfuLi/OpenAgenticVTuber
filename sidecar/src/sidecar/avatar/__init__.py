"""avatar package — overrides + extractors + rig capabilities (v2.0).

Backward-compat shims: capabilities.py is reduced to a stub through Phase 6;
TetoOverrides remains aliased to AvatarOverrides for the milestone-1 -> v2.0
transitional window.
"""

from . import extractors
from .overrides import AvatarOverrides, TetoOverrides, load_avatar_overrides, save_avatar_overrides
from .rig_capabilities import RigCapabilities, build_rig_capabilities

__all__ = [
    "AvatarOverrides",
    "TetoOverrides",
    "load_avatar_overrides",
    "save_avatar_overrides",
    "RigCapabilities",
    "build_rig_capabilities",
    "extractors",
]
