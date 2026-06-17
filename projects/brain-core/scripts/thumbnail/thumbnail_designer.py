#!/usr/bin/env python3
"""Repo-owned thumbnail worker for Task 1W-D.

Reads one JSON request from stdin and writes one JSON response to stdout.
Generates two distinct 1280x720 JPEG files with FFmpeg from deterministic PPM
frames. No shell interpolation is used.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

WIDTH = 1280
HEIGHT = 720


def fail(message: str, episode_id: str = "unknown") -> None:
    json.dump(
        {
            "status": "failed",
            "job_id": f"thumb-{episode_id}-failed",
            "episode_id": episode_id,
            "variants": [],
            "error_message": message,
        },
        sys.stdout,
    )
    sys.exit(1)


def parse_hex_color(value: Any, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    if not isinstance(value, str):
        return fallback
    text = value.strip().lstrip("#")
    if len(text) != 6:
        return fallback
    try:
        return tuple(int(text[index : index + 2], 16) for index in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return fallback


def write_ppm(path: Path, base: tuple[int, int, int], accent: tuple[int, int, int], variant: int) -> None:
    header = f"P6\n{WIDTH} {HEIGHT}\n255\n".encode("ascii")
    pixels = bytearray(WIDTH * HEIGHT * 3)
    band_top = 470 if variant == 1 else 80
    band_bottom = band_top + 170

    offset = 0
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if band_top <= y < band_bottom:
                color = accent
            else:
                gradient = int((x / (WIDTH - 1)) * 38)
                color = tuple(min(255, channel + gradient) for channel in base)
            pixels[offset : offset + 3] = bytes(color)
            offset += 3

    path.write_bytes(header + pixels)


def encode_jpeg(ffmpeg: str, ppm_path: Path, jpeg_path: Path) -> None:
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(ppm_path),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(jpeg_path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"ffmpeg exited with {result.returncode}")
    if not jpeg_path.is_file() or jpeg_path.stat().st_size == 0:
        raise RuntimeError(f"ffmpeg did not create {jpeg_path}")


def main() -> None:
    try:
        request = json.load(sys.stdin)
    except Exception as error:
        fail(f"Invalid JSON request: {error}")

    episode_id = str(request.get("episode_id", "")).strip()
    title = str(request.get("title", "")).strip()
    if not episode_id:
        fail("episode_id is required")
    if not title:
        fail("title is required", episode_id)

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        fail("ffmpeg executable was not found", episode_id)

    color_scheme = request.get("color_scheme")
    if not isinstance(color_scheme, dict):
        color_scheme = {}
    primary = parse_hex_color(color_scheme.get("primary"), (24, 36, 64))
    accent = parse_hex_color(color_scheme.get("accent"), (235, 180, 52))

    output_root = os.environ.get("BRAIN_CORE_THUMBNAIL_OUTPUT_DIR", "").strip()
    output_dir = Path(output_root).expanduser() if output_root else Path.home() / ".local" / "video-orchestrator" / "artifacts" / "thumbnails"
    output_dir.mkdir(parents=True, exist_ok=True)

    variants: list[dict[str, Any]] = []
    job_id = f"thumb-{episode_id}-{uuid.uuid4().hex[:12]}"

    try:
        with tempfile.TemporaryDirectory(prefix="brain-core-thumbnail-") as temp_dir:
            temp_path = Path(temp_dir)
            for index, base in ((1, primary), (2, accent)):
                variant_accent = accent if index == 1 else primary
                ppm_path = temp_path / f"variant-{index}.ppm"
                jpeg_path = output_dir / f"{episode_id}_v{index}.jpg"
                write_ppm(ppm_path, base, variant_accent, index)
                encode_jpeg(ffmpeg, ppm_path, jpeg_path)
                variants.append(
                    {
                        "variant_id": f"v{index}",
                        "url": str(jpeg_path),
                        "confidence_score": 0.86 if index == 1 else 0.82,
                        "template_applied": str(request.get("template_definition", {}).get("name", "default")),
                        "colors_applied": str(color_scheme.get("_name", "default")),
                        "size_bytes": jpeg_path.stat().st_size,
                        "dimensions": "1280x720",
                        "format": "jpeg",
                    }
                )
    except Exception as error:
        fail(f"Thumbnail rendering failed: {error}", episode_id)

    json.dump(
        {
            "status": "completed",
            "job_id": job_id,
            "episode_id": episode_id,
            "variants": variants,
            "error_message": None,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
