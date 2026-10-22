"""Private FastAPI service. The game backend remains the decision authority."""
from __future__ import annotations

import hmac
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from ml.service.engine import RecognitionEngine
from ml.service.validation import ImageInputError, validate_image_bytes

LOG = logging.getLogger("campusquest.recognition")
PRODUCT_ROOT = Path(__file__).resolve().parents[2]


def create_app(
    *,
    engine: Any | None = None,
    api_token: str | None = None,
    gallery_path: str | Path | None = None,
    min_similarity: float | None = None,
    min_margin: float | None = None,
    max_image_bytes: int | None = None,
) -> FastAPI:
    token = api_token if api_token is not None else os.getenv("INFERENCE_API_TOKEN", "")
    gallery_file = Path(gallery_path or os.getenv("GALLERY_PATH", str(PRODUCT_ROOT / "data" / "gallery.npz")))
    threshold = float(os.getenv("MIN_SIMILARITY", "0.65")) if min_similarity is None else float(min_similarity)
    margin = float(os.getenv("MIN_MARGIN", "0.04")) if min_margin is None else float(min_margin)
    body_limit = int(os.getenv("MAX_IMAGE_BYTES", str(8 * 1024 * 1024))) if max_image_bytes is None else int(max_image_bytes)
    if not -1.0 <= threshold <= 1.0:
        raise ValueError("MIN_SIMILARITY must be between -1 and 1")
    if not 0.0 <= margin <= 2.0:
        raise ValueError("MIN_MARGIN must be between 0 and 2")
    if body_limit < 1:
        raise ValueError("MAX_IMAGE_BYTES must be a positive integer")

    app = FastAPI(title="CampusQuest Image Recognition", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.engine = engine
    app.state.api_token = token
    app.state.gallery_path = gallery_file
    app.state.min_similarity = threshold
    app.state.min_margin = margin
    app.state.max_image_bytes = body_limit

    @app.on_event("startup")
    async def load_engine() -> None:
        if app.state.engine is not None or not app.state.gallery_path.is_file():
            return
        try:
            app.state.engine = RecognitionEngine.load(
                app.state.gallery_path,
                min_similarity=app.state.min_similarity,
                min_margin=app.state.min_margin,
            )
        except Exception as exc:
            app.state.startup_error = type(exc).__name__
            LOG.exception("Recognition engine failed to load")

    @app.get("/healthz")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz")
    async def readiness() -> JSONResponse:
        missing = []
        if not app.state.api_token:
            missing.append("INFERENCE_API_TOKEN")
        if app.state.engine is None:
            missing.append("loaded_gallery_and_model")
        if missing:
            return JSONResponse(status_code=503, content={"ready": False, "missing": missing})
        return JSONResponse(status_code=200, content={"ready": True})

    @app.post("/v1/predict")
    async def predict(request: Request, authorization: str | None = Header(default=None)) -> JSONResponse:
        configured = app.state.api_token
        if not configured:
            return JSONResponse(status_code=503, content={"error": {"code": "service_not_configured", "message": "Inference authentication is not configured."}})
        prefix = "Bearer "
        supplied = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
        if not supplied or not hmac.compare_digest(supplied.encode("utf-8"), configured.encode("utf-8")):
            return JSONResponse(status_code=401, content={"error": {"code": "unauthorized", "message": "A valid bearer token is required."}}, headers={"WWW-Authenticate": "Bearer"})
        if app.state.engine is None:
            return JSONResponse(status_code=503, content={"error": {"code": "not_ready", "message": "The image gallery or model is not ready."}})

        content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        payload = bytearray()
        try:
            async for chunk in request.stream():
                if len(payload) + len(chunk) > app.state.max_image_bytes:
                    raise ImageInputError(413, "image_too_large", f"Image exceeds the {app.state.max_image_bytes}-byte limit.")
                payload.extend(chunk)
            image_bytes = validate_image_bytes(bytes(payload), content_type, max_bytes=app.state.max_image_bytes)
        except ImageInputError as exc:
            return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})

        try:
            result = await run_in_threadpool(app.state.engine.predict, image_bytes)
        except Exception:
            LOG.exception("Image prediction failed")
            return JSONResponse(status_code=503, content={"error": {"code": "inference_failed", "message": "Image recognition is temporarily unavailable."}})
        return JSONResponse(status_code=200, content=result)

    return app


app = create_app()
