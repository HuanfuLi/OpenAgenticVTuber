"""Orchestrator -- Phase 2 conversation pipeline owner.

Responsibilities:
  - Holds append-only `_memory: list[dict]` (CONTEXT D-18, D-19).
  - Holds forward-only `_head_idx: int` for KV-cache-aware pruning (D-19).
  - Holds bytes-identical `_system_prompt` built once at __init__ (D-17, Pitfall 6).
  - turn(user_text, ws): emits OLVT-canonical envelope sequence per OLVT
    conversation_utils.py:138-204 (chain-start -> full-text 'Thinking...' ->
    audio* per sentence -> force-new-message -> chain-end).
  - On ContextWindowExceededError: aggressive prune + retry once (D-16).
  - On generic exception: emit STREAM_ERROR.

KV-cache discipline (Warning A precision):
  - `_memory` is APPEND-ONLY. No pop / del / insert / remove / clear.
  - The consumed prefix advances ONLY by integer `_head_idx` increments.
  - Failed user messages REMAIN in `_memory`; the next turn's
    `_compute_send_window` prunes them naturally via forward-only `_head_idx`.

Source: see RESEARCH.md Example 2; PROVENANCE.md attributes the OLVT shape.
"""
from itertools import count
from typing import AsyncIterator

from fastapi import WebSocket
from litellm.exceptions import ContextWindowExceededError
from loguru import logger

from contracts import AudioPayloadMessage, DisplayTextField
from sidecar.avatar.capabilities import AvatarCapabilities
from sidecar.llm.gateway import LLMGateway
from sidecar.ws.emit import (
    emit_audio_payload,
    emit_chain_end,
    emit_chain_start,
    emit_error,
    emit_force_new_message,
    emit_full_text,
)

from .output_types import SentenceOutput
from .prompt_loader import load_util
from .transformers import (
    actions_extractor,
    display_processor,
    sentence_divider,
    tts_filter,
)
from .tts_preprocessor import TTSPreprocessorConfig


# CHAT.STREAM_ERROR copy (UI-SPEC Copywriting Contract -- match exactly so
# the renderer can match-and-display from the contract).
_STREAM_ERROR_COPY = "The model couldn't finish that reply. Try again."
_CONTEXT_OVERFLOW_COPY = (
    "Conversation got too long and won't fit in the model anymore. "
    "Close the app to start fresh."
)


def _build_system_prompt(
    persona_text: str, capabilities: AvatarCapabilities
) -> str:
    """Persona + utility-prompt append (CONTEXT D-06; OLVT
    service_context.py:436-477 pattern). Bytes-identical at boot per Pitfall 6.
    """
    expression_prompt = load_util("live2d_expression_prompt")
    full_action_str = capabilities.tag_vocabulary()  # "[joy], [cry], ..."
    expression_prompt = expression_prompt.replace(
        "[<insert_action_keys>]", full_action_str
    )
    return persona_text + "\n\n" + expression_prompt


