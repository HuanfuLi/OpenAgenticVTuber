"""Voice preset and reference-audio contracts for GPT-SoVITS-era TTS."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .audio_provider import GptSoVitsLanguage


class GptSoVitsPresetConfig(BaseModel):
    reference_audio_id: Optional[str] = None
    prompt_text: str = ""
    prompt_lang: GptSoVitsLanguage = "ja"
    text_lang: GptSoVitsLanguage = "ja"
    gpt_weights_path: Optional[str] = None
    sovits_weights_path: Optional[str] = None
    top_k: int = Field(default=15, ge=1)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    temperature: float = Field(default=1.0, ge=0.0)
    text_split_method: str = "cut5"
    batch_size: int = Field(default=1, ge=1)
    speed_factor: float = Field(default=1.0, gt=0.0)
    repetition_penalty: float = Field(default=1.35, ge=0.0)
    media_type: Literal["wav"] = "wav"
    streaming_mode: bool = False


class GptSoVitsPresetValidation(BaseModel):
    state: Literal["validated", "needs_test", "changed"] = "needs_test"
    fingerprint: str = Field(min_length=1)
    validated_at: str = Field(min_length=1)
    health_checked_at: Optional[str] = None
    test_synthesis_at: Optional[str] = None
    summary: Optional[str] = None


class VoicePreset(BaseModel):
    preset_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    provider_id: Literal["piper", "gpt_sovits"] = "piper"
    piper_voice_model: Optional[str] = None
    gpt_sovits: GptSoVitsPresetConfig = GptSoVitsPresetConfig()
    validation: Optional[GptSoVitsPresetValidation] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ReferenceAudioAsset(BaseModel):
    asset_id: str = Field(min_length=1)
    managed_path_token: str = Field(min_length=1)
    display_basename: str = Field(min_length=1)
    duration_ms: int = Field(ge=1)
    format: Literal["wav", "flac", "mp3", "ogg", "m4a"]
    transcript_text: str = Field(min_length=1)
    language: GptSoVitsLanguage

    @field_validator("managed_path_token")
    @classmethod
    def managed_path_token_is_relative(cls, value: str) -> str:
        normalized = value.replace("\\", "/")
        if normalized.startswith("/") or ":" in normalized or ".." in normalized.split("/"):
            raise ValueError("managed_path_token must be a relative sanitized app-managed token")
        return normalized


class ActivePresetAssociation(BaseModel):
    scope: Literal["global", "avatar", "session", "avatar_session"] = "global"
    preset_id: str = Field(min_length=1)
    avatar_id: Optional[str] = None
    session_id: Optional[str] = None


class VoicePresetLibrary(BaseModel):
    schema_version: Literal[1] = 1
    presets: list[VoicePreset] = []
    reference_audio_assets: list[ReferenceAudioAsset] = []
    active_associations: list[ActivePresetAssociation] = []
