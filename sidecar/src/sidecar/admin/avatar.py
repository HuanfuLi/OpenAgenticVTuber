"""Avatar import HTTP endpoints."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import jsonschema
import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from contracts.avatar_import_plan import AvatarImportPlan, ImportWarning
from sidecar.avatar.extractors import (
    extract_cubism_bare,
    extract_cubism_named,
    extract_olvt,
    extract_vts,
)
from sidecar.avatar.import_detect import AvatarType, detect_type
from sidecar.avatar.overrides import AvatarOverrides, Voice, load_avatar_overrides
from sidecar.avatar.overrides_writer import write_avatar_overrides_atomic

router = APIRouter(prefix="/admin/avatar")

COPY_ERROR_CUBISM_5_3 = (
    "This avatar uses Cubism 5.3 features that VTube Studio doesn't support yet. "
    "Please re-export the rig from Cubism Editor with target version 5.2 or earlier, "
    "or wait for VTS to add 5.3 support."
)
COPY_ERROR_NO_MODEL3 = (
    "This folder doesn't look like a runtime Live2D export. "
    "If you have a .cmo3 Cubism Editor project, export it first."
)


class ImportRequest(BaseModel):
    folder: str


class CommitResponse(BaseModel):
    status: str
    path: str


_EXTRACTORS = {
    AvatarType.OLVT: extract_olvt,
    AvatarType.VTS_STANDARD: extract_vts,
    AvatarType.CUBISM_WITH_EXPRESSIONS: extract_cubism_named,
    AvatarType.CUBISM_BARE: extract_cubism_bare,
}


def _load_existing(folder: Path) -> AvatarOverrides | None:
    overrides_path = folder / "_avatar_overrides.yaml"
    if not overrides_path.exists():
        return None
    with overrides_path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return AvatarOverrides.model_validate(raw)


def _drop_wire_only_fields(data: dict[str, Any]) -> dict[str, Any]:
    for variant in data.get("variants", []):
        variant.pop("is_placeholder", None)
    for event in data.get("events", []):
        event.pop("is_placeholder", None)
    return data


@router.post("/import", response_model=AvatarImportPlan)
async def import_avatar(req: ImportRequest) -> AvatarImportPlan:
    folder = Path(req.folder)
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=400, detail=f"Folder does not exist: {folder}")

    avatar_type = detect_type(folder)
    if avatar_type == AvatarType.UNSUPPORTED_CUBISM_5_3:
        return AvatarImportPlan(
            detected_type=avatar_type.value,
            source_rig_path=str(folder),
            warnings=[ImportWarning(kind="cubism_5_3", message=COPY_ERROR_CUBISM_5_3)],
        )
    if avatar_type == AvatarType.UNSUPPORTED_NO_MODEL3:
        return AvatarImportPlan(
            detected_type=avatar_type.value,
            source_rig_path=str(folder),
            warnings=[ImportWarning(kind="no_model3", message=COPY_ERROR_NO_MODEL3)],
        )

    variants, events, warnings = _EXTRACTORS[avatar_type](folder)
    return AvatarImportPlan(
        detected_type=avatar_type.value,
        avatar_id=folder.name,
        avatar_name=folder.name,
        source_rig_path=str(folder),
        variants=variants,
        events=events,
        warnings=warnings,
        existing_overrides=_load_existing(folder),
    )


@router.post("/import/commit", response_model=CommitResponse)
async def commit_avatar(plan: AvatarImportPlan) -> CommitResponse:
    target_dir = Path(plan.source_rig_path)
    if not target_dir.exists() or not target_dir.is_dir():
        raise HTTPException(status_code=400, detail=f"source_rig_path does not exist: {target_dir}")

    existing = plan.existing_overrides
    new_overrides = AvatarOverrides(
        variants=plan.variants,
        events=plan.events,
        voice=plan.voice or Voice(),
        source_rig_path=plan.source_rig_path,
        sign_inversions=existing.sign_inversions if existing else [],
        body_sway_strategy=existing.body_sway_strategy if existing else "head_only",
        proxy_body_param=existing.proxy_body_param if existing else None,
        exp3_body_pose=existing.exp3_body_pose if existing else None,
        orphan_params=existing.orphan_params if existing else [],
        physics_chain_proxies=existing.physics_chain_proxies if existing else {},
        param_probes=existing.param_probes if existing else [],
        discovered_hotkeys=existing.discovered_hotkeys if existing else [],
        notes=existing.notes if existing else {},
    )
    target = target_dir / "_avatar_overrides.yaml"
    try:
        write_avatar_overrides_atomic(
            target,
            _drop_wire_only_fields(new_overrides.model_dump(mode="json", exclude_none=False)),
        )
    except jsonschema.ValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed: {e.message} at {list(e.path)}",
        ) from e
    return CommitResponse(status="ok", path=str(target))


@router.get("/import/current", response_model=AvatarImportPlan)
async def get_current_avatar(avatar_id: str) -> AvatarImportPlan:
    repo_root = Path(os.environ.get("AGENTICLLMVTUBER_REPO_ROOT", os.getcwd()))
    avatar_dir = repo_root / "avatars" / avatar_id
    overrides_path = avatar_dir / "_avatar_overrides.yaml"
    if not overrides_path.exists():
        raise HTTPException(status_code=404, detail=f"No overrides for avatar_id={avatar_id}")

    overrides = load_avatar_overrides(avatar_dir)
    return AvatarImportPlan(
        detected_type="reedit",
        avatar_id=avatar_id,
        avatar_name=avatar_id,
        source_rig_path=overrides.source_rig_path,
        variants=overrides.variants,
        events=overrides.events,
        voice=overrides.voice,
        existing_overrides=overrides,
    )
