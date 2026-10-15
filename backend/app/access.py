"""Access logging with request ids.

A plain ASGI middleware rather than ``BaseHTTPMiddleware``: it does not buffer the
response and leaves WebSocket connections alone (streams log their own open/close).

Each HTTP request gets an id, taken from an incoming ``X-Request-ID`` header when a
proxy already assigned one, and echoed back on the response so a client report can be
matched to a log line.
"""

from __future__ import annotations

import logging
import re
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger("app.access")

REQUEST_ID_HEADER = b"x-request-id"
# Accept ids from upstream only if they look like ids, so headers cannot inject junk.
_VALID_ID = re.compile(rb"^[A-Za-z0-9._-]{1,64}$")
# Scrapes and probes would otherwise dominate the log; they are logged at debug.
QUIET_PATHS = frozenset({"/metrics", "/healthz", "/readyz"})


def _request_id(scope: Scope) -> str:
    headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
    for name, value in headers:
        if name == REQUEST_ID_HEADER and _VALID_ID.match(value):
            return value.decode()
    return uuid.uuid4().hex


class AccessLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id(scope)
        scope.setdefault("state", {})["request_id"] = request_id
        started = time.perf_counter()
        status = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER, request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            path = scope["path"]
            level = logging.DEBUG if path in QUIET_PATHS and status < 400 else logging.INFO
            log.log(
                level,
                "%s %s %d",
                scope["method"],
                path,
                status,
                extra={
                    "request_id": request_id,
                    "method": scope["method"],
                    "path": path,
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
