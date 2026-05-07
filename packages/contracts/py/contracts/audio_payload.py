"""OLVT-shape audio envelope (server -> client).

OLVT-canonical naming (verbatim from
OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py:50-60):
    type:"audio"  (NOT "audio-payload")
    audio:str|None  (base64 string in Phase 3, None in Phase 2; NOT "audio_b64")

Phase-2 extension over OLVT (documented divergence per Discrepancy 4):
    sentence_id:int -- needed for [STUB-TTS]/sentence-trace logs (UI-SPEC IP-5).

Per CONTEXT.md D-02 and D-12, the `actions` field carries our ActionIntent[]
instead of OLVT's Actions{expressions,pictures,sounds} dataclass.
"""
from typing import List, Literal, Optional
from pydantic import BaseModel
from .action_intent import ActionIntent


class DisplayTextField(BaseModel):
    """Mirrors OLVT DisplayText.to_dict() -- see output_types.py:36-39."""
    text: str
    name: str = "Teto"
    avatar: str = "teto"


class AudioPayloadMessage(BaseModel):
    type: Literal["audio"] = "audio"
    audio: Optional[str] = None      # base64 wav in Phase 3; None in Phase 2 stub
    volumes: List[float] = []        # filled in Phase 3 from RMS envelope
    slice_length: int = 20           # OLVT default chunk_length_ms
    display_text: DisplayTextField
    actions: List[ActionIntent] = []
    sentence_id: int                 # Phase-2 extension (Discrepancy 4)
    forwarded: bool = False          # OLVT broadcast flag; always False in skeleton
