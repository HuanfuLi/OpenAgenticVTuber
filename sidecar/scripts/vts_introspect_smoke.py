"""Manual VTube Studio introspection smoke test for Phase 8."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pyvts


TOKEN_PATH = Path(__file__).resolve().parents[1] / ".vts_token.txt"


class SmokeAssertionError(AssertionError):
    pass


def _assert(condition: bool, message: str, payload) -> None:
    if not condition:
        raise SmokeAssertionError(f"{message}: {payload!r}")


async def main() -> int:
    plugin_info = {
        "plugin_name": "AgenticLLMVTuber Phase 8 Introspection Smoke",
        "developer": "AgenticLLMVTuber",
        "authentication_token_path": str(TOKEN_PATH),
    }
    client = pyvts.vts(plugin_info=plugin_info)
    try:
        await client.connect()
        await client.request_authenticate_token()
        await client.request_authenticate()

        api_state = await client.request(client.vts_request.BaseRequest("APIStateRequest"))
        _assert("data" in api_state, "APIStateRequest missing data", api_state)

        hotkey_resp = await client.request(client.vts_request.requestHotKeyList())
        hotkeys = hotkey_resp.get("data", {}).get("availableHotkeys")
        _assert(isinstance(hotkeys, list), "HotkeyList availableHotkeys is not a list", hotkey_resp)
        _assert(bool(hotkeys), "HotkeyList returned no hotkeys", hotkey_resp)
        first_hotkey = hotkeys[0]
        _assert({"name", "type", "hotkeyID"}.issubset(first_hotkey), "Hotkey entry shape mismatch", first_hotkey)

        param_resp = await client.request(client.vts_request.requestTrackingParameterList())
        params = param_resp.get("data", {}).get("customParameters", []) + param_resp.get("data", {}).get(
            "defaultParameters", []
        )
        _assert(isinstance(params, list), "ParameterList params is not a list", param_resp)
        _assert(bool(params), "ParameterList returned no params", param_resp)
        _assert("name" in params[0], "Parameter entry shape mismatch", params[0])

        print('[SMOKE] PASS: pyvts 0.3.3 + VTS API "1.0" introspection shape verified')
        return 0
    except (ConnectionRefusedError, OSError) as exc:
        print(f"[SMOKE] VTube Studio connection refused. Is VTube Studio running? ({exc})")
        return 3
    except SmokeAssertionError as exc:
        print(f"[SMOKE] FAIL: {exc}")
        return 2
    finally:
        try:
            await client.close()
        except Exception:
            pass


def main_sync() -> None:
    raise SystemExit(asyncio.run(main()))


if __name__ == "__main__":
    main_sync()
