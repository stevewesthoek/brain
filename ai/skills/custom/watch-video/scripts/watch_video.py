#!/usr/bin/env python3
"""Brain-safe adapter around the vendored claude-watch media pipeline."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve()
BRAIN_ROOT = SCRIPT_PATH.parents[5]
VENDOR_ROOT = BRAIN_ROOT / "ai" / "skills" / "vendors" / "taoufik123-collab" / "claude-watch" / "scripts"
DEFAULT_OUTPUT_ROOT = BRAIN_ROOT / "runtime" / "local" / "watch-video"


def is_url(source: str) -> bool:
    return source.startswith(("http://", "https://"))


def assert_safe_output(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if any(part.lower() == "mind" for part in resolved.parts):
        raise SystemExit("refusing output path inside a Mind directory")
    if resolved.exists() and resolved.is_symlink():
        raise SystemExit("refusing symlink output directory")
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


def preflight(source: str, provider: str) -> None:
    required = ["ffmpeg", "ffprobe"]
    if is_url(source):
        required.append("yt-dlp")
    missing = [name for name in required if shutil.which(name) is None]
    if missing:
        raise SystemExit(
            "missing required binaries: " + ", ".join(missing) + "; install them through the approved machine setup"
        )
    if provider in {"groq", "openai"} and not os.environ.get(
        "GROQ_API_KEY" if provider == "groq" else "OPENAI_API_KEY"
    ):
        raise SystemExit(f"selected Whisper provider {provider} has no API key in the process environment")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze a video into a Brain-local multimodal report without direct Mind writes."
    )
    parser.add_argument("source", help="video URL or local file path")
    parser.add_argument(
        "--transcript-provider",
        choices=["captions", "groq", "openai", "none"],
        default="captions",
        help="captions first, or an explicitly selected Whisper fallback",
    )
    parser.add_argument(
        "--allow-external-transcription",
        action="store_true",
        help="permit selected Whisper provider to upload extracted audio",
    )
    parser.add_argument("--out-dir", help="safe Brain-local report directory")
    parser.add_argument("--max-frames", type=int, default=80)
    parser.add_argument("--resolution", type=int, default=512)
    parser.add_argument("--fps", type=float)
    parser.add_argument("--start")
    parser.add_argument("--end")
    parser.add_argument("--intent", default="")
    parser.add_argument("--no-scene-change", action="store_true")
    parser.add_argument("--no-hook-microscope", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not 1 <= args.max_frames <= 100:
        raise SystemExit("--max-frames must be between 1 and 100")
    if args.transcript_provider in {"groq", "openai"} and not args.allow_external_transcription:
        raise SystemExit("external transcription requires --allow-external-transcription")
    preflight(args.source, args.transcript_provider)

    if args.out_dir:
        output_dir = assert_safe_output(Path(args.out_dir))
    else:
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_dir = assert_safe_output(DEFAULT_OUTPUT_ROOT / stamp)

    command = [sys.executable, str(VENDOR_ROOT / "watch.py"), args.source]
    command.extend(["--out-dir", str(output_dir), "--max-frames", str(args.max_frames)])
    command.extend(["--resolution", str(args.resolution)])
    if args.fps is not None:
        command.extend(["--fps", str(args.fps)])
    if args.start:
        command.extend(["--start", args.start])
    if args.end:
        command.extend(["--end", args.end])
    if args.intent:
        command.extend(["--intent", args.intent])
    if args.no_scene_change:
        command.append("--no-scene-change")
    if args.no_hook_microscope:
        command.append("--no-hook-microscope")
    if args.transcript_provider in {"captions", "none"}:
        command.append("--no-whisper")
    else:
        command.extend(["--whisper", args.transcript_provider])

    result = subprocess.run(command, cwd=VENDOR_ROOT, check=False)
    if result.returncode == 0:
        print(f"watch_video_output={output_dir}")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
