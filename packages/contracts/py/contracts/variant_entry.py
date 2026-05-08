from pydantic import BaseModel


class VariantEntry(BaseModel):
    code: str
    hotkey_id: str
    source_name: str
    is_placeholder: bool = False
