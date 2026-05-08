from pydantic import BaseModel


class EventEntry(BaseModel):
    code: str
    motion_file: str
    duration_seconds: float
    is_loop: bool = False
    is_placeholder: bool = False
