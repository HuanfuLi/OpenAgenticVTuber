import json

import pytest


def test_teto(teto_dir) -> None:
    from sidecar.avatar.extractors.vts import extract_vts

    variants, events, warnings = extract_vts(teto_dir)
    codes = [variant.code for variant in variants]
    assert len(variants) == 14
    assert codes == [
        "sv-microphone",
        "sv-utau-baguette",
        "dark-face",
        "dark-eye",
        "blush",
        "heart-eye",
        "star-eye",
        "squint-eye",
        "sv-utau-alt",
        "utau-headphone",
        "chibi",
        "cry",
        "dizzy-eye",
        "remove-water-mark",
    ]
    assert all(len(variant.hotkey_id) == 32 for variant in variants)
    assert events == []
    assert isinstance(warnings, list)


def _write_vtube_hotkey(folder, *, file_name: str = "Motions/Wave.motion3.json") -> None:
    (folder / "avatar.vtube.json").write_text(
        json.dumps(
            {
                "Hotkeys": [
                    {
                        "Action": "TriggerAnimation",
                        "Name": "Wave",
                        "HotkeyID": "hk-event",
                        "File": file_name,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )


def test_trigger_animation_uses_motion3_duration(tmp_path) -> None:
    from contracts import ActionCode, AudioPayloadMessage, Dispatch, EventFire, VariantToggle
    from sidecar.avatar.extractors.vts import extract_vts

    assert ActionCode(name="joy").model_dump() == {"kind": "action", "name": "joy"}
    variant = VariantToggle(name="hold-mic", hotkey_id="hk-1")
    assert variant.kind == "variant"
    assert variant.name == "hold-mic"
    assert variant.hotkey_id == "hk-1"
    event_dispatch = EventFire(name="wave", hotkey_id="hk-2", duration_ms=2833)
    assert event_dispatch.kind == "event"
    assert event_dispatch.duration_ms == 2833
    message = AudioPayloadMessage(
        audio=None,
        display_text={"text": "hi"},
        dispatches=[
            ActionCode(name="joy"),
            VariantToggle(name="hold-mic", hotkey_id="hk-1"),
            event_dispatch,
        ],
        sentence_id=1,
    )
    assert len(message.dispatches) == 3
    assert Dispatch is not None

    _write_vtube_hotkey(tmp_path)
    motion_path = tmp_path / "Motions" / "Wave.motion3.json"
    motion_path.parent.mkdir()
    motion_path.write_text(
        json.dumps({"Meta": {"Duration": 1.833, "Loop": False}}),
        encoding="utf-8",
    )

    variants, events, warnings = extract_vts(tmp_path)

    assert variants == []
    assert warnings == []
    assert len(events) == 1
    event = events[0]
    assert event.code == "wave"
    assert event.hotkey_id == "hk-event"
    assert event.motion_file == "Motions/Wave.motion3.json"
    assert event.duration_seconds == pytest.approx(1.833)
    assert event.duration_is_fallback is False
    assert event.is_loop is False
    duration_ms = int(event.duration_seconds * 1000) + 1000
    assert EventFire(name=event.code, hotkey_id=event.hotkey_id, duration_ms=duration_ms).duration_ms == 2833


@pytest.mark.parametrize(
    ("case_name", "meta_payload"),
    [
        ("missing", None),
        ("unreadable", "directory"),
        ("invalid", "{not json"),
        ("non_numeric", {"Meta": {"Duration": "slow", "Loop": True}}),
        ("nonpositive", {"Meta": {"Duration": 0, "Loop": True}}),
        ("oversized", {"Meta": {"Duration": 10.001, "Loop": True}}),
    ],
)
def test_trigger_animation_fallback_duration_policy(tmp_path, case_name, meta_payload) -> None:
    from contracts import EventFire
    from sidecar.avatar.extractors.vts import extract_vts

    _write_vtube_hotkey(tmp_path)
    motion_path = tmp_path / "Motions" / "Wave.motion3.json"
    motion_path.parent.mkdir()
    if meta_payload is None:
        pass
    elif meta_payload == "directory":
        motion_path.mkdir()
    elif isinstance(meta_payload, str):
        motion_path.write_text(meta_payload, encoding="utf-8")
    else:
        motion_path.write_text(json.dumps(meta_payload), encoding="utf-8")

    _, events, _ = extract_vts(tmp_path)

    assert len(events) == 1, case_name
    event = events[0]
    assert event.duration_seconds == 10.0
    assert event.duration_is_fallback is True
    assert event.is_loop is False
    assert EventFire(name=event.code, hotkey_id=event.hotkey_id, duration_ms=10000).duration_ms == 10000
