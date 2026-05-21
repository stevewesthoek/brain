#!/usr/bin/env python3
"""
Video Orchestrator — Live Analytics Sync (Phase 5).

Fetches real view/like/comment counts from platform APIs and upserts into
performance_metrics, closing the learning loop for model/hook recommendations.

Usage:
  analytics_sync.py sync [--platform youtube] [--days 30] [--dry-run]
  analytics_sync.py link --metric-id <uuid> --platform-video-id <yt-id>
  analytics_sync.py status

Credentials:
  YouTube Data API v3 key — stored in macOS Keychain:
    security add-generic-password -a video-orchestrator -s VO_YOUTUBE_API_KEY -w <key>
  Or via env var: VO_YOUTUBE_API_KEY=<key>

  The API key only needs public data scope (no OAuth).
  To get a key: Google Cloud Console → APIs & Services → Credentials → API key
  → restrict to YouTube Data API v3.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras

DB_HOST = os.environ.get("VO_DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("VO_DB_PORT", "5450"))
DB_NAME = os.environ.get("VO_DB_NAME", "video_orchestrator")
DB_USER = os.environ.get("VO_DB_USER", "postgres")
DB_PASS = os.environ.get("VO_DB_PASS", "postgres")

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
KEYCHAIN_SERVICE = "video-orchestrator"
KEYCHAIN_ACCOUNT_YT = "VO_YOUTUBE_API_KEY"


def connect():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def _keychain_get(account: str) -> str | None:
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-a", account, "-s", KEYCHAIN_SERVICE, "-w"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def get_youtube_api_key() -> str | None:
    key = os.environ.get("VO_YOUTUBE_API_KEY")
    if key:
        return key.strip()
    return _keychain_get(KEYCHAIN_ACCOUNT_YT)


def fetch_youtube_stats(video_ids: list[str], api_key: str) -> dict[str, dict]:
    """Return {youtube_video_id: {views, likes, comments, favorites}} for up to 50 IDs."""
    if not video_ids:
        return {}

    params = urllib.parse.urlencode({
        "part": "statistics",
        "id": ",".join(video_ids),
        "key": api_key,
    })
    url = f"{YOUTUBE_API_BASE}/videos?{params}"

    req = urllib.request.Request(url, headers={"User-Agent": "video-orchestrator/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        raise RuntimeError(f"YouTube API error {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"YouTube API connection failed: {e.reason}") from e

    result: dict[str, dict] = {}
    for item in data.get("items", []):
        yt_id = item["id"]
        stats = item.get("statistics", {})
        result[yt_id] = {
            "views": int(stats.get("viewCount", 0)),
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
            "shares": 0,  # YouTube API doesn't expose shares
        }
    return result


def _query_synced_rows(platform: str, days: int) -> list[dict]:
    """Return metric rows that have a platform_video_id and are within the sync window."""
    since = datetime.now() - timedelta(days=days)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, platform_video_id, posted_at
                FROM performance_metrics
                WHERE platform = %s
                  AND platform_video_id IS NOT NULL
                  AND platform_video_id != ''
                  AND (posted_at IS NULL OR posted_at > %s)
                ORDER BY posted_at DESC
            """, (platform, since))
            return [dict(r) for r in cur.fetchall()]


def _apply_updates(rows: list[dict], all_stats: dict[str, dict]) -> tuple[int, int]:
    """Write stats to DB. Returns (synced, not_found)."""
    synced = 0
    not_found = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for row in rows:
                yt_id = row["platform_video_id"]
                stats = all_stats.get(yt_id)
                if stats is None:
                    not_found += 1
                    continue
                views = stats["views"]
                likes = stats["likes"]
                comments = stats["comments"]
                shares = stats["shares"]
                eng = (likes + comments + shares) / views if views > 0 else 0.0
                cur.execute("""
                    UPDATE performance_metrics
                    SET views = %s, likes = %s, comments = %s, shares = %s, engagement_rate = %s
                    WHERE id = %s
                """, (views, likes, comments, shares, eng, row["id"]))
                synced += 1
        conn.commit()
    return synced, not_found


