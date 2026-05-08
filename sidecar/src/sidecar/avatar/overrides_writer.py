"""Atomic writer for avatar override YAML."""

from __future__ import annotations

import json
import os
from pathlib import Path

import jsonschema
import yaml

_SCHEMA_PATH = Path(__file__).resolve().parents[3] / "schemas" / "avatar_overrides.schema.json"
_SCHEMA = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))


def write_avatar_overrides_atomic(target: Path, data: dict) -> None:
    """Validate data, then write target via .tmp, fsync, and atomic replace."""

    jsonschema.validate(instance=data, schema=_SCHEMA)
    tmp = target.with_suffix(target.suffix + ".tmp")
    target.parent.mkdir(parents=True, exist_ok=True)
    yaml_text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        os.write(fd, yaml_text.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, target)
