from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def teto_dir() -> Path:
    return REPO_ROOT / "Live2D" / "重音テト"


@pytest.fixture
def mao_pro_dir() -> Path:
    return REPO_ROOT / "Live2D" / "mao_pro" / "runtime"


@pytest.fixture
def shizuku_dir() -> Path:
    return REPO_ROOT / "Live2D" / "shizuku" / "runtime"


@pytest.fixture
def olvt_model_dict_path() -> Path:
    return Path(r"C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json")