def sync_youtube(days: int = 30, dry_run: bool = False) -> dict:
    """Sync YouTube stats for all performance_metrics rows that have a platform_video_id."""
    api_key = get_youtube_api_key()
    if not api_key:
        return {
            "status": "error",
            "error": (
                "No YouTube API key found. Set VO_YOUTUBE_API_KEY env var or add to Keychain:\n"
                "  security add-generic-password -a VO_YOUTUBE_API_KEY "
                "-s video-orchestrator -w <key>"
            ),
        }

    rows = _query_synced_rows("youtube", days)
    if not rows:
        return {"status": "ok", "synced": 0, "message": "No YouTube metrics with platform_video_id in range"}

    # Deduplicate (same YouTube video may appear under multiple accounts)
    yt_ids = list({r["platform_video_id"] for r in rows})

    # Batch in chunks of 50 (YouTube API limit)
    all_stats: dict[str, dict] = {}
    for i in range(0, len(yt_ids), 50):
        batch = yt_ids[i:i + 50]
        stats = fetch_youtube_stats(batch, api_key)
        all_stats.update(stats)

    if dry_run:
        synced = 0
        not_found = 0
        for row in rows:
            yt_id = row["platform_video_id"]
            stats = all_stats.get(yt_id)
            if stats is None:
                not_found += 1
                continue
            views = stats["views"]
            likes = stats["likes"]
            comments = stats["comments"]
            eng = (likes + comments) / views if views > 0 else 0.0
            print(f"  [dry-run] {yt_id}  views={views}  likes={likes}  comments={comments}  engagement={eng:.2%}")
            synced += 1
        return {"status": "ok", "platform": "youtube", "synced": synced, "not_found": not_found, "dry_run": True}

    synced, not_found = _apply_updates(rows, all_stats)
    return {
        "status": "ok",
        "platform": "youtube",
        "synced": synced,
        "skipped": 0,
        "not_found": not_found,
        "dry_run": False,
    }


def sync_all(days: int = 30, dry_run: bool = False) -> dict:
    results: dict[str, dict] = {}
    results["youtube"] = sync_youtube(days=days, dry_run=dry_run)
    return results


def cmd_link(opts: dict) -> None:
    """Link an existing performance_metrics row to a platform video ID."""
    metric_id = opts.get("--metric-id")
    platform_video_id = opts.get("--platform-video-id")

    if not metric_id or not platform_video_id:
        print("Error: --metric-id and --platform-video-id are required")
        sys.exit(1)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE performance_metrics
                SET platform_video_id = %s
                WHERE id = %s
                RETURNING id, platform, account_id
            """, (platform_video_id, metric_id))
            row = cur.fetchone()
            if not row:
                print(f"Error: no performance_metrics row found with id={metric_id}")
                sys.exit(1)
        conn.commit()

    print(f"Linked metric {metric_id[:8]} ({row['platform']}) → {platform_video_id}")


def cmd_status() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    platform,
                    COUNT(*) AS total,
                    COUNT(platform_video_id) AS with_platform_id,
                    ROUND(AVG(views)::numeric, 0) AS avg_views,
                    MAX(created_at) AS last_record
                FROM performance_metrics
                GROUP BY platform
                ORDER BY total DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]

    if not rows:
        print("No performance metrics recorded yet.")
        return

    print(f"\n{'Platform':12}  {'Total':6}  {'Linked':7}  {'Avg Views':10}  {'Last Record':16}")
    print("-" * 60)
    for r in rows:
        last = str(r["last_record"])[:16] if r["last_record"] else "—"
        print(
            f"{str(r['platform'] or ''):12}  {r['total']:6}  "
            f"{r['with_platform_id']:7}  {int(r['avg_views'] or 0):10}  {last}"
        )

    api_key = get_youtube_api_key()
    print(f"\nYouTube API key: {'configured' if api_key else 'NOT CONFIGURED'}")


def _parse_opts(args: list[str]) -> dict[str, str | bool]:
    opts: dict[str, str | bool] = {}
    i = 0
    while i < len(args):
        if args[i].startswith("--") and i + 1 < len(args) and not args[i + 1].startswith("--"):
            opts[args[i]] = args[i + 1]
            i += 2
        elif args[i].startswith("--"):
            opts[args[i]] = True
            i += 1
        else:
            i += 1
    return opts


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    cmd = args[0]
    opts = _parse_opts(args[1:])

    if cmd == "sync":
        platform = opts.get("--platform")
        days = int(opts.get("--days", 30))
        dry_run = bool(opts.get("--dry-run", False))

        if platform and platform != "youtube":
            print(f"Error: unsupported platform '{platform}'. Currently only 'youtube' is supported.")
            sys.exit(1)

        print(f"Syncing analytics (platform={platform or 'all'}, days={days}, dry_run={dry_run})...")
        if platform == "youtube":
            result = sync_youtube(days=days, dry_run=dry_run)
            results = {"youtube": result}
        else:
            results = sync_all(days=days, dry_run=dry_run)

        for plat, r in results.items():
            if r.get("status") == "error":
                print(f"  {plat}: ERROR — {r['error']}")
            else:
                synced = r.get("synced", 0)
                nf = r.get("not_found", 0)
                print(f"  {plat}: synced={synced}, not_found={nf}{' (dry-run)' if r.get('dry_run') else ''}")

    elif cmd == "link":
        cmd_link(opts)

    elif cmd == "status":
        cmd_status()

    else:
        print(f"Unknown command: {cmd}\n{__doc__}")
        sys.exit(1)


if __name__ == "__main__":
    main()
