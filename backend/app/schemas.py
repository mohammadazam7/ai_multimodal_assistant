"""Request and response models for the HTTP API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Box(BaseModel):
    """Bounding box in pixel coordinates of the submitted image."""

    x1: float
    y1: float
    x2: float
    y2: float


class Detection(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    box: Box


class DetectionResponse(BaseModel):
    detections: list[Detection]
    width: int
    height: int
    model: str
    inference_ms: float = Field(description="Batch wait + model forward pass")
    total_ms: float = Field(description="Decode + batch wait + inference + post-processing")


class Base64Image(BaseModel):
    image: str = Field(description="Base64 image, with or without a data: URL prefix")


class Health(BaseModel):
    status: str
    model: str
    device: str
    ready: bool
