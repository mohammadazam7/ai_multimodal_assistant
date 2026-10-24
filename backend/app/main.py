"""HTTP API for the vision service."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Annotated

from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app import __version__
from app.access import AccessLogMiddleware
from app.batching import MicroBatcher
from app.config import Settings, get_settings
from app.detector import Detector, build_detector
from app.imaging import InvalidImageError, decode_base64, decode_image
from app.logs import configure_logging
from app.metrics import Metrics
from app.schemas import (
    Base64Image,
    DetectionResponse,
    Health,
    Readiness,
    StreamError,
    StreamResult,
)
from app.streams import LatestFrameSlot, SlotClosedError

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class _StreamFrame:
    seq: int
    received: float
    data: bytes


async def _infer(
    detector: Detector, batcher: MicroBatcher, data: bytes, started: float
) -> DetectionResponse:
    """Decode ``data`` and run it through the batcher. Raises InvalidImageError."""
    frame = decode_image(data)
    t0 = time.perf_counter()
    # The batcher runs inference in a worker thread, shared with concurrent callers.
    detections = await batcher.submit(frame)
    inference_ms = (time.perf_counter() - t0) * 1000
    return DetectionResponse(
        detections=detections,
        width=frame.shape[1],
        height=frame.shape[0],
        model=detector.name,
        inference_ms=round(inference_ms, 2),
        total_ms=round((time.perf_counter() - started) * 1000, 2),
    )


def create_app(settings: Settings | None = None, detector: Detector | None = None) -> FastAPI:
    settings = settings or get_settings()
    metrics = Metrics()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        det = detector or build_detector(settings)
        batcher = MicroBatcher(
            det,
            max_batch_size=settings.batch_max_size,
            max_wait_ms=settings.batch_max_wait_ms,
            observer=metrics,
        )
        metrics.track_queue_depth(lambda: batcher.queue_depth)
        metrics.set_build_info(__version__, det.name, det.device)
        app.state.detector = det
        app.state.batcher = batcher
        app.state.draining = False
        await batcher.start()
        log.info("service ready", extra={"model": det.name, "device": det.device})
        try:
            yield
        finally:
            # Fail readiness first so a load balancer stops routing here while we stop.
            app.state.draining = True
            await batcher.stop()

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
        expose_headers=["X-Request-ID"],
    )
    # Added last so it is outermost and also times CORS handling.
    app.add_middleware(AccessLogMiddleware)

    def _detector(request: Request) -> Detector:
        return request.app.state.detector  # type: ignore[no-any-return]

    def _batcher(request: Request) -> MicroBatcher:
        return request.app.state.batcher  # type: ignore[no-any-return]

    async def _run(request: Request, data: bytes) -> DetectionResponse:
        if len(data) > settings.max_image_bytes:
            raise HTTPException(413, "image too large")
        started = time.perf_counter()
        try:
            result = await _infer(_detector(request), _batcher(request), data, started)
        except InvalidImageError as exc:
            metrics.invalid_frame("http")
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc
        metrics.observe_frame("http", time.perf_counter() - started)
        return result

    def _readiness(request: Request) -> Readiness:
        state = request.app.state
        checks = {
            "model_loaded": getattr(state, "detector", None) is not None,
            "batcher_running": getattr(state, "batcher", None) is not None
            and state.batcher.running,
            "not_draining": not getattr(state, "draining", True),
        }
        return Readiness(ready=all(checks.values()), checks=checks)

    @app.get("/healthz", response_model=Health, tags=["ops"])
    def healthz(request: Request) -> Health:
        """Liveness: answers 200 whenever the process can serve HTTP at all.

        Restarting the pod would not fix a stopped batcher or a drain in progress, so
        those only show up in ``ready`` here and as a 503 from ``/readyz``.
        """
        det = _detector(request)
        ready = _readiness(request).ready
        return Health(status="ok", model=det.name, device=det.device, ready=ready)

    @app.get(
        "/readyz",
        response_model=Readiness,
        tags=["ops"],
        responses={503: {"model": Readiness, "description": "Not ready for traffic"}},
    )
    def readyz(request: Request) -> Response:
        """Readiness: 200 only when the service should receive traffic."""
        result = _readiness(request)
        code = status.HTTP_200_OK if result.ready else status.HTTP_503_SERVICE_UNAVAILABLE
        return JSONResponse(result.model_dump(), status_code=code)

    @app.get("/metrics", tags=["ops"], include_in_schema=False)
    def prometheus_metrics() -> Response:
        return Response(metrics.render(), media_type=metrics.content_type)

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
            raise HTTPException(422, str(exc)) from exc
        return await _run(request, data)

    @app.websocket("/v1/stream")
    async def stream(ws: WebSocket) -> None:
        """Live detection for one camera.

        The client sends each frame as a binary message (JPEG or PNG) and receives one
        JSON result per processed frame. If frames arrive faster than the model keeps up,
        only the newest waiting frame is processed; skipped frames are counted in
        ``dropped``. Text messages close the connection with 1003, oversized frames
        with 1009.
        """
        await ws.accept()
        metrics.streams_in_flight.inc()
        client = f"{ws.client.host}:{ws.client.port}" if ws.client else "unknown"
        log.info("stream opened", extra={"client": client})
        try:
            dropped = await _serve_stream(ws)
        finally:
            metrics.streams_in_flight.dec()
        log.info("stream closed", extra={"client": client, "dropped": dropped})

    async def _serve_stream(ws: WebSocket) -> int:
        """Run one stream until either side ends it; returns the number of dropped frames."""
        det: Detector = ws.app.state.detector
        batcher: MicroBatcher = ws.app.state.batcher
        slot: LatestFrameSlot[_StreamFrame] = LatestFrameSlot()
        close: tuple[int, str] | None = None

        async def receive() -> None:
            nonlocal close
            seq = 0
            try:
                while True:
                    message = await ws.receive()
                    if message["type"] == "websocket.disconnect":
                        return
                    data = message.get("bytes")
                    if data is None:
                        close = (status.WS_1003_UNSUPPORTED_DATA, "send frames as binary")
                        return
                    if len(data) > settings.max_image_bytes:
                        close = (status.WS_1009_MESSAGE_TOO_BIG, "frame too large")
                        return
                    seq += 1
                    slot.put(_StreamFrame(seq, time.perf_counter(), data))
            finally:
                slot.close()

        reported_drops = 0

        def report_drops() -> None:
            nonlocal reported_drops
            if slot.dropped > reported_drops:
                metrics.frames_dropped.inc(slot.dropped - reported_drops)
                reported_drops = slot.dropped

        async def process() -> None:
            while True:
                try:
                    item = await slot.get()
                except SlotClosedError:
                    return
                report_drops()
                try:
                    result = await _infer(det, batcher, item.data, item.received)
                except InvalidImageError as exc:
                    metrics.invalid_frame("stream")
                    await ws.send_json(StreamError(seq=item.seq, error=str(exc)).model_dump())
                    continue
                metrics.observe_frame("stream", time.perf_counter() - item.received)
                payload = StreamResult(**result.model_dump(), seq=item.seq, dropped=slot.dropped)
                await ws.send_json(payload.model_dump())

        receiver = asyncio.create_task(receive())
        processor = asyncio.create_task(process())
        try:
            await asyncio.wait({receiver, processor}, return_when=asyncio.FIRST_COMPLETED)
        finally:
            # Whichever side finishes first ends the stream; a frame in flight is dropped.
            receiver.cancel()
            processor.cancel()
            outcomes = await asyncio.gather(receiver, processor, return_exceptions=True)
            report_drops()

        # A WebSocketDisconnect only means the client left before we finished sending.
        failure = next(
            (
                o
                for o in outcomes
                if isinstance(o, Exception) and not isinstance(o, WebSocketDisconnect)
            ),
            None,
        )
        if failure is not None:
            log.error("stream failed", exc_info=failure)
            close = (status.WS_1011_INTERNAL_ERROR, "detection failed")
        if close is not None:
            with contextlib.suppress(RuntimeError, WebSocketDisconnect):
                await ws.close(*close)
        return slot.dropped

    app.state.metrics = metrics
    return app


def _default_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_format)
    return create_app(settings)


app = _default_app()
