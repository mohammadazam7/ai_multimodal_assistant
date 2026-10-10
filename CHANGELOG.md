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

### Changed

- `/v1/detect` and `/v1/detect/base64` now go through the micro-batcher.
- `inference_ms` now includes the time a frame waits for its batch.

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
