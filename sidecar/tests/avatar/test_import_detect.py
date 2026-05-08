from sidecar.avatar.import_detect import AvatarType, detect_type, is_cubism_5_3_moc


def test_olvt(tmp_path) -> None:
    (tmp_path / "model_dict.json").write_text("[]", encoding="utf-8")
    (tmp_path / "also.vtube.json").write_text("{}", encoding="utf-8")

    assert detect_type(tmp_path) == AvatarType.OLVT


def test_teto_is_vts(teto_dir) -> None:
    assert detect_type(teto_dir) == AvatarType.VTS_STANDARD


def test_mao_pro_named(mao_pro_dir) -> None:
    assert detect_type(mao_pro_dir) == AvatarType.CUBISM_WITH_EXPRESSIONS


def test_shizuku_bare(shizuku_dir) -> None:
    assert detect_type(shizuku_dir) == AvatarType.CUBISM_BARE


def test_cubism_5_3(tmp_path) -> None:
    moc = tmp_path / "fake.moc3"
    moc.write_bytes(b"MOC3\x06\x00\x00\x00" + b"\x00" * 56)
    (tmp_path / "fake.model3.json").write_text("{}", encoding="utf-8")

    assert is_cubism_5_3_moc(moc)
    assert detect_type(tmp_path) == AvatarType.UNSUPPORTED_CUBISM_5_3


def test_cubism_5_2_ok(tmp_path) -> None:
    moc = tmp_path / "fake.moc3"
    moc.write_bytes(b"MOC3\x05\x00\x00\x00" + b"\x00" * 56)
    (tmp_path / "fake.model3.json").write_text("{}", encoding="utf-8")

    assert not is_cubism_5_3_moc(moc)
    assert detect_type(tmp_path) == AvatarType.CUBISM_BARE


def test_no_model3(tmp_path) -> None:
    assert detect_type(tmp_path) == AvatarType.UNSUPPORTED_NO_MODEL3
