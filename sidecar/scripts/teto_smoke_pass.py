"""Teto smoke-pass script for Phase 4 entry gating."""
from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path

import pyvts
from sidecar.avatar.overrides import (
    DiscoveredHotkey,
    ParamProbeResult,
    TetoOverrides,
    save_overrides,
)


META_NAMES = {"Remove All Toggles", "Remove Water Mark"}
PRIORITY_PROBE_PARAMS = ["Lean Forward", "Auto Breath"]
TOKEN_PATH = Path(__file__).resolve().parents[1] / ".vts_token.txt"


async def probe_param(client, name: str, probe_value: float = 1.0) -> ParamProbeResult:
    set_msg = client.vts_request.requestSetParameterValue(
        parameter=name,
        value=probe_value,
        weight=1.0,
        mode="set",
        face_found=False,
    )
    await client.request(set_msg)
    await asyncio.sleep(0.15)
    read_msg = client.vts_request.requestParameterValue(parameter=name)
    resp = await client.request(read_msg)
    actual = float(resp.get("data", {}).get("value", 0.0))
    return ParamProbeResult(
        name=name,
        wrote=probe_value,
        readback=actual,
        visible=abs(actual - probe_value) < 0.05,
        orphan_face_tracker=abs(actual) < 0.05,
        blend_partial=0.05 < abs(actual - probe_value) < 0.5,
    )


async def main() -> None:
    plugin_info = {
        "plugin_name": "AgenticLLMVTuber Teto Smoke Pass",
        "developer": "AgenticLLMVTuber",
        "authentication_token_path": str(TOKEN_PATH),
    }
    client = pyvts.vts(plugin_info=plugin_info)
    print("[SMOKE-PASS] writer=smoke_pass_only compositor=not_running")
    await client.connect()
    await client.request_authenticate_token()
    await client.request_authenticate()

    try:
        api_state_msg = client.vts_request.BaseRequest("APIStateRequest")
        api_state = await client.request(api_state_msg)
        active_plugins = api_state.get("data", {}).get("currentlyAuthenticatedPluginNames", [])
        print(f"[SMOKE-PASS] active_plugins={active_plugins}")
        others = [p for p in active_plugins if p != plugin_info["plugin_name"]]
        if others:
            print(
                f"[SMOKE-PASS] ABORT - multiple plugins active: {active_plugins}. "
                f"Close prior sidecar/dev sessions before re-running."
            )
            await client.close()
            return
    except Exception as exc:
        print(f"[SMOKE-PASS] WARNING: APIStateRequest failed ({exc!r}); proceeding anyway")

    probes: list[ParamProbeResult] = []
    for name in PRIORITY_PROBE_PARAMS:
        probes.append(await probe_param(client, name))

    try:
        list_msg = client.vts_request.requestTrackingParameterList()
        list_resp = await client.request(list_msg)
        all_params = list_resp.get("data", {}).get("customParameters", []) + list_resp.get(
            "data", {}
        ).get("defaultParameters", [])
        body_region_keywords = ("Body", "Lean", "Breath", "ParamAngle", "ParamBodyAngle")
        scanned = {p.name for p in probes}
        for entry in all_params[:30]:
            pname = entry.get("name", "")
            if pname in scanned:
                continue
            if any(k in pname for k in body_region_keywords):
                probes.append(await probe_param(client, pname))
                scanned.add(pname)
    except Exception as exc:
        print(f"[SMOKE-PASS] WARNING: extended param scan failed ({exc!r})")

    hotkey_msg = client.vts_request.requestHotKeyList()
    hotkey_resp = await client.request(hotkey_msg)
    available = hotkey_resp.get("data", {}).get("availableHotkeys", [])
    hotkeys = [
        DiscoveredHotkey(
            hotkey_id=h["hotkeyID"],
            name=h["name"],
            type=h["type"],
            file=h.get("file", ""),
            is_meta=h["name"] in META_NAMES,
            llm_emittable=h["name"] not in META_NAMES,
        )
        for h in available
    ]
    n_meta = sum(1 for h in hotkeys if h.is_meta)
    print(f"[SMOKE-PASS] discovered {len(hotkeys)} hotkeys ({n_meta} meta excluded)")

    lean_visible = next((p.visible for p in probes if p.name == "Lean Forward"), False)
    overrides = TetoOverrides(
        param_probes=probes,
        discovered_hotkeys=hotkeys,
        body_sway_strategy="proxy_param" if lean_visible else "head_only",
        proxy_body_param="Lean Forward" if lean_visible else None,
        orphan_params=[p.name for p in probes if p.orphan_face_tracker],
        notes={
            "smoke_pass_run_at": datetime.now().isoformat(),
            "plugin_name": plugin_info["plugin_name"],
        },
    )
    avatar_dir = Path(__file__).resolve().parents[2] / "avatars" / "teto"
    save_overrides(avatar_dir, overrides)

    print("[SMOKE-PASS] complete")
    print(f"[SMOKE-PASS] body_sway_strategy decided: {overrides.body_sway_strategy}")
    print(f"[SMOKE-PASS] proxy_body_param: {overrides.proxy_body_param or 'none'}")
    print(f"[SMOKE-PASS] hotkeys discovered: {len(hotkeys)} ({len(hotkeys) - n_meta} llm-emittable)")
    print(f"[SMOKE-PASS] file written: {avatar_dir / 'teto_overrides.yaml'}")

    await client.close()


def main_sync() -> None:
    """Sync entry-point shim invoked by `[project.scripts] teto-smoke-pass`."""

    asyncio.run(main())


if __name__ == "__main__":
    main_sync()
