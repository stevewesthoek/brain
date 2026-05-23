#!/Users/Office/.local/video-orchestrator/venv/bin/python3
"""
YouTube Video Analysis Pipeline — Gemini Edition
=================================================
Usage: python3 analyze.py <youtube_url> [--focus "optional focus prompt"]
Output: JSON to stdout (progress logs go to stderr)

Steps:
  1. Validate URL (public YouTube only)
  2. Send URL directly to Gemini API — no download, no local inference
  3. Rate-limit check (free tier: 15 RPM, 1M TPM, 1500 RPD; 8h/day video)
  4. Output structured JSON

Why Gemini instead of local Qwen2.5-VL + MLX Whisper:
  Local pipeline took 14 min for an 8-min video and saturated the machine.
  Gemini natively understands YouTube URLs — no download, no GPU, ~15-30s total.
  Free tier allows ~60 8-minute videos per day (8h daily video limit).
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

# ── Rate limit state (file-based, persists across calls) ──────────────────────

RATE_LIMIT_FILE = Path(os.path.expanduser("~/.local/video-orchestrator/state/gemini-rate-limits.json"))

FREE_TIER = {
    "rpm": 15,           # requests per minute (gemini-2.5-flash free)
    "rpd": 1500,         # requests per day
    "tpm": 1_000_000,    # tokens per minute (not tracked per-call, just documented)
    "video_hours_per_day": 8.0,  # YouTube video hours per day on free tier
}


def _load_rate_state() -> dict:
    RATE_LIMIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    if RATE_LIMIT_FILE.exists():
        try:
            return json.loads(RATE_LIMIT_FILE.read_text())
        except Exception:
            pass
    return {"calls_today": [], "video_seconds_today": 0.0, "day": ""}


def _save_rate_state(state: dict) -> None:
    RATE_LIMIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    RATE_LIMIT_FILE.write_text(json.dumps(state, indent=2))


def _today() -> str:
    return time.strftime("%Y-%m-%d")


def check_and_record_call(video_duration_seconds: float = 0) -> None:
    """Enforce rate limits and record this call. Raises RuntimeError if limit hit."""
    state = _load_rate_state()

    today = _today()
    if state.get("day") != today:
        # New day — reset counters
        state = {"calls_today": [], "video_seconds_today": 0.0, "day": today}

    now = time.time()

    # RPD check
    if len(state["calls_today"]) >= FREE_TIER["rpd"]:
        raise RuntimeError(
            f"Daily request limit hit ({FREE_TIER['rpd']} requests/day on free tier). "
            "Try again tomorrow or upgrade to Gemini paid tier."
        )

    # 8-hour/day video limit
    video_hours_used = state["video_seconds_today"] / 3600.0
    video_hours_this = video_duration_seconds / 3600.0
    if video_hours_used + video_hours_this > FREE_TIER["video_hours_per_day"]:
        used_min = int(state["video_seconds_today"] / 60)
        raise RuntimeError(
            f"Daily YouTube video limit hit ({FREE_TIER['video_hours_per_day']}h/day on free tier). "
            f"Used today: {used_min} min. Try again tomorrow."
        )

    # RPM check — count calls in the last 60 seconds
    recent = [t for t in state["calls_today"] if now - t < 60]
    if len(recent) >= FREE_TIER["rpm"]:
        oldest = min(recent)
        wait_sec = 61 - (now - oldest)
        log(f"Rate limit: {FREE_TIER['rpm']} RPM reached. Waiting {wait_sec:.1f}s...")
        time.sleep(max(0, wait_sec))

    # Record this call
    state["calls_today"].append(now)
    # Only keep the last 2000 entries (well above rpd=1500)
    state["calls_today"] = state["calls_today"][-2000:]
    state["video_seconds_today"] = state.get("video_seconds_today", 0.0) + video_duration_seconds
    _save_rate_state(state)


def get_usage_summary() -> dict:
    """Return current rate limit usage — useful for the Brain Console dashboard."""
    state = _load_rate_state()
    today = _today()
    if state.get("day") != today:
        return {
            "calls_today": 0,
            "video_minutes_today": 0,
            "calls_remaining": FREE_TIER["rpd"],
            "video_minutes_remaining": int(FREE_TIER["video_hours_per_day"] * 60),
            "day": today,
        }
    calls = len(state.get("calls_today", []))
    video_min = int(state.get("video_seconds_today", 0) / 60)
    return {
        "calls_today": calls,
        "video_minutes_today": video_min,
        "calls_remaining": max(0, FREE_TIER["rpd"] - calls),
        "video_minutes_remaining": max(0, int(FREE_TIER["video_hours_per_day"] * 60) - video_min),
        "day": today,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[analyze] {msg}", file=sys.stderr, flush=True)


YOUTUBE_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/watch\?.*v=|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def validate_youtube_url(url: str) -> str:
    """Return canonical URL or raise ValueError."""
    m = YOUTUBE_RE.search(url)
    if not m:
        raise ValueError(f"Not a recognizable YouTube URL: {url}")
    video_id = m.group(1)
    return f"https://www.youtube.com/watch?v={video_id}"


def load_api_key() -> str:
    env_file = Path(os.path.expanduser("~/.config/google-ai/.env"))
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                key = line.split("=", 1)[1].strip()
                break
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY not found. Set it in ~/.config/google-ai/.env or as env var."
        )
    return key


# ── Gemini call ────────────────────────────────────────────────────────────────

ANALYSIS_PROMPT = """\
Analyze this YouTube video thoroughly. Return ONLY raw JSON (no markdown, no code fences).

