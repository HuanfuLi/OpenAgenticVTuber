from __future__ import annotations

import json
import os

from loguru import logger

from contracts import AudioConfig


AUDIO_CONFIG_ENV = "AGENTICLLMVTUBER_AUDIO_CONFIG_JSON"


def default_audio_config() -> AudioConfig:
    return AudioConfig()


def load_audio_config_from_env() -> AudioConfig:
    raw = os.environ.get(AUDIO_CONFIG_ENV)
    if not raw:
        return default_audio_config()
    try:
        return AudioConfig.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning(
            "[AUDIO-CONFIG] invalid {}: {}; falling back to default Piper config.",
            AUDIO_CONFIG_ENV,
            exc,
        )
        return default_audio_config()
