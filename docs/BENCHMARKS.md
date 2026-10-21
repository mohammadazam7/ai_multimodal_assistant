# Benchmarks

`backend/bench` replays a video as N concurrent cameras over `/v1/stream` and reports
latency and throughput. This page explains how it measures, how to run it, and what it
measured so far. Every result here lists the machine it came from; there are no numbers
from hardware the project has not actually been run on.

## How it measures

- **Open loop.** Each simulated camera sends frames at a fixed rate (`--fps`) whether or
  not earlier frames have been answered, as a real camera would. A closed-loop client
  that waits for each answer would hide overload by slowing down.
- **Latency** is the time from sending a frame to receiving its result, measured on the
  client. It includes the network hop, JPEG decode, the wait for a batch and the
  forward pass.
- **Dropped frames** are frames the service skipped because a newer frame from the same
  camera arrived while the model was busy (the latest-frame back-pressure from M2).
  They never get an answer and are not part of the latency figures.
- **Throughput** is answered frames per second across all streams.
- **Frames are encoded once** before the run, so client-side JPEG encoding is not in
  the measurement. Each camera starts at a different point in the clip.
- **One service process per configuration.** With `--serve`, the harness starts
  uvicorn in a subprocess with the given `VISION_*` settings, waits for `/readyz`, runs
  an unmeasured warm-up, then each stream count in turn.

## Running it

```bash
cd backend
pip install -e ".[dev,inference]"

# against a service that is already running
python -m bench --url ws://localhost:8000/v1/stream --streams 1 4 8 --video clip.mp4

# batching on vs. off, each in a fresh service process
python -m bench \
  --serve batched:DEVICE=cpu,BATCH_MAX_SIZE=8 \
  --serve unbatched:DEVICE=cpu,BATCH_MAX_SIZE=1 \
  --streams 1 2 4 8 --fps 5 --seconds 30 --warmup 5 \
  --video clip.mp4 --json results.json --markdown results.md

# FP16 vs. FP32 needs a CUDA GPU; on CPU the setting is ignored
python -m bench --serve fp16:HALF_PRECISION=true --serve fp32:HALF_PRECISION=false ...
```

Without `--video` the harness uses generated frames (`--synthetic N`), which exercise
transport and batching but not a realistic scene.

## Results

### 2026-10-21 · CPU, 2 vCPU, YOLOv8n

| | |
|---|---|
| Machine | cloud VM, Intel Xeon @ 2.10 GHz, 2 vCPU, 7 GiB RAM, no GPU |
| Software | Python 3.13, torch 2.14.1, ultralytics 8.4.183, `yolov8n.pt`, FP32 |
| Input | OpenCV's `vtest.avi` sample (pedestrians, 768×576), resized to 640 px wide |
| Load | 5 fps per stream, 30 s per row after a 5 s warm-up, one run per row |
| Caveat | the client ran on the same 2 vCPUs as the service and took some of their time |

Raw record: [`benchmarks/2026-10-21-cpu-yolov8n.json`](benchmarks/2026-10-21-cpu-yolov8n.json).

| config | streams | sent | answered | dropped | throughput (fps) | p50 (ms) | p95 (ms) | p99 (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| batched (max 8) | 1 | 150 | 150 | 0 | 5.0 | 103.8 | 131.2 | 139.6 |
| batched (max 8) | 2 | 300 | 298 | 2 | 9.9 | 262.2 | 365.0 | 400.2 |
| batched (max 8) | 4 | 600 | 332 | 268 | 11.0 | 474.9 | 576.7 | 605.0 |
| batched (max 8) | 8 | 1200 | 352 | 848 | 11.4 | 806.2 | 919.4 | 1044.7 |
| unbatched | 1 | 150 | 150 | 0 | 5.0 | 96.7 | 112.3 | 124.6 |
| unbatched | 2 | 300 | 300 | 0 | 10.0 | 177.5 | 255.0 | 351.7 |
| unbatched | 4 | 600 | 327 | 273 | 10.7 | 471.6 | 565.0 | 585.5 |
| unbatched | 8 | 1200 | 331 | 869 | 10.6 | 857.3 | 984.8 | 1111.0 |

What this shows:

- **The machine tops out at about 11 frames per second.** One forward pass takes
  roughly 100 ms on these two cores, so two 5 fps cameras are about all it can serve
  without dropping frames.
- **Past saturation, back-pressure does its job.** At 4 and 8 streams the service
  drops stale frames instead of queueing them: throughput stays flat and latency
  stays under about a second rather than growing for as long as the run lasts.
- **Batching barely helps on CPU.** At 8 streams it answers about 7 % more frames
  (11.4 vs. 10.6 fps) with slightly lower latency, which is within what a single run
  can tell apart. At 2 streams it is worse: frames wait for a partner and then share a
  forward pass that takes about twice as long, so p50 goes from 178 to 262 ms. On a CPU
  the cost of a batch grows almost linearly with its size, so there is little to
  amortise. Batching is meant for GPUs, where a batch of 8 costs much less than 8
  single passes; that has not been measured here because no GPU was available.
- **FP16 was not measured.** It only applies on CUDA.

For the CPU Kubernetes overlay this means a pod held to its 2-core request handles
about two 5 fps cameras. The HPA's target of 4 open streams per pod only holds if the
pod can burst towards its 4-core limit; that has not been measured, so treat the target
as optimistic. A GPU run is still needed before the GPU overlay's target means much.
