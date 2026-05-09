"""contracts package -- Pydantic source-of-truth for cross-language WS envelopes."""
from .action_binding import DefaultPluginActionBinding
from .dispatch import ActionCode, Dispatch, EventFire, VariantToggle
from .speech_envelope import SpeechEnvelopePayload
from .audio_payload import AudioPayloadMessage, DisplayTextField
from .audio_provider import (
    AudioConfig,
    AudioHealthState,
    AudioProviderHealth,
    AudioProviderId,
    AudioProviderKind,
    FutureTTSProviderConfig,
    PiperTTSConfig,
    STTProviderConfig,
    TTSProviderConfig,
)
from .discrete_event import DiscreteEvent
from .param_frame import ParamFrame, ParamMode
from .variant_entry import VariantEntry
from .event_entry import EventEntry
from .avatar_overrides import (
    AvatarOverrides,
    BodySwayStrategyName,
    DiscoveredHotkey,
    ParamProbeResult,
    Voice,
)
from .hud_message import (
    HudClearLockMessage,
    HudLockConfirmedMessage,
    HudLockRejectedMessage,
    HudMessageC2S,
    HudMessageS2C,
    HudParamFrameMessage,
    HudSetLockMessage,
)
from .rig_capabilities import Expression, Hotkey, RigCapabilities
from .avatar_import_plan import AvatarImportPlan, ImportWarning
from .ws_message import (
    TextInputMessage,
    DisplayTextMessage,
    ShutdownMessage,
    ControlMessage,
    FullTextMessage,
    ForceNewMessageMessage,
    ErrorMessage,
    LogMessage,
    WSMessage,
)

__all__ = [
    "ActionCode",
    "VariantToggle",
    "EventFire",
    "Dispatch",
    "DefaultPluginActionBinding",
    "SpeechEnvelopePayload",
    "AudioPayloadMessage",
    "DisplayTextField",
    "AudioConfig",
    "AudioHealthState",
    "AudioProviderHealth",
    "AudioProviderId",
    "AudioProviderKind",
    "FutureTTSProviderConfig",
    "PiperTTSConfig",
    "STTProviderConfig",
    "TTSProviderConfig",
    "DiscreteEvent",
    "ParamFrame",
    "ParamMode",
    "VariantEntry",
    "EventEntry",
    "AvatarOverrides",
    "BodySwayStrategyName",
    "DiscoveredHotkey",
    "ParamProbeResult",
    "Voice",
    "Expression",
    "Hotkey",
    "RigCapabilities",
    "AvatarImportPlan",
    "ImportWarning",
    "HudParamFrameMessage",
    "HudLockConfirmedMessage",
    "HudLockRejectedMessage",
    "HudSetLockMessage",
    "HudClearLockMessage",
    "HudMessageS2C",
    "HudMessageC2S",
    "TextInputMessage",
    "DisplayTextMessage",
    "ShutdownMessage",
    "ControlMessage",
    "FullTextMessage",
    "ForceNewMessageMessage",
    "ErrorMessage",
    "LogMessage",
    "WSMessage",
]
