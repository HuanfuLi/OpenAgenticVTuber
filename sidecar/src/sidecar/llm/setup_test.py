"""POST /admin/llm-test -- verbose SSE-style streaming response for the
LLM Setup screen's [Test connection] button.

Per CONTEXT.md D-10, this MUST issue a real 1-token completion call (not
just /v1/models) because LM Studio's /v1/models returns 200 even when no
model is loaded.

Per Pitfall 15 (RESEARCH.md), set timeout=120 explicitly to absorb LM
Studio's lazy-load latency.

The response is text/plain chunked transfer, NOT text/event-stream -- the
renderer's TestLog uses fetch().body.getReader() to consume line-by-line.

Exception -> user-line mapping table (RESEARCH.md):
    litellm.APIConnectionError    -> "Connection refused at <url>" + 3-step LM Studio guidance
    litellm.AuthenticationError   -> "Authentication failed (HTTP 401). Check the API key..."
    litellm.Timeout               -> "The request timed out after 120 seconds. The model may still be loading..."
    litellm.BadRequestError       -> "Bad request: <detail>"
    litellm.NotFoundError         -> "Model not found at this endpoint. Try blank for auto-detect."
    httpx.ConnectError (preflight)-> "LM Studio doesn't seem to be running." + 3-step guidance (USERFLOW A.2)
    /v1/models 200 with empty data-> "No model is loaded in LM Studio." (USERFLOW A.2)
"""

import logging
import time

import httpx
import litellm
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin")


class TestLLMRequest(BaseModel):
    provider: str  # "lm_studio" or "custom_openai" -- D-06 hosted are dropdown-only
    endpoint_url: str  # e.g. "http://localhost:1234/v1"
    api_key: str = ""
    model_name: str = ""  # empty -> auto-detect (LM Studio only)


@router.post("/llm-test")
async def test_llm(req: TestLLMRequest) -> StreamingResponse:
    async def gen():
        try:
            yield f"▸ Resolving endpoint {req.endpoint_url}...\n"

            # Step 1 -- list models to confirm LM Studio is up + has a model loaded.
            # /v1/models alone is NOT sufficient (D-10) but is a useful pre-flight
            # to give a precise error message before the slower completion call.
            async with httpx.AsyncClient(timeout=5.0) as client:
                try:
                    r = await client.get(f"{req.endpoint_url.rstrip('/')}/models")
                    r.raise_for_status()
                except httpx.ConnectError:
                    # USERFLOW.md A.2 verbatim copy
                    yield "✕ LM Studio doesn't seem to be running.\n"
                    yield "\n"
                    yield "Make sure:\n"
                    yield "   1. LM Studio is open\n"
                    yield "   2. A model is loaded in the chat panel\n"
                    yield '   3. The "Local Server" tab is started (default port 1234)\n'
                    return
                except httpx.HTTPStatusError as e:
                    yield f"✕ Endpoint returned HTTP {e.response.status_code}\n"
                    return
                except httpx.HTTPError as e:
                    yield f"✕ Endpoint unreachable: {e}\n"
                    return

                models = r.json().get("data", [])
                if not models:
                    # USERFLOW.md A.2 verbatim copy for "no model loaded"
                    yield "✕ No model is loaded in LM Studio.\n"
                    yield "\n"
                    yield "Open LM Studio's chat tab, load a model, then Test connection again.\n"
                    return
                model_id = req.model_name or models[0]["id"]
                yield f"▸ GET /v1/models -- 200 OK ({len(models)} model(s); using {model_id})\n"

            # Step 2 -- the real 1-token completion call (D-10).
            yield "▸ POST /v1/chat/completions\n"
            yield '   prompt="hi"  max_tokens=1\n'
            t0 = time.monotonic()

            # LiteLLM 1.83.x -- model name format: lm_studio/<id>
            # api_base is per-call (not env var) so we don't pollute global state
            # during multi-test (user changes provider mid-setup).
            model_arg = (
                f"lm_studio/{model_id}"
                if req.provider == "lm_studio"
                else f"openai/{model_id}"  # Custom OpenAI-compat uses openai/ prefix
            )

            response = await litellm.acompletion(
                model=model_arg,
                api_base=req.endpoint_url,
                api_key=req.api_key or "lm-studio",  # LM Studio accepts any non-empty key
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1,
                timeout=120,  # Pitfall 15 -- LM Studio cold-load can take this long
                stream=False,
            )

            elapsed_ms = int((time.monotonic() - t0) * 1000)
            # Future-proof against a reasoning model emitting <think>...</think>
            # in the 1-token reply. Per CONTEXT.md "Claude's Discretion -> Reasoning-UI scope":
            # parser-strip-only. The full state-machine ships in Phase 2 LLM-03.
            content = response.choices[0].message.content or ""
            # The 1-token reply will not contain <think> in practice. If somehow it did:
            if "<think>" in content:
                yield "▸ (reasoning content stripped)\n"

            yield "▸ Streaming response...\n"
            yield f"✓ Received 1 token in {elapsed_ms} ms\n"
            yield "\n"
            yield "Connection looks good. You can continue.\n"

        except litellm.APIConnectionError:
            yield f"✕ Connection refused at {req.endpoint_url}\n"
            yield "\n"
            yield "Make sure:\n"
            yield "   1. LM Studio is open\n"
            yield "   2. A model is loaded in the chat panel\n"
            yield '   3. The "Local Server" tab is started (default port 1234)\n'
        except litellm.AuthenticationError as e:
            yield "✕ Authentication failed (HTTP 401). Check the API key, then Test connection again.\n"
            yield f"  Detail: {e}\n"
        except litellm.Timeout as e:
            yield "✕ The request timed out after 120 seconds.\n"
            yield "  The model may still be loading -- wait a moment and Test connection again.\n"
            yield f"  Detail: {e}\n"
        except litellm.BadRequestError as e:
            yield f"✕ Bad request: {e}\n"
        except litellm.NotFoundError as e:
            yield f"✕ Model not found at this endpoint. Try blank for auto-detect.\n  Detail: {e}\n"
        except Exception as e:  # noqa: BLE001 -- D-08 mandates verbatim error display
            yield f"✕ {type(e).__name__}: {e}\n"

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")
