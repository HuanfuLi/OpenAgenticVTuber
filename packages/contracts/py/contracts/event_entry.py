from pydantic import BaseModel


class EventEntry(BaseModel):
    code: str
    hotkey_id: str = ""
    motion_file: str
    duration_seconds: float
    duration_is_fallback: bool = False
    is_loop: bool = False
    is_placeholder: bool = False
