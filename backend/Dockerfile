# syntax=docker/dockerfile:1.7
# CPU image by default. For NVIDIA GPUs, build with the CUDA wheel index:
#
#   docker build --build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu124 \
#     -t vision-service:gpu backend
#
# The CUDA wheels bundle their own runtime libraries; the node only needs the driver.
FROM python:3.12-slim AS base

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
RUN pip install --extra-index-url "${TORCH_INDEX}" ".[inference]"

# Weights are downloaded on first start. Keep them in their own directory, owned by the
# service user, so a volume can be mounted there to cache them across restarts.
RUN useradd --create-home --uid 10001 vision \
 && mkdir /models \
 && chown vision:vision /models
ENV VISION_MODEL_PATH=/models/yolov8n.pt
USER vision

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/readyz')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
