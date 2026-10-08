"""HTTP API for the vision service."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import Settings, get_settings
from app.detector import Detector, build_detector
from app.imaging import InvalidImageError, decode_base64, decode_image
from app.schemas import Base64Image, DetectionResponse, Health

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, detector: Detector | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.detector = detector or build_detector(settings)
        yield

    app = FastAPI(
        title="Vision Service",
        version=__version__,
        description="Real-time object detection for live camera feeds.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def _detector(request: Request) -> Detector:
        return request.app.state.detector  # type: ignore[no-any-return]

    async def _run(request: Request, data: bytes) -> DetectionResponse:
        if len(data) > settings.max_image_bytes:
            raise HTTPException(413, "image too large")
        started = time.perf_counter()
        try:
            frame = decode_image(data)
        except InvalidImageError as exc:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

        det = _detector(request)
        t0 = time.perf_counter()
        # Inference is CPU/GPU-bound; keep it off the event loop.
        (detections,) = await run_in_threadpool(det.predict, [frame])
        inference_ms = (time.perf_counter() - t0) * 1000

        return DetectionResponse(
            detections=detections,
            width=frame.shape[1],
            height=frame.shape[0],
            model=det.name,
            inference_ms=round(inference_ms, 2),
            total_ms=round((time.perf_counter() - started) * 1000, 2),
        )

    @app.get("/healthz", response_model=Health, tags=["ops"])
    def healthz(request: Request) -> Health:
        det = _detector(request)
        return Health(status="ok", model=det.name, device=det.device, ready=True)

    @app.post("/v1/detect", response_model=DetectionResponse, tags=["detection"])
    async def detect(request: Request, file: Annotated[UploadFile, File()]) -> DetectionResponse:
        """Detect objects in an uploaded image (multipart/form-data)."""
        return await _run(request, await file.read())

    @app.post("/v1/detect/base64", response_model=DetectionResponse, tags=["detection"])
    async def detect_base64(request: Request, body: Base64Image) -> DetectionResponse:
        """Detect objects in a base64 image, e.g. a canvas frame from the browser."""
        try:
            data = decode_base64(body.image)
        except InvalidImageError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
        return await _run(request, data)

    return app


app = create_app()
