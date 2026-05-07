from pathlib import Path


def test_phase4_contract_exports_and_bootstrap_hook():
    from contracts import DiscreteEvent, ParamFrame, ParamMode

    frame = ParamFrame(
        add_params={"ParamAngleX": 1.0},
        set_params={"ParamMouthOpenY": (0.5, 1.0)},
        tick_n=1,
        emitted_at_monotonic=0.0,
    )
    event = DiscreteEvent(hotkey_id="abc", name="Star Eye [7]", triggered_at=0.0)

    assert ParamMode.__args__ == ("add", "set")
    assert frame.add_params["ParamAngleX"] == 1.0
    assert event.hotkey_id == "abc"

    main_lines = (
        Path(__file__).resolve().parents[1] / "src" / "sidecar" / "__main__.py"
    ).read_text(encoding="utf-8").splitlines()
    assert any("if sys.platform == \"win32\":" in line for line in main_lines[:15])
    assert any(
        "ctypes.windll.shcore.SetProcessDpiAwareness(2)" in line
        for line in main_lines[:20]
    )
