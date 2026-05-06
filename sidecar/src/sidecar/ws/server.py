"""FastAPI app surface for the sidecar.

Phase 1 plan 01-01: only /health is wired. /ws and /admin/* land in plan 01-02.
"""

from fastapi import FastAPI

app = FastAPI(title="AgenticLLMVTuber Sidecar", version="0.1.0-skeleton")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
