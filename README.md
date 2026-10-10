# AI Multimodal Assistant

[![CI](https://github.com/mohammadazam7/ai_multimodal_assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/mohammadazam7/ai_multimodal_assistant/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.11%20|%203.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?logo=pytorch&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Real-time object detection on live camera feeds. A FastAPI service runs a YOLO model
(FP16 on GPU), a React client streams webcam frames and draws the detections, and the
service is built to batch frames from many cameras into one forward pass and scale out
on Kubernetes.

> **Status:** under active development. The detection service and multi-stream
> batching are done; see the [roadmap](docs/ROADMAP.md) for the web client,
> observability, Kubernetes and benchmarks.

## Architecture

```mermaid
flowchart LR
    subgraph Browser
      CAM[Webcam / RTSP] --> UI[React client<br/>canvas overlay]
    end
    UI -- frames over WebSocket --> API[FastAPI<br/>/v1/stream, /v1/detect]
    API --> B[Micro-batcher<br/>N streams → 1 batch]
    B --> M[YOLO<br/>FP16 on CUDA]
    M -- boxes --> API -- JSON --> UI
    subgraph Kubernetes
      API
      B
      M
    end
    HPA[HPA] -. scales .-> API
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/healthz` | – | model, device, readiness |
| `POST` | `/v1/detect` | `multipart/form-data` with `file` | detections + timings |
| `POST` | `/v1/detect/base64` | `{"image": "data:image/jpeg;base64,..."}` | detections + timings |
| `WS` | `/v1/stream` | one binary message (JPEG/PNG) per frame | one JSON result per processed frame |

Example response:

```json
{
  "detections": [
    {"label": "person", "confidence": 0.91, "box": {"x1": 12.0, "y1": 30.5, "x2": 210.4, "y2": 470.0}}
  ],
  "width": 640, "height": 480,
  "model": "yolov8n.pt (fp16)",
  "inference_ms": 7.8,
  "total_ms": 11.2
}
```

Each response reports `inference_ms` (batch wait + forward pass) and `total_ms`
(decode → batch → inference → post-processing), so latency can be measured from the
client without extra tooling. Interactive docs are served at `/docs`.

### Live streams

A camera opens one WebSocket to `/v1/stream` and sends frames as binary messages. Each
result carries the same fields as above plus `seq` (which frame it belongs to, counting
from 1 on that connection) and `dropped` (how many frames the server has skipped so
far because newer ones arrived while the model was busy).

```python
import asyncio, websockets

async def main() -> None:
    async with websockets.connect("ws://localhost:8000/v1/stream") as ws:
        await ws.send(open("frame.jpg", "rb").read())
        print(await ws.recv())  # {"seq": 1, "dropped": 0, "detections": [...], ...}

asyncio.run(main())
```

A frame that can't be decoded gets `{"seq": n, "error": "..."}` and the stream keeps
going. Text messages close the socket with code 1003, frames over the size limit with
1009, and a model failure with 1011.

## Run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate

# API + tests only (no torch, starts in seconds; returns no detections)
pip install -e ".[dev]"
VISION_DETECTOR=null uvicorn app.main:app --reload

# Full inference stack (downloads yolov8n weights on first start)
pip install -e ".[inference]"
uvicorn app.main:app
```

```bash
curl -F file=@street.jpg http://localhost:8000/v1/detect
```

Docker:

```bash
docker build -t vision-service backend
docker run -p 8000:8000 vision-service
```

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `VISION_DETECTOR` | `yolo` | `yolo` or `null` |
| `VISION_MODEL_PATH` | `yolov8n.pt` | any Ultralytics model |
| `VISION_DEVICE` | `auto` | `auto`, `cpu`, `cuda`, `cuda:1`, ... |
| `VISION_HALF_PRECISION` | `true` | FP16 inference on CUDA |
| `VISION_CONFIDENCE` | `0.5` | minimum score |
| `VISION_MAX_IMAGE_BYTES` | `8388608` | larger uploads get `413`, larger stream frames close with 1009 |
| `VISION_BATCH_MAX_SIZE` | `8` | most frames in one forward pass |
| `VISION_BATCH_MAX_WAIT_MS` | `5` | longest a frame waits for others to join its batch |

## Design notes

- **Batch-first detector interface.** `Detector.predict` takes a list of frames, so the
  multi-stream batcher plugs in without changing the API or the model code.
- **Micro-batching across streams.** HTTP requests and WebSocket frames all go through
  one batcher. It starts a forward pass as soon as `VISION_BATCH_MAX_SIZE` frames are
  waiting or the first one has waited `VISION_BATCH_MAX_WAIT_MS`, whichever comes first.
  On a GPU this trades a few milliseconds of waiting for far fewer kernel launches.
- **Drop stale frames, don't queue them.** Each stream holds only its newest unprocessed
  frame. If the model falls behind, older frames are overwritten and counted, so latency
  stays bounded and the boxes always describe a recent picture. A queue would instead
  grow without limit and show detections for frames from seconds ago.
- **Inference off the event loop.** The forward pass runs in a worker thread, so slow
  frames don't block health checks or other requests.
- **Torch is optional.** The API, validation and tests install without the inference
  stack, which keeps CI fast. The `null` detector lets the web client be developed
  without a GPU.
- **Fail loudly on bad input.** Non-images return `415`, bad base64 returns `422`, and
  oversized uploads return `413`, instead of a `200` with an error string.

## Development

```bash
cd backend
pip install -e ".[dev]"
ruff check . && ruff format --check . && mypy app && pytest
```

## License

MIT © Mohammad Azam
