"""TTS package — Phase 3."""

from .tts_gateway import TTSGateway, build_tts_gateway
from .tts_manager import TTSTaskManager
from .provider import TTSProvider, TTSSynthesisRequest, TTSSynthesisResult, TTSProviderError
from .piper_provider import PiperTTSProvider
from .gpt_sovits_provider import GptSoVitsProvider

__all__ = [
    "PiperTTSProvider",
    "GptSoVitsProvider",
    "TTSGateway",
    "build_tts_gateway",
    "TTSTaskManager",
    "TTSProvider",
    "TTSProviderError",
    "TTSSynthesisRequest",
    "TTSSynthesisResult",
]
