"""Wave-0 LiteLLM extra_body passthrough smoke test (RESEARCH.md Q1, Pitfall 1).

Verifies that `litellm.acompletion(extra_body={"chat_template_kwargs":
{"enable_thinking": False}})` is actually delivered to LM Studio's underlying
llama.cpp chat template renderer for Qwen3-Reasoning / DeepSeek-R1 distill
classes of model.

This test is OPT-IN -- set SIDECAR_SMOKE_LMSTUDIO=1 in env. It requires LM Studio
running on localhost:1234 with a reasoning-class model loaded. CI does NOT run
this; the operator runs it once during 02-01 and records the outcome in
PROVENANCE.md. If the assertion fails, fall back to system-prompt instruction
(brittle -- see Pitfall 1 recovery path) and document the limitation.
"""

import os
import httpx
import pytest
import litellm

SMOKE_GATE = os.environ.get("SIDECAR_SMOKE_LMSTUDIO") == "1"
LM_STUDIO_BASE = os.environ.get("LMSTUDIO_BASE", "http://localhost:1234/v1")


def _lm_studio_reachable() -> bool:
    try:
        with httpx.Client(timeout=2.0) as c:
            r = c.get(f"{LM_STUDIO_BASE.rstrip('/')}/models")
            return r.status_code == 200 and bool(r.json().get("data"))
    except Exception:  # noqa: BLE001
        return False


@pytest.mark.skipif(not SMOKE_GATE, reason="set SIDECAR_SMOKE_LMSTUDIO=1 to run")
@pytest.mark.skipif(not _lm_studio_reachable(), reason="LM Studio not reachable")
@pytest.mark.asyncio
async def test_extra_body_disables_think_block():
    """Q1 smoke: extra_body.chat_template_kwargs.enable_thinking=False
    must suppress <think> blocks on a reasoning-class model.
    """
    # Use the first available model -- operator should load a Qwen3-Reasoning
    # or DeepSeek-R1 distill before running this.
    with httpx.Client(timeout=5.0) as c:
        models = c.get(f"{LM_STUDIO_BASE.rstrip('/')}/models").json()["data"]
    model_id = models[0]["id"]

    response = await litellm.acompletion(
        model=f"lm_studio/{model_id}",
        api_base=LM_STUDIO_BASE,
        api_key="lm-studio",
        messages=[{"role": "user", "content": "What is 2+2? Answer in one sentence."}],
        max_tokens=200,
        timeout=120,
        stream=False,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )
    content = response.choices[0].message.content or ""
    assert "<think>" not in content, (
        f"extra_body passthrough FAILED on model {model_id}. "
        f"Response contained <think> block. Recovery: see Pitfall 1 in 02-RESEARCH.md. "
        f"Response head: {content[:300]}"
    )
