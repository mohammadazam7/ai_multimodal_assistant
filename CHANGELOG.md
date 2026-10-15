# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

### Added

- Async micro-batcher that groups frames from concurrent callers into one detector call,
  bounded by `VISION_BATCH_MAX_SIZE` and `VISION_BATCH_MAX_WAIT_MS`.
- `/v1/stream` WebSocket endpoint: one connection per camera, binary frames in, JSON
  results out, with per-stream `seq` and `dropped` counters.
- Per-stream back-pressure: a latest-frame slot replaces stale frames instead of
  queueing them.
- Web client rebuilt with Vite, React 19 and TypeScript: multi-camera grid, webcam
  capture downscaled to 640 px JPEG, canvas box overlay, and per-stream FPS, p50/p95
  round trip, server time and dropped-frame readouts. Lint, type-check, tests and a
  production build run in CI.
- Prometheus metrics at `/metrics`: end-to-end and inference latency histograms, batch
  size, batch queue depth, batch failures, frames by outcome, dropped stream frames and
  open streams.
- Structured JSON logs on stdout (`VISION_LOG_FORMAT`, `VISION_LOG_LEVEL`), one access
  log line per request with a request id echoed in `X-Request-ID`, and stream
  open/close logs.
- `/readyz` readiness endpoint that returns `503` with the failing checks while the
  model is not loaded, the batcher is stopped or the service is draining.

### Changed

- `/v1/detect` and `/v1/detect/base64` now go through the micro-batcher.
- `inference_ms` now includes the time a frame waits for its batch.
- `/healthz` is now a pure liveness check; its `ready` field reflects the `/readyz`
  checks. The Docker health check uses `/readyz`.

### Removed

- The Create React App frontend and its dependencies.

## [0.2.0] - 2026-10-08

### Added

- Typed FastAPI detection service with `/healthz`, `/v1/detect` (multipart) and
  `/v1/detect/base64`.
- Pluggable detector interface with YOLO and null implementations, automatic device
  selection and FP16 on CUDA.
- Request size limits and explicit `413`/`415`/`422` errors.
- Dockerfile and CI running ruff, mypy (strict) and pytest on Python 3.11 and 3.12.

### Removed

- Committed virtualenv, `node_modules` and cache directories.