Required JSON schema:
{
  "title": "<video title>",
  "channel": "<channel/uploader name>",
  "duration_seconds": <integer>,
  "transcript_excerpt": "<first 2000 chars of speech verbatim, or best approximation>",
  "full_summary": "<3-5 paragraph natural prose summary of what was said and shown>",
  "structured": {
    "topic": "<one-line topic>",
    "speaker": "<speaker name/role if identifiable, else null>",
    "key_claims": ["claim1", "claim2", "claim3"],
    "visual_elements": ["element1", "element2"],
    "evidence_type": "<anecdotal|empirical|opinion|tutorial|news|other>",
    "confidence": "<high|medium|low>",
    "research_hooks": ["hook1", "hook2"]
  },
  "chapters": [{"title": "...", "start_seconds": 0}],
  "key_timestamps": {"moment_description": "seconds_as_string"}
}

If a field is unavailable, use null or empty array. Do not add extra keys."""


def analyze_video(youtube_url: str, focus: str = "") -> dict:
    """Call Gemini API with the YouTube URL. Returns parsed JSON dict."""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError(
            "google-genai not installed. Run: "
            "python3 -m pip install google-genai"
        )

    api_key = load_api_key()
    client = genai.Client(api_key=api_key)

    prompt = ANALYSIS_PROMPT
    if focus:
        prompt += f"\n\nAdditional focus for this analysis: {focus}"

    log(f"Sending to Gemini API: {youtube_url}")
    t0 = time.time()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part(file_data=types.FileData(
                file_uri=youtube_url,
                mime_type="video/*",
            )),
            types.Part(text=prompt),
        ],
        config=types.GenerateContentConfig(
            max_output_tokens=4096,
            temperature=0.1,
        ),
    )

    elapsed = time.time() - t0
    log(f"Gemini responded in {elapsed:.1f}s")

    raw = response.text.strip()

    # Strip code fences if Gemini wrapped anyway
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Gemini returned non-JSON response: {e}\n\nRaw output:\n{raw[:500]}")

    data["_gemini_elapsed_seconds"] = round(elapsed, 1)
    return data


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze a YouTube video via Gemini API")
    parser.add_argument("url", nargs="?", help="YouTube URL to analyze")
    parser.add_argument("--focus", default="", help="Optional focus prompt for analysis")
    parser.add_argument("--usage", action="store_true", help="Print current rate limit usage and exit")
    args = parser.parse_args()

    if args.usage:
        print(json.dumps(get_usage_summary(), indent=2))
        return

    if not args.url:
        parser.print_help(sys.stderr)
        print(json.dumps({"ok": False, "error": "No URL provided", "step": "args"}))
        sys.exit(1)

    try:
        youtube_url = validate_youtube_url(args.url)
    except ValueError as e:
        print(json.dumps({"ok": False, "error": str(e), "step": "validate_url"}))
        sys.exit(1)

    log(f"URL validated: {youtube_url}")

    # Check rate limits before calling (use 0 duration — we don't know yet;
    # we record actual duration after the call succeeds)
    try:
        usage = get_usage_summary()
        log(f"Rate limit status: {usage['calls_today']}/{FREE_TIER['rpd']} calls today, "
            f"{usage['video_minutes_today']} min video used")

        # Pre-flight RPD check only (we don't know duration yet)
        state = _load_rate_state()
        today = time.strftime("%Y-%m-%d")
        if state.get("day") == today and len(state.get("calls_today", [])) >= FREE_TIER["rpd"]:
            raise RuntimeError(
                f"Daily request limit hit ({FREE_TIER['rpd']}/day). Try again tomorrow."
            )

        # RPM check
        now = time.time()
        calls_in_window = [
            t for t in state.get("calls_today", []) if now - t < 60
        ] if state.get("day") == today else []
        if len(calls_in_window) >= FREE_TIER["rpm"]:
            oldest = min(calls_in_window)
            wait_sec = 61 - (now - oldest)
            log(f"Rate limit: {FREE_TIER['rpm']} RPM reached. Waiting {wait_sec:.1f}s...")
            time.sleep(max(0, wait_sec))

    except RuntimeError as e:
        print(json.dumps({"ok": False, "error": str(e), "step": "rate_limit"}))
        sys.exit(1)

    try:
        log("=== Gemini API: video analysis ===")
        data = analyze_video(youtube_url, args.focus)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "step": "gemini_api"}))
        sys.exit(1)

    # Record the actual call + video duration
    duration_seconds = 0
    if isinstance(data.get("duration_seconds"), (int, float)):
        duration_seconds = float(data["duration_seconds"])
    try:
        check_and_record_call(duration_seconds)
    except RuntimeError as e:
        # Already past the limit after the call — just warn, don't fail
        log(f"Warning: rate limit post-call: {e}")

    result = {
        "ok": True,
        "video_id": youtube_url.split("v=")[-1],
        "url": youtube_url,
        "title": data.get("title", ""),
        "channel": data.get("channel", ""),
        "duration_seconds": data.get("duration_seconds", 0),
        "transcript_excerpt": data.get("transcript_excerpt", ""),
        "human_summary": data.get("full_summary", ""),
        "ai_summary": data.get("structured", {}),
        "chapters": data.get("chapters", []),
        "key_timestamps": data.get("key_timestamps", {}),
        "gemini_elapsed_seconds": data.get("_gemini_elapsed_seconds", 0),
        "rate_limit_usage": get_usage_summary(),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    log(f"Done in {data.get('_gemini_elapsed_seconds', 0)}s.")


if __name__ == "__main__":
    main()
