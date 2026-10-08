"""Turn uploaded bytes into RGB frames, rejecting anything that isn't an image."""

from __future__ import annotations

import base64
import binascii
import io

import numpy as np
from PIL import Image, UnidentifiedImageError

from app.detector import Frame


class InvalidImageError(ValueError):
    pass


def decode_image(data: bytes) -> Frame:
    try:
        with Image.open(io.BytesIO(data)) as img:
            rgb = img.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError("payload is not a decodable image") from exc
    return np.asarray(rgb, dtype=np.uint8)


def decode_base64(payload: str) -> bytes:
    if payload.startswith("data:"):
        _, _, payload = payload.partition(",")
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImageError("image is not valid base64") from exc
