"""Validation for raw image uploads accepted by the inference API."""
from __future__ import annotations

from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


class ImageInputError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def validate_image_bytes(
    payload: bytes,
    content_type: str | None,
    *,
    max_bytes: int = 8 * 1024 * 1024,
    max_pixels: int = 20_000_000,
) -> bytes:
    """Validate size, declared type, decoded type and pixel dimensions."""
    if not payload:
        raise ImageInputError(400, "empty_image", "The image body is empty.")
    if len(payload) > max_bytes:
        raise ImageInputError(413, "image_too_large", f"Image exceeds the {max_bytes}-byte limit.")
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    expected_format = ALLOWED_FORMATS.get(mime)
    if expected_format is None:
        raise ImageInputError(415, "unsupported_media_type", "Use JPEG, PNG, or WebP image bytes.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(payload)) as image:
                actual_format = image.format
                image.verify()
            with Image.open(BytesIO(payload)) as image:
                width, height = image.size
                if width < 32 or height < 32:
                    raise ImageInputError(422, "image_too_small", "Image dimensions must be at least 32 by 32 pixels.")
                if width * height > max_pixels:
                    raise ImageInputError(413, "image_dimensions_too_large", "Image dimensions exceed the pixel limit.")
                image = ImageOps.exif_transpose(image)
                image.load()
    except ImageInputError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning, ValueError) as exc:
        raise ImageInputError(422, "invalid_image", "The body is not a safe, readable image.") from exc

    if actual_format != expected_format:
        raise ImageInputError(415, "media_type_mismatch", "The declared content type does not match the image format.")
    return payload
