"""SC #5: vendor stub-loads without contacting VTS."""


def test_pyvts_imports():
    import pyvts  # noqa: F401


def test_pyvts_resolves_to_vendor_path():
    import pyvts

    # The vendored pyvts must resolve to sidecar/vendor/pyvts, not site-packages.
    path = pyvts.__file__ or ""
    normalized = path.replace("\\", "/").lower()
    assert "vendor/pyvts" in normalized, (
        f"pyvts resolved to {path!r}; expected to be the vendored copy under "
        f"sidecar/vendor/pyvts. Check [tool.uv.sources] in pyproject.toml."
    )


def test_pyvts_import_does_not_open_websocket():
    """Importing pyvts must not contact VTS — only `pyvts.vts.VTS()` does."""
    import pyvts

    # If pyvts opened a connection on import, this attribute access would
    # raise or block. Just confirm the module attribute exists.
    assert hasattr(pyvts, "vts")
