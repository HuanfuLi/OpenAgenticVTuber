"""LLMGateway tests -- provider-specific kwargs, cache_control, timeout (Task 3)."""
from sidecar.llm import LLMGateway, ProviderConfig


def _gateway(provider: str) -> LLMGateway:
    return LLMGateway(ProviderConfig(
        provider=provider,
        endpoint="http://localhost:1234/v1",
        api_key="",
        model="qwen2.5-7b-instruct",
    ))


def test_lm_studio_kwargs_have_extra_body():
    g = _gateway("lm_studio")
    kw = g._build_kwargs(messages=[{"role": "user", "content": "hi"}], system_prompt="sys")
    assert kw["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}
    assert "reasoning_effort" not in kw


def test_custom_openai_kwargs_have_extra_body():
    g = _gateway("custom_openai")
    kw = g._build_kwargs(messages=[], system_prompt="sys")
    assert kw["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}


def test_anthropic_kwargs_reasoning_none():
    g = _gateway("anthropic")
    kw = g._build_kwargs(messages=[], system_prompt="sys")
    assert kw["reasoning_effort"] == "none"
    assert "extra_body" not in kw


def test_openai_kwargs_reasoning_minimal():
    g = _gateway("openai")
    kw = g._build_kwargs(messages=[], system_prompt="sys")
    assert kw["reasoning_effort"] == "minimal"


def test_gemini_no_reasoning_kwarg():
    g = _gateway("gemini")
    kw = g._build_kwargs(messages=[], system_prompt="sys")
    assert "reasoning_effort" not in kw
    assert "extra_body" not in kw


def test_system_msg_has_cache_control():
    g = _gateway("anthropic")
    kw = g._build_kwargs(messages=[{"role": "user", "content": "hi"}], system_prompt="sys-prompt")
    sys = kw["messages"][0]
    assert sys["role"] == "system"
    assert isinstance(sys["content"], list)
    assert sys["content"][0]["text"] == "sys-prompt"
    assert sys["content"][0]["cache_control"] == {"type": "ephemeral"}


def test_timeout_is_120():
    g = _gateway("lm_studio")
    kw = g._build_kwargs(messages=[], system_prompt="x")
    assert kw["timeout"] == 120


def test_stream_true():
    g = _gateway("lm_studio")
    kw = g._build_kwargs(messages=[], system_prompt="x")
    assert kw["stream"] is True


def test_lm_studio_model_prefix():
    g = _gateway("lm_studio")
    kw = g._build_kwargs(messages=[], system_prompt="x")
    assert kw["model"].startswith("lm_studio/")


def test_custom_openai_model_prefix():
    g = _gateway("custom_openai")
    kw = g._build_kwargs(messages=[], system_prompt="x")
    assert kw["model"].startswith("openai/")
