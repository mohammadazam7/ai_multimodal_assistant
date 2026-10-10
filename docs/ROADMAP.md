# Roadmap

Each milestone lands as a reviewed pull request with tests. Checked items are done.

- [x] **M1 · Detection service.** Remove the committed virtualenv, package the backend,
      typed FastAPI service with `/v1/detect` (multipart and base64), pluggable detector
      interface (YOLO, null), device selection with FP16 on CUDA, request limits,
      Dockerfile, CI.
- [x] **M2 · Multi-stream batching.** Async micro-batcher that collects frames from many
      streams for up to N ms or B frames and runs one forward pass; per-stream WebSocket
      endpoint; back-pressure (drop stale frames instead of queueing); unit tests with a
      fake detector.
- [ ] **M3 · Web client.** Rebuild the React app with Vite + TypeScript: webcam capture,
      live box overlay on canvas, multi-camera grid, latency and FPS readouts.
- [ ] **M4 · Observability.** Prometheus metrics (latency histograms, batch size, queue
      depth, dropped frames), structured JSON logs, `/readyz` vs `/healthz`.
- [ ] **M5 · Kubernetes.** Manifests with Kustomize overlays (CPU and GPU), resource
      requests/limits, readiness probes, HorizontalPodAutoscaler on CPU and on a custom
      in-flight-streams metric, docker-compose for local dev.
- [ ] **M6 · Benchmarks.** `bench/` harness that replays video files as N concurrent
      streams and reports p50/p95 latency and throughput with batching and FP16 on vs.
      off. Results published with the hardware they were measured on.
- [ ] **M7 · v1.0.** Architecture docs, demo GIF, CHANGELOG, release.