class Orchestrator:
    def __init__(
        self,
        gateway: LLMGateway,
        capabilities: AvatarCapabilities,
        persona_text: str,
        tts_preprocessor_config: TTSPreprocessorConfig | None = None,
    ):
        self._gateway = gateway
        self._capabilities = capabilities
        # SYSTEM PROMPT FROZEN AT BOOT -- D-17, D-19, Pitfall 6.
        # Bytes-identical across all turns of this orchestrator's lifetime.
        self._system_prompt: str = _build_system_prompt(persona_text, capabilities)
        self._memory: list[dict] = []           # APPEND-ONLY -- D-19
        self._head_idx: int = 0                 # FORWARD-ONLY -- D-19
        self._tts_pp = tts_preprocessor_config or TTSPreprocessorConfig()
        self._sentence_counter = count(1)       # sentence_id starts at 1

    async def turn(self, user_text: str, ws: WebSocket) -> None:
        """One turn -- emit OLVT-canonical sequence + thread state mutation."""
        await emit_chain_start(ws)
        await emit_full_text(ws, "Thinking...")  # OLVT conversation_utils.py:143

        # APPEND-ONLY -- D-19. Never .pop(0), never .insert(0,...).
        self._memory.append({"role": "user", "content": user_text})

        send_window = self._compute_send_window()
        assistant_text_accum = ""

        try:
            async for sentence_output in self._run_pipeline(send_window):
                sentence_id = next(self._sentence_counter)
                await self._emit_sentence(ws, sentence_output, sentence_id)
                assistant_text_accum += sentence_output.display_text.text

        except ContextWindowExceededError:
            # D-16: aggressive prune + retry once.
            self._head_idx = max(self._head_idx, len(self._memory) - 8)
            send_window = self._memory[self._head_idx:]
            try:
                async for sentence_output in self._run_pipeline(send_window):
                    sentence_id = next(self._sentence_counter)
                    await self._emit_sentence(ws, sentence_output, sentence_id)
                    assistant_text_accum += sentence_output.display_text.text
            except ContextWindowExceededError:
                # Warning A precision: the failed user message stays in _memory.
                # Popping it would violate the append-only invariant and could
                # invalidate llama.cpp / Anthropic prefix-cache hits on the next
                # turn. _compute_send_window will prune via forward-only
                # _head_idx on the next user turn.
                await emit_error(ws, _CONTEXT_OVERFLOW_COPY)
                await emit_chain_end(ws)
                return

        except Exception:
            # Warning A precision: do NOT pop the failed user message -- see
            # the rationale in the ContextWindowExceededError branch above.
            logger.exception("LLM call failed during orchestrator.turn")
            await emit_error(ws, _STREAM_ERROR_COPY)
            await emit_chain_end(ws)
            return

        # APPEND-ONLY commit of assistant turn.
        self._memory.append(
            {"role": "assistant", "content": assistant_text_accum}
        )

        # Turn seal -- D-04.
        await emit_force_new_message(ws)
        await emit_chain_end(ws)

    async def _emit_sentence(
        self,
        ws: WebSocket,
        sentence_output: SentenceOutput,
        sentence_id: int,
    ) -> None:
        """Emit one audio envelope (audio=null in Phase 2 stub) + log lines."""
        payload = AudioPayloadMessage(
            audio=None,                         # Phase 2 stub -- D-23
            volumes=[],                         # Phase 3 fills
            slice_length=20,                    # OLVT default
            display_text=DisplayTextField(
                text=sentence_output.display_text.text,
                name=sentence_output.display_text.name or "Teto",
                avatar=sentence_output.display_text.avatar or "teto",
            ),
            actions=sentence_output.actions,    # list[ActionIntent]
            sentence_id=sentence_id,
            forwarded=False,
        )
        await emit_audio_payload(ws, payload)

        # Stub-TTS log line -- D-23, surfaces in Logs drawer.
        logger.info(
            f'[STUB-TTS] sentence_id={sentence_id} '
            f'text="{sentence_output.tts_text}"'
        )

        # ActionIntent log lines -- D-14, surfaces in Logs drawer.
        for intent in sentence_output.actions:
            logger.info(
                f"[INTENT] kind={intent.kind} name={intent.name} "
                f"strength={intent.strength} avatar={intent.avatar_id}"
            )

    def _run_pipeline(
        self, send_window: list[dict]
    ) -> AsyncIterator[SentenceOutput]:
        """Build and run the OLVT 4-decorator chain over a token stream."""
        gateway = self._gateway
        system_prompt = self._system_prompt
        capabilities = self._capabilities
        tts_pp = self._tts_pp

        @tts_filter(tts_pp)
        @display_processor()
        @actions_extractor(capabilities)
        @sentence_divider(
            faster_first_response=True,
            segment_method="pysbd",
            valid_tags=[],          # D-20 -- D-10 disables <think> at API level
        )
        async def chat_with_memory() -> AsyncIterator[str]:
            async for delta in gateway.stream(send_window, system_prompt):
                yield delta

        return chat_with_memory()

    def _compute_send_window(self) -> list[dict]:
        """Token-budget pruning at 75% (D-15). Forward-only _head_idx (D-19).
        Falls back to default 8192 if model-context-window is unknown
        (Pitfall 3 -- graceful degradation; D-16 retry covers undercount).
        """
        from litellm import model_cost, token_counter

        model_max = model_cost.get(
            self._gateway._provider.model, {}
        ).get("max_input_tokens", 8192)
        budget = int(model_max * 0.75)
        while True:
            candidate = self._memory[self._head_idx:]
            try:
                tokens = token_counter(
                    model=self._gateway._provider.model,
                    messages=[
                        {"role": "system", "content": self._system_prompt},
                        *candidate,
                    ],
                )
            except Exception:
                # token_counter may fail for unknown models -- fall through and
                # let D-16 retry-once cover any actual context overflow.
                return candidate
            if tokens <= budget or self._head_idx >= len(self._memory) - 2:
                return candidate
            self._head_idx += 2  # drop one turn-pair (user + assistant together)
