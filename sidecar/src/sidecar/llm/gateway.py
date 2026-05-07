"""LiteLLM streaming gateway -- Phase 2 D-21, D-22, D-19, D-10.

Wraps `litellm.acompletion(stream=True)` with:
  - Provider-specific reasoning-disable kwargs (D-10):
      lm_studio / custom_openai -> extra_body.chat_template_kwargs.enable_thinking=False
      anthropic                 -> reasoning_effort="none"
      openai                    -> reasoning_effort="minimal"  (o1/o3; ignored by 4o-class)
      gemini                    -> no flag
  - cache_control marker on system slot (D-19) -- Anthropic prompt cache; ignored by other providers
  - 120s timeout (LLM-01) -- absorbs LM Studio cold-start (Pitfall 5/15)
  - Provider snapshot loaded once at boot (D-22) -- mid-session changes need restart

Reference RESEARCH.md §Code Examples Example 3.
"""
from dataclasses import dataclass
from typing import AsyncIterator
import litellm


@dataclass
class ProviderConfig:
    """Mirrors the safeStorage StoredConfig payload Phase 1 ships."""
    provider: str           # "lm_studio" | "custom_openai" | "openai" | "anthropic" | "gemini"
    endpoint: str           # e.g. "http://localhost:1234/v1"
    api_key: str = ""       # may be empty for LM Studio
    model: str = ""         # may be empty -> caller resolves


class LLMGateway:
    """Stateless wrapper around litellm.acompletion(stream=True). One instance
    per orchestrator; provider snapshot frozen at construction (D-22).
    """

    def __init__(self, provider_config: ProviderConfig):
        self._provider = provider_config

    def _build_model_string(self) -> str:
        # LiteLLM provider-prefix routing (Phase 1 setup_test.py established):
        #   lm_studio/<id>   -> LM Studio
        #   openai/<id>      -> custom OpenAI-compat OR real OpenAI
        #   anthropic/<id>   -> Anthropic
        #   gemini/<id>      -> Google Gemini
        p = self._provider.provider
        m = self._provider.model or "auto"
        if p == "lm_studio":
            return f"lm_studio/{m}"
        if p in ("custom_openai", "openai"):
            return f"openai/{m}"
        if p == "anthropic":
            return f"anthropic/{m}"
        if p == "gemini":
            return f"gemini/{m}"
        # Fallback -- let LiteLLM raise a clear error.
        return f"{p}/{m}"

    def _build_kwargs(self, messages: list[dict], system_prompt: str) -> dict:
        """Build the kwargs dict for litellm.acompletion. Centralized so tests
        can introspect without invoking the network.
        """
        # System message with cache_control on system slot (D-19). The content
        # array form is required to attach cache_control per Anthropic's
        # prompt-caching API; LiteLLM forwards as-is. Other providers accept
        # either string-content or array-content; the array form is universal.
        system_msg = {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},  # Anthropic; others ignore
                }
            ],
        }

        kwargs: dict = {
            "model": self._build_model_string(),
            "messages": [system_msg, *messages],
            "api_base": self._provider.endpoint,
            "api_key": self._provider.api_key or "lm-studio",  # LM Studio accepts any non-empty
            "stream": True,
            "timeout": 120,  # LLM-01 / Pitfall 5
        }

        # D-10 provider-specific reasoning-disable.
        p = self._provider.provider
        if p in ("lm_studio", "custom_openai"):
            # Pitfall 1: this is the riskiest path -- verified in Wave-0 smoke
            # test. If passthrough is broken, fall back to system-prompt
            # instruction (recorded in PROVENANCE.md by operator).
            kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}
        elif p == "anthropic":
            kwargs["reasoning_effort"] = "none"
        elif p == "openai":
            # OpenAI o1/o3 only; non-reasoning OpenAI models ignore harmlessly.
            kwargs["reasoning_effort"] = "minimal"
        # Gemini: no native reasoning to disable.

        return kwargs

    async def stream(
        self, messages: list[dict], system_prompt: str
    ) -> AsyncIterator[str]:
        """Yield text deltas from a streaming completion call.

        Errors are propagated to the caller -- Orchestrator.turn translates
        them into ErrorMessage envelopes (D-16 ContextWindowExceededError
        retry-once; generic Exception -> STREAM_ERROR banner).
        """
        kwargs = self._build_kwargs(messages, system_prompt)
        async for chunk in await litellm.acompletion(**kwargs):
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta
