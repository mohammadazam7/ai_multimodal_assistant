"""Service settings, overridable with ``VISION_*`` environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VISION_", env_file=".env", extra="ignore")

    detector: Literal["yolo", "null"] = "yolo"
    model_path: str = "yolov8n.pt"
    device: str = "auto"  # "auto", "cpu", "cuda", "cuda:0", ...
    half_precision: bool = True  # FP16 on CUDA; ignored on CPU
    confidence: float = 0.5
    max_image_bytes: int = 8 * 1024 * 1024
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
