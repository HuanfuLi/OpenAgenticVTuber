"""OLVT-shape audio envelope (server -> client).

OLVT-canonical naming (verbatim from
OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py:50-60):
    type:"audio"  (NOT "audio-payload")
    audio:str|None  (base64 string in Phase 3, None in Phase 2; NOT "audio_b64")

Phase-2 extension over OLVT (documented divergence per Discrepancy 4):
    sentence_id:int -- needed for sentence-trace logs (UI-SPEC IP-5).

Per Phase 7 D-A4, the `dispatches` field carries ordered Dispatch records
instead of OLVT's Actions{expressions,pictures,sounds} dataclass.
"""
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel
from .dispatch import Dispatch
from .audio_provider import AudioHealthState, AudioProviderId


class DisplayTextField(BaseModel):
    """Mirrors OLVT DisplayText.to_dict() -- see output_types.py:36-39."""
    text: str
    name: str = "Teto"
    avatar: str = "teto"


class FailedAudioMetadata(BaseModel):
    provider_id: AudioProviderId
    state: AudioHealthState
    summary: str
    retryable: bool = False
    redacted_diagnostics: Optional[Dict[str, str]] = None


class AudioPayloadMessage(BaseModel):
    type: Literal["audio"] = "audio"
    audio: Optional[str] = None      # base64 wav in live paths; None only in explicit no-TTS tests
    volumes: List[float] = []        # filled in Phase 3 from RMS envelope
    slice_length: int = 20           # OLVT default chunk_length_ms
    display_text: DisplayTextField
    dispatches: List[Dispatch] = []
    sentence_id: int                 # Phase-2 extension (Discrepancy 4)
    forwarded: bool = False          # OLVT broadcast flag; always False in skeleton
    failed_audio: Optional[FailedAudioMetadata] = None
