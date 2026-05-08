"""Pydantic source-of-truth -> JSON Schema -> TypeScript codegen.

Mechanical chain (Phase 5 plan 05-01, SC-02):
1. Import each Pydantic model from contracts/py/contracts/.
2. Emit JSON Schema (with our shape-mutation rules applied).
3. Write JSON Schema to packages/contracts/generated/json-schema/{name}.schema.json.
4. Invoke `npx --yes json-schema-to-typescript` per schema.
5. Post-process the TS output (inline aliases, dedup cross-file types, append guards).
6. Write to packages/contracts/ts/{name}.ts (overwrites hand-written mirrors).
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages/contracts/py"))

from pydantic import TypeAdapter  # noqa: E402
from contracts import (  # noqa: E402
    ActionIntent,
    DefaultPluginActionBinding,
    AudioPayloadMessage,
    AvatarImportPlan,
    AvatarOverrides,
    DiscreteEvent,
    EventEntry,
    ParamFrame,
    RigCapabilities,
    SpeechEnvelopePayload,
    VariantEntry,
    WSMessage,
)

SCHEMA_DIR = REPO_ROOT / "packages/contracts/generated/json-schema"
TS_DIR = REPO_ROOT / "packages/contracts/ts"
PY_SOURCE_REL = "packages/contracts/py/contracts"

TARGETS = [
    (ActionIntent, "action-intent", "action_intent", "ActionIntent"),
    (DefaultPluginActionBinding, "action-binding", "action_binding", "DefaultPluginActionBinding"),
    (AudioPayloadMessage, "audio-payload", "audio_payload", "AudioPayloadMessage"),
    (SpeechEnvelopePayload, "speech-envelope", "speech_envelope", "SpeechEnvelopePayload"),
    (ParamFrame, "param-frame", "param_frame", "ParamFrame"),
    (DiscreteEvent, "discrete-event", "discrete_event", "DiscreteEvent"),
    (VariantEntry, "variant-entry", "variant_entry", "VariantEntry"),
    (EventEntry, "event-entry", "event_entry", "EventEntry"),
    (AvatarOverrides, "avatar-overrides", "avatar_overrides", "AvatarOverrides"),
    (RigCapabilities, "rig-capabilities", "rig_capabilities", "RigCapabilities"),
    (AvatarImportPlan, "avatar-import-plan", "avatar_import_plan", "AvatarImportPlan"),
    (WSMessage, "ws-message", "ws_message", "WSMessage"),
]

OWNER_FILE = {
    "ActionIntent": "action-intent",
    "DefaultPluginActionBinding": "action-binding",
    "AudioPayloadMessage": "audio-payload",
    "DisplayTextField": "audio-payload",
    "SpeechEnvelopePayload": "speech-envelope",
    "ParamFrame": "param-frame",
    "ParamMode": "param-frame",
    "DiscreteEvent": "discrete-event",
    "VariantEntry": "variant-entry",
    "EventEntry": "event-entry",
    "Voice": "avatar-overrides",
    "ParamProbeResult": "avatar-overrides",
    "DiscoveredHotkey": "avatar-overrides",
    "AvatarOverrides": "avatar-overrides",
    "Expression": "rig-capabilities",
    "Hotkey": "rig-capabilities",
    "RigCapabilities": "rig-capabilities",
    "ImportWarning": "avatar-import-plan",
    "AvatarImportPlan": "avatar-import-plan",
}

GUARD_NAMES = {
    "text-input": "isTextInput",
    "display-text": "isDisplayText",
    "shutdown": "isShutdown",
    "audio": "isAudioPayload",
    "control": "isControl",
    "full-text": "isFullText",
    "force-new-message": "isForceNewMessage",
    "error": "isError",
    "log": "isLog",
}


def force_required(schema: dict[str, Any]) -> None:
    """Mutate schema in place so defaulted wire fields stay required in TS."""
    if not isinstance(schema, dict):
        return

    props = schema.get("properties")
    if isinstance(props, dict):
        required = set(schema.get("required", []))
        for name, prop in props.items():
            if not isinstance(prop, dict):
                continue
            if "const" in prop:
                required.add(name)
            if "default" in prop:
                required.add(name)
            if any(
                isinstance(branch, dict) and branch.get("type") == "null"
                for branch in prop.get("anyOf", [])
            ):
                required.add(name)
        if required:
            schema["required"] = sorted(required)

    for value in schema.values():
        if isinstance(value, dict):
            force_required(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    force_required(item)


def emit_schema(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_json_schema"):
        schema = model.model_json_schema(ref_template="#/$defs/{model}")
    else:
        schema = TypeAdapter(model).json_schema(ref_template="#/$defs/{model}")
    force_required(schema)
    return schema


def run_jsts(schema_path: Path) -> str:
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if npx is None:
        raise RuntimeError("npx not found on PATH; run npm install from the repo root")
    cmd = [
        npx,
        "--yes",
        "json-schema-to-typescript",
        "--bannerComment",
        "",
        "--additionalProperties",
        "false",
        str(schema_path),
    ]
    proc = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return proc.stdout


def post_process(ts: str) -> str:
    ts = ts.replace("\r\n", "\n")
    ts = ts.replace("export type WsMessageSchema =", "export type WSMessage =")
    ts = ts.replace("[unknown, unknown]", "[number, number]")
    ts = re.sub(r'"([^"]+)"', r"'\1'", ts)
    ts = inline_aliases(ts)
    ts = re.sub(r"\n{3,}", "\n\n", ts)
    ts = ts.replace("export type WSMessage =\n  |", "export type WSMessage =")
    ts = re.sub(r"\n +\|", "\n  |", ts)
    ts = re.sub(r";\n}", "\n}", ts)
    ts = re.sub(r"(\w+)\?:", r"\1:", ts)
    return ts.strip() + "\n"


def inline_aliases(ts: str) -> str:
    aliases: dict[str, str] = {}
    for match in re.finditer(r"^export type (\w+) = ([^;\n]+);$", ts, flags=re.MULTILINE):
        name, value = match.groups()
        if name in {"WSMessage", "ParamMode"}:
            continue
        aliases[name] = value

    for name in sorted(aliases, key=len, reverse=True):
        ts = re.sub(rf"^export type {re.escape(name)} = [^;\n]+;\n", "", ts, flags=re.MULTILINE)

    changed = True
    while changed:
        changed = False
        for name, value in sorted(aliases.items(), key=lambda item: len(item[0]), reverse=True):
            next_ts = re.sub(rf"\b{re.escape(name)}\b", value, ts)
            if next_ts != ts:
                ts = next_ts
                changed = True
    return ts


def declaration_pattern(name: str) -> re.Pattern[str]:
    return re.compile(
        rf"\n?export (?:interface|type) {re.escape(name)}[\s\S]*?(?=\nexport (?:interface|type|const) |\Z)"
    )


def dedup_cross_file(ts_by_file: dict[str, str]) -> dict[str, str]:
    result = dict(ts_by_file)
    for type_name in sorted(OWNER_FILE):
        owner = OWNER_FILE[type_name]
        owner_path = f"./{owner}"
        pattern = declaration_pattern(type_name)
        for file_name in sorted(result):
            if file_name == owner:
                continue
            if not pattern.search(result[file_name]):
                continue
            result[file_name] = pattern.sub("\n", result[file_name]).strip() + "\n"
            if re.search(rf"\b{re.escape(type_name)}\b", result[file_name]):
                result[file_name] = ensure_import(result[file_name], type_name, owner_path)
    return result


def ensure_import(ts: str, type_name: str, owner_path: str) -> str:
    import_line = f"import type {{ {type_name} }} from '{owner_path}';"
    if import_line in ts:
        return ts
    existing = re.compile(rf"import type \{{ ([^}}]+) \}} from '{re.escape(owner_path)}';")
    match = existing.search(ts)
    if match:
        names = sorted({name.strip() for name in match.group(1).split(",")} | {type_name})
        return existing.sub(f"import type {{ {', '.join(names)} }} from '{owner_path}';", ts)
    return f"{import_line}\n{ts}"


def emit_guards(mapping: dict[str, str]) -> str:
    lines = ["\n"]
    for literal in [
        "text-input",
        "display-text",
        "shutdown",
        "audio",
        "control",
        "full-text",
        "force-new-message",
        "error",
        "log",
    ]:
        ref = mapping.get(literal, "")
        type_name = ref.rsplit("/", 1)[-1]
        guard = GUARD_NAMES[literal]
        lines.extend(
            [
                f"export const {guard} = (message: WSMessage): message is {type_name} =>",
                f"  message.type === '{literal}';",
                "",
            ]
        )
    return "\n".join(lines)


def banner(py_name: str) -> str:
    source = f"{PY_SOURCE_REL}/{py_name}.py"
    return (
        f"// GENERATED FROM {source} - do not edit;\n"
        "// run packages/contracts/codegen.sh to regenerate.\n\n"
    )


def write_schema(schema_path: Path, schema: dict[str, Any]) -> None:
    schema_path.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    TS_DIR.mkdir(parents=True, exist_ok=True)

    schemas: dict[str, dict[str, Any]] = {}
    ts_by_file: dict[str, str] = {}
    py_names: dict[str, str] = {}

    for model, ts_name, py_name, primary in TARGETS:
        schema = emit_schema(model)
        schemas[ts_name] = schema
        py_names[ts_name] = py_name
        schema_path = SCHEMA_DIR / f"{ts_name}.schema.json"
        write_schema(schema_path, schema)
        ts = post_process(run_jsts(schema_path))
        if primary == "WSMessage":
            ts += emit_guards(schema.get("discriminator", {}).get("mapping", {}))
        ts_by_file[ts_name] = ts

    ts_by_file = dedup_cross_file(ts_by_file)

    for ts_name in [target[1] for target in TARGETS]:
        if ts_name == "param-frame" and "export type ParamMode" not in ts_by_file[ts_name]:
            ts_by_file[ts_name] = "export type ParamMode = 'add' | 'set';\n\n" + ts_by_file[ts_name]
        if ts_name == "ws-message":
            ts_by_file[ts_name] = ensure_import(ts_by_file[ts_name], "ActionIntent", "./action-intent")
            ts_by_file[ts_name] = ensure_import(ts_by_file[ts_name], "DisplayTextField", "./audio-payload")
        out_path = TS_DIR / f"{ts_name}.ts"
        out_path.write_text(banner(py_names[ts_name]) + ts_by_file[ts_name].strip() + "\n", encoding="utf-8")
        print(f"[codegen] wrote {out_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
