from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from contracts import STTProviderConfig, STTProviderReadiness, STTTestResult


def compute_stt_readiness_fingerprint(config: STTProviderConfig) -> str:
    provider_id = config.active_provider or "funasr"
    cloud = config.cloud.get(provider_id) if provider_id in {"openai", "groq"} else None
    payload = {
        "provider_id": provider_id,
        "language_mode": config.language_mode,
        "local_model_id": config.local_model_id,
        "local_model_path_override": config.local_model_path_override,
        "cache_root": config.cache_root,
        "runtime_device": config.runtime_device,
        "cuda_compute_type": config.cuda_compute_type,
        "cloud_endpoint": cloud.endpoint_url if cloud else None,
        "cloud_model": cloud.model_name if cloud else None,
        "credential_present": bool(cloud and cloud.api_key),
        "consent": bool(cloud and cloud.consent_granted),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def readiness_from_test_result(config: STTProviderConfig, result: STTTestResult) -> STTProviderReadiness:
    fingerprint = compute_stt_readiness_fingerprint(config)
    now = datetime.now(timezone.utc).isoformat()
    passed = result.ok and bool(result.transcript and result.transcript.strip())
    return STTProviderReadiness(
        health_check_passed=result.failure is None,
        test_transcription_passed=passed,
        last_health_checked_at=now,
        last_test_transcription_at=now if passed else None,
        fingerprint=fingerprint,
        active_allowed=passed and result.failure is None,
        invalidation_reason="ready" if passed else "test_failed",
    )

def validate_stt_readiness(config: STTProviderConfig) -> STTProviderReadiness:
    readiness = config.readiness
    if readiness.fingerprint != compute_stt_readiness_fingerprint(config):
        return readiness.model_copy(
            update={
                "active_allowed": False,
                "invalidation_reason": "config_changed",
            }
        )
    return readiness
