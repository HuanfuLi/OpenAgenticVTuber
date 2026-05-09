from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
from fastapi import WebSocket
from loguru import logger

from contracts import AudioPayloadMessage, Dispatch, DisplayTextField, FailedAudioMetadata, SpeechEnvelopePayload

from .audio_payload_helpers import prepare_payload_from_pcm, synthesize_and_prepare_payload
from .provider import TTSProvider, TTSProviderError, TTSSynthesisRequest


_WHITESPACE_ONLY_RE = re.compile(r"[\s.,!?，。！？'\"』」）】\s]+")


@dataclass
class _QueuedPayload:
    sequence_number: int
    sentence_id: int
    payload: AudioPayloadMessage
    pcm_bytes: bytes


class TTSTaskManager:
    """OLVT-style ordered sender with sidecar-side playback."""

    def __init__(
        self,
        stream: Any,
        compositor_speech_queue: asyncio.Queue[SpeechEnvelopePayload],
        compositor_sentence_complete_queue: asyncio.Queue[int] | None = None,
        extra_speech_queues: list[asyncio.Queue[SpeechEnvelopePayload]] | None = None,
        voice: Any | None = None,
        provider: TTSProvider | None = None,
    ) -> None:
        self._stream = stream
        self._voice = voice
        self._provider = provider
        self.compositor_speech_queue = compositor_speech_queue
        self.compositor_sentence_complete_queue = compositor_sentence_complete_queue
        self.extra_speech_queues = extra_speech_queues or []
        self.task_list: list[asyncio.Task[None]] = []
        self._payload_queue: asyncio.Queue[_QueuedPayload] = asyncio.Queue()
        self._sender_task: asyncio.Task[None] | None = None
        self._sequence_counter = 0
        self._next_sequence_to_send = 0
        self._last_write_finished_at: float | None = None
        self._last_sentence_id: int | None = None

    async def speak(
        self,
        tts_text: str,
        display_text: DisplayTextField,
        dispatches: list[Dispatch],
        sentence_id: int,
        ws: WebSocket,
    ) -> None:
        sequence_number = self._sequence_counter
        self._sequence_counter += 1
        self._ensure_sender_task(ws)

        task = asyncio.create_task(
            self._process_tts(
                tts_text=tts_text,
                display_text=display_text,
                dispatches=dispatches,
                sentence_id=sentence_id,
                sequence_number=sequence_number,
            )
        )
        self.task_list.append(task)

    async def wait_for_all_audio_complete(self) -> None:
        if self.task_list:
            await asyncio.gather(*self.task_list)
        await self._payload_queue.join()
        if self._last_write_finished_at is not None:
            drain_start = time.perf_counter()
            await asyncio.sleep(float(self._stream.latency) + 0.020)
            if self._last_sentence_id is not None:
                logger.info(
                    f"[TTS-DRAIN-END] sentence_id={self._last_sentence_id} "
                    f"drain_ms={(time.perf_counter() - drain_start) * 1000:.2f}"
                )

    def clear(self) -> None:
        for task in self.task_list:
            task.cancel()
        self.task_list.clear()
        if self._sender_task is not None:
            self._sender_task.cancel()
        self._payload_queue = asyncio.Queue()
        self._sequence_counter = 0
        self._next_sequence_to_send = 0
        self._last_write_finished_at = None
        self._last_sentence_id = None

    def _ensure_sender_task(self, ws: WebSocket) -> None:
        if self._sender_task is None or self._sender_task.done():
            self._sender_task = asyncio.create_task(self._process_payload_queue(ws))

    async def _process_tts(
        self,
        *,
        tts_text: str,
        display_text: DisplayTextField,
        dispatches: list[Dispatch],
        sentence_id: int,
        sequence_number: int,
    ) -> None:
        spawn_at = time.perf_counter()
        logger.info(
            f'[TTS-SYNTH-START] sentence_id={sentence_id} text="{tts_text}" '
            f"spawn_at={spawn_at:.6f}"
        )
        synth_start = time.perf_counter()
        try:
            payload, pcm_bytes, _sample_rate = await self._synthesize_payload(
                tts_text=tts_text,
                display_text=display_text,
                dispatches=dispatches,
                sentence_id=sentence_id,
            )
        except TTSProviderError as exc:
            logger.error(
                "[TTS-PROVIDER-ERROR] provider={} sentence_id={} state={} retryable={} summary={}",
                exc.provider_id,
                sentence_id,
                exc.state,
                exc.retryable,
                exc.summary,
            )
            payload, pcm_bytes, _sample_rate = (
                AudioPayloadMessage(
                    audio=None,
                    volumes=[],
                    slice_length=20,
                    display_text=display_text,
                    dispatches=dispatches,
                    sentence_id=sentence_id,
                    forwarded=False,
                    failed_audio=FailedAudioMetadata(
                        provider_id=exc.provider_id,
                        state=exc.state,
                        summary=exc.summary,
                        retryable=exc.retryable,
                        redacted_diagnostics={"detail": exc.detail} if exc.detail else None,
                    ),
                ),
                b"",
                0,
            )
        except Exception as exc:  # noqa: BLE001 - provider failures must not wedge the queue
            provider_id = getattr(self._provider, "provider_id", "piper")
            logger.exception(
                "[TTS-PROVIDER-ERROR] provider={} sentence_id={} state=external_service_failure summary={}",
                provider_id,
                sentence_id,
                exc,
            )
            payload, pcm_bytes, _sample_rate = (
                AudioPayloadMessage(
                    audio=None,
                    volumes=[],
                    slice_length=20,
                    display_text=display_text,
                    dispatches=dispatches,
                    sentence_id=sentence_id,
                    forwarded=False,
                    failed_audio=FailedAudioMetadata(
                        provider_id=provider_id,
                        state="external_service_failure",
                        summary=str(exc),
                        retryable=True,
                    ),
                ),
                b"",
                0,
            )
        if isinstance(payload, dict):
            payload = AudioPayloadMessage.model_validate(payload)
        logger.info(
            f"[TTS-SYNTH-END] sentence_id={sentence_id} "
            f"synth_ms={(time.perf_counter() - synth_start) * 1000:.2f}"
        )
        await self._payload_queue.put(
            _QueuedPayload(
                sequence_number=sequence_number,
                sentence_id=sentence_id,
                payload=payload,
                pcm_bytes=pcm_bytes,
            )
        )

    async def _synthesize_payload(
        self,
        *,
        tts_text: str,
        display_text: DisplayTextField,
        dispatches: list[Dispatch],
        sentence_id: int,
    ) -> tuple[AudioPayloadMessage, bytes, int]:
        if len(_WHITESPACE_ONLY_RE.sub("", tts_text)) == 0:
            return (
                AudioPayloadMessage(
                    audio=None,
                    volumes=[],
                    slice_length=20,
                    display_text=display_text,
                    dispatches=dispatches,
                    sentence_id=sentence_id,
                    forwarded=False,
                ),
                b"",
                getattr(self._voice.config, "sample_rate", 0) if self._voice else 0,
            )
        if self._provider is not None:
            result = await asyncio.to_thread(
                self._provider.synthesize,
                TTSSynthesisRequest(text=tts_text, sentence_id=sentence_id),
            )
            return prepare_payload_from_pcm(
                result.pcm_int16,
                result.sample_rate,
                display_text,
                dispatches,
                sentence_id,
            )
        if self._voice is None:
            raise TTSProviderError(
                provider_id="piper",
                state="unavailable",
                summary="TTSTaskManager has no TTS provider for non-silent payloads.",
                retryable=True,
            )
        return synthesize_and_prepare_payload(
            self._voice,
            tts_text,
            display_text,
            dispatches,
            sentence_id,
        )

    async def _process_payload_queue(self, ws: WebSocket) -> None:
        buffered_payloads: dict[int, _QueuedPayload] = {}
        loop = asyncio.get_running_loop()

        while True:
            queued = await self._payload_queue.get()
            buffered_payloads[queued.sequence_number] = queued

            try:
                while self._next_sequence_to_send in buffered_payloads:
                    next_payload = buffered_payloads.pop(self._next_sequence_to_send)
                    payload = next_payload.payload

                    if payload.audio is not None and next_payload.pcm_bytes:
                        pcm_int16 = np.frombuffer(next_payload.pcm_bytes, dtype=np.int16)
                        started_at = float(self._stream.time) + float(self._stream.latency)
                        logger.info(
                            f"[TTS-WRITE-START] sentence_id={next_payload.sentence_id} "
                            f"started_at={started_at:.6f} volumes_n={len(payload.volumes)} "
                            f"slice_ms={payload.slice_length}"
                        )
                        speech_envelope = SpeechEnvelopePayload(
                            sentence_id=next_payload.sentence_id,
                            volumes=payload.volumes,
                            slice_length=payload.slice_length,
                            started_at=started_at,
                        )
                        await self.compositor_speech_queue.put(speech_envelope)
                        for speech_queue in self.extra_speech_queues:
                            await speech_queue.put(speech_envelope)
                        await ws.send_json(payload.model_dump())

                        write_start = time.perf_counter()
                        xrun = await loop.run_in_executor(
                            None,
                            self._stream.write,
                            pcm_int16,
                        )
                        self._last_write_finished_at = time.perf_counter()
                        self._last_sentence_id = next_payload.sentence_id
                        if self.compositor_sentence_complete_queue is not None:
                            await self.compositor_sentence_complete_queue.put(
                                next_payload.sentence_id
                            )
                        logger.info(
                            f"[TTS-WRITE-END] sentence_id={next_payload.sentence_id} "
                            f"write_ms={(self._last_write_finished_at - write_start) * 1000:.2f} "
                            f"xrun={bool(xrun)}"
                        )
                    else:
                        await ws.send_json(payload.model_dump())

                    self._next_sequence_to_send += 1
            finally:
                self._payload_queue.task_done()
