from __future__ import annotations

import json
import time
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
import soundfile

from contracts import AudioProviderHealth, GptSoVitsProviderConfig, VoicePreset

from .provider import TTSProviderError, TTSSynthesisRequest, TTSSynthesisResult


class GptSoVitsProvider:
    """Synthesize-only HTTP adapter for GPT-SoVITS API v2.

    The adapter derives every API path from one configured base URL. It never
    writes to audio devices, websocket clients, compositor queues, or fallback
    providers; TTSTaskManager owns playback/order/RMS behavior.
    """

    provider_id = "gpt_sovits"

    def __init__(
        self,
        *,
        config: GptSoVitsProviderConfig,
        preset: VoicePreset,
        reference_audio: str | Path,
        timeout_ms: int | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.config = config
        self.preset = preset
        self.reference_audio = Path(reference_audio)
        self.timeout_ms = timeout_ms or config.request_timeout_ms
        self.sample_rate = 0
        self._base_url = self._normalize_base_url(config.base_url)
        self._tts_url = f"{self._base_url}/tts"
        self._set_gpt_weights_url = f"{self._base_url}/set_gpt_weights"
        self._set_sovits_weights_url = f"{self._base_url}/set_sovits_weights"
        self._applied_weights: tuple[str | None, str | None] | None = None
        self._transport = transport

    def boot(self) -> None:
        # External GPT-SoVITS is not app-owned here; definitive readiness is
        # proven by health/test endpoints and chat synthesis attempts.
        self.sample_rate = self.sample_rate or 24_000

    def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        self._validate_reference_audio()
        payload = self._build_payload(request)
        timeout = httpx.Timeout(self.timeout_ms / 1000.0)
        try:
            with httpx.Client(timeout=timeout, transport=self._transport) as client:
                self.ensure_weights_applied(client)
                response = client.post(self._tts_url, json=payload)
        except httpx.TimeoutException as exc:
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="timeout",
                summary="GPT-SoVITS synthesis timed out.",
                retryable=True,
                detail=type(exc).__name__,
            ) from exc
        except httpx.HTTPError as exc:
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary="GPT-SoVITS service could not be reached.",
                retryable=True,
                detail=type(exc).__name__,
            ) from exc

        if response.status_code != 200:
            raise self._error_from_response(response)

        try:
            pcm, sample_rate = soundfile.read(BytesIO(response.content), dtype="int16")
        except Exception as exc:
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary="GPT-SoVITS returned unreadable audio.",
                retryable=True,
                detail=type(exc).__name__,
            ) from exc
        self.sample_rate = int(sample_rate)
        return TTSSynthesisResult(
            pcm_int16=pcm.tobytes(),
            sample_rate=int(sample_rate),
            provider_id=self.provider_id,
        )

    def health(self) -> AudioProviderHealth:
        started = time.perf_counter()
        try:
            with httpx.Client(timeout=httpx.Timeout(self.timeout_ms / 1000.0), transport=self._transport) as client:
                self.ensure_weights_applied(client)
                response = client.get(f"{self._base_url}/docs")
        except httpx.TimeoutException:
            return AudioProviderHealth(
                provider_id=self.provider_id,
                kind="tts",
                state="timeout",
                summary="GPT-SoVITS health check timed out.",
                retryable=True,
            )
        except TTSProviderError as exc:
            health = exc.health()
            health.latency_ms = round((time.perf_counter() - started) * 1000, 2)
            return health
        except httpx.HTTPError as exc:
            return AudioProviderHealth(
                provider_id=self.provider_id,
                kind="tts",
                state="external_service_failure",
                summary="GPT-SoVITS service could not be reached.",
                detail=type(exc).__name__,
                retryable=True,
            )
        state = "ok" if 200 <= response.status_code < 300 else "external_service_failure"
        return AudioProviderHealth(
            provider_id=self.provider_id,
            kind="tts",
            state=state,
            summary="GPT-SoVITS service is reachable." if state == "ok" else f"GPT-SoVITS health check failed: HTTP {response.status_code}.",
            retryable=state != "ok",
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )

    def ensure_weights_applied(self, client: httpx.Client) -> None:
        weights = self._configured_weights()
        if weights == self._applied_weights:
            return
        gpt_weights, sovits_weights = weights
        if gpt_weights:
            self._apply_weight_endpoint(
                client,
                self._set_gpt_weights_url,
                gpt_weights,
                "GPT",
            )
        if sovits_weights:
            self._apply_weight_endpoint(
                client,
                self._set_sovits_weights_url,
                sovits_weights,
                "SoVITS",
            )
        self._applied_weights = weights

    def shutdown(self) -> None:
        return None

    def _build_payload(self, request: TTSSynthesisRequest) -> dict[str, Any]:
        preset = self.preset.gpt_sovits
        return {
            "text": request.text,
            "text_lang": preset.text_lang,
            "ref_audio_path": str(self.reference_audio),
            "prompt_text": preset.prompt_text,
            "prompt_lang": preset.prompt_lang,
            "top_k": preset.top_k,
            "top_p": preset.top_p,
            "temperature": preset.temperature,
            "text_split_method": preset.text_split_method,
            "batch_size": preset.batch_size,
            "speed_factor": preset.speed_factor,
            "media_type": "wav",
            "streaming_mode": False,
            "repetition_penalty": preset.repetition_penalty,
        }

    def _configured_weights(self) -> tuple[str | None, str | None]:
        preset = self.preset.gpt_sovits
        return (
            self._normalized_optional_string(preset.gpt_weights_path),
            self._normalized_optional_string(preset.sovits_weights_path),
        )

    def _apply_weight_endpoint(
        self,
        client: httpx.Client,
        url: str,
        weights_path: str,
        label: str,
    ) -> None:
        try:
            response = client.get(url, params={"weights_path": weights_path})
        except httpx.TimeoutException as exc:
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="timeout",
                summary=f"GPT-SoVITS {label} weight selection timed out.",
                retryable=True,
                detail=type(exc).__name__,
            ) from exc
        except httpx.HTTPError as exc:
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary=f"GPT-SoVITS {label} weight selection could not reach the service.",
                retryable=True,
                detail=type(exc).__name__,
            ) from exc
        if not 200 <= response.status_code < 300:
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary=f"GPT-SoVITS {label} weight selection failed.",
                retryable=True,
                detail=self._redacted_response_detail(response),
            )

    def _validate_reference_audio(self) -> None:
        if not self.reference_audio.exists() or not self.reference_audio.is_file():
            raise TTSProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary="GPT-SoVITS could not read the copied reference audio.",
                retryable=False,
                detail=f"reference_audio={self.reference_audio.name}; managed file is missing or not a file",
            )

    def _error_from_response(self, response: httpx.Response) -> TTSProviderError:
        detail = self._redacted_response_detail(response)
        summary = "GPT-SoVITS synthesis failed."
        if "reference" in detail.lower() and ("read" in detail.lower() or "file" in detail.lower()):
            summary = "GPT-SoVITS could not read the copied reference audio."
        return TTSProviderError(
            provider_id=self.provider_id,
            state="external_service_failure",
            summary=summary,
            retryable=True,
            detail=detail,
        )

    @staticmethod
    def _redacted_response_detail(response: httpx.Response) -> str:
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = response.text
        if isinstance(data, dict):
            message = data.get("message") or data.get("detail") or data.get("error") or str(data)
        else:
            message = str(data)
        return f"HTTP {response.status_code}: {message}"

    @staticmethod
    def _normalized_optional_string(value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise TTSProviderError(
                provider_id="gpt_sovits",
                state="misconfigured",
                summary="GPT-SoVITS base URL must be an http(s) URL.",
                retryable=False,
            )
        return base_url.rstrip("/")
