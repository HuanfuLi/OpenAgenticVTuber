from pydantic import BaseModel


class SpeechEnvelopePayload(BaseModel):
    """In-process queue payload — NOT a WS message. Published by
    TTSTaskManager._process_payload_queue at write-time (D-02 / D-05);
    consumed by Phase 4 compositor speech driver.

    sentence_id: cross-envelope correlation key (D-13). Same value as
                 AudioPayloadMessage.sentence_id for the same sentence.
    volumes:     OLVT-shape RMS envelope, slice_length-ms slices, normalized
                 to per-sentence max. Phase 4 reads volumes[i] / volumes[i+1]
                 with linear interp (D-04).
    slice_length: ms per slice; OLVT-canonical 20.
    started_at:  stream.time + stream.output_latency at the moment the
                 sender task called stream.write() for sentence's first chunk.
                 Compositor reads stream.time directly to compute
                 elapsed = stream.time - started_at; index = floor(
                 elapsed * 1000 / slice_length).
    """
    sentence_id: int
    volumes: list[float]
    slice_length: int
    started_at: float
