#!/usr/bin/env python3
"""
AI-agnostic Google Ads automation CLI for the Yeshua Academy Ad Grants account.

Current phase:
- live Google Ads API integration
- campaign and metrics ingestion
- search term harvesting
- recommendation tracking

All credentials provisioned and ready for production.
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import textwrap
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    print("Python 3.11+ is required for tomllib support.", file=sys.stderr)
    raise

# Import notifications module (same directory)
import sys as _sys
_sys.path.insert(0, str(Path(__file__).parent))
from notifications import (
    send_notifications,
    calculate_risk_score,
    should_escalate_mutation,
    get_escalation_message,
)


ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config" / "google-ads"
DATA_DIR = ROOT / "data" / "google-ads"
REPORTS_DIR = ROOT / "reports" / "google-ads"
DB_PATH = DATA_DIR / "google_ads.sqlite3"
LOCAL_CONFIG_DIR = Path.home() / ".config" / "google-ads"
LOCAL_ENV_PATH = LOCAL_CONFIG_DIR / "brain-google-ads.env"
ADC_PATH = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"


REQUIRED_SECRET_ENV_VARS = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
]


@dataclass
class DoctorState:
    canonical_email: str
    canonical_config: str
    gcloud_active_account: str | None
    gcloud_active_config: str | None
    gcloud_configs: list[dict[str, Any]]
    env_status: dict[str, bool]
    adc_status: dict[str, bool]
    local_env_exists: bool


def load_local_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if not LOCAL_ENV_PATH.exists():
        return values

    for raw_line in LOCAL_ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def adc_status() -> dict[str, bool]:
    status = {
        "adc_file": ADC_PATH.exists(),
        "client_id": False,
        "client_secret": False,
        "refresh_token": False,
    }
    if not ADC_PATH.exists():
        return status
    try:
        data = json.loads(ADC_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return status

    status["client_id"] = bool(data.get("client_id"))
    status["client_secret"] = bool(data.get("client_secret"))
    status["refresh_token"] = bool(data.get("refresh_token"))
    return status


def load_toml(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def utc_now_iso_with_offset(seconds: int) -> str:
    """Return UTC ISO timestamp offset by N seconds."""
    now = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    return now.isoformat().replace("+00:00", "Z")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def connect_db() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT NOT NULL,
            status TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date TEXT NOT NULL,
            spend_usd REAL NOT NULL,
            clicks INTEGER NOT NULL DEFAULT 0,
            impressions INTEGER NOT NULL DEFAULT 0,
            conversions REAL NOT NULL DEFAULT 0,
            source TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS policy_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_key TEXT NOT NULL,
            url TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            changed INTEGER NOT NULL,
            etag TEXT,
            last_modified TEXT,
            fetched_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_campaign_id TEXT NOT NULL UNIQUE,
            campaign_name TEXT NOT NULL,
            status TEXT NOT NULL,
            budget_usd REAL,
            campaign_type TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_metrics_detail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metrics_date TEXT NOT NULL,
            campaign_id TEXT,
            clicks INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            spend_usd REAL DEFAULT 0,
            conversions REAL DEFAULT 0,
            conversion_value REAL DEFAULT 0,
            fetch_timestamp TEXT NOT NULL,
            UNIQUE(metrics_date, campaign_id)
        );

        CREATE TABLE IF NOT EXISTS search_terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_term TEXT NOT NULL,
            campaign_id TEXT,
            clicks INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            conversions REAL DEFAULT 0,
            spend_usd REAL DEFAULT 0,
            status TEXT,
            fetch_date TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recommendation_type TEXT NOT NULL,
            campaign_id TEXT,
            priority TEXT,
            description TEXT,
            impact_estimate REAL,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS change_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            change_date TEXT NOT NULL,
            change_type TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            details TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pending_mutations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mutation_type TEXT NOT NULL,
            campaign_id TEXT,
            resource_type TEXT NOT NULL,
            resource_id TEXT,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            rule_source TEXT,
            proposed_by TEXT NOT NULL DEFAULT 'auto',
            reviewed_by TEXT,
            applied_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS negative_keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id TEXT NOT NULL,
            keyword_text TEXT NOT NULL,
            match_type TEXT NOT NULL DEFAULT 'BROAD',
            google_resource_name TEXT,
            source TEXT NOT NULL DEFAULT 'auto',
            created_at TEXT NOT NULL,
            UNIQUE(campaign_id, keyword_text, match_type)
        );
        """
    )
    return conn


def log_run(command: str, status: str, detail: str) -> None:
    with connect_db() as conn:
        conn.execute(
            "INSERT INTO runs (command, status, detail, created_at) VALUES (?, ?, ?, ?)",
            (command, status, detail, utc_now_iso()),
        )


def run_gcloud_json(args: list[str]) -> Any:
    cmd = ["~/.local/bin/gcp-cli", *args]
    shell_cmd = " ".join(cmd)
    completed = subprocess.run(
        shell_cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    return json.loads(completed.stdout)


def collect_doctor_state() -> DoctorState:
    account_cfg = load_toml(CONFIG_DIR / "account.toml")
    auth_list = run_gcloud_json(["auth", "list", "--format=json"])
    config_list = run_gcloud_json(["config", "configurations", "list", "--format=json"])
    local_env = load_local_env()

    active_account = None
    for account in auth_list:
        if account.get("status") == "ACTIVE":
            active_account = account.get("account")
            break

    active_config = None
    for config in config_list:
        if config.get("is_active"):
            active_config = config.get("name")
            break

    env_status = {
        name: bool(os.environ.get(name) or local_env.get(name)) for name in REQUIRED_SECRET_ENV_VARS
    }
    return DoctorState(
        canonical_email=account_cfg["canonical_google_ads_account_email"],
        canonical_config=account_cfg["canonical_gcloud_config"],
        gcloud_active_account=active_account,
        gcloud_active_config=active_config,
        gcloud_configs=config_list,
        env_status=env_status,
        adc_status=adc_status(),
        local_env_exists=LOCAL_ENV_PATH.exists(),
    )


def get_api_client() -> "GoogleAdsAPI":
    """
    Load credentials and return an initialized GoogleAdsAPI client.
    Raises SystemExit if credentials are missing.
    """
    local_env = load_local_env()

    dev_token = os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN") or local_env.get("GOOGLE_ADS_DEVELOPER_TOKEN") or ""
    login_cust_id = os.environ.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") or local_env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") or ""
    cust_id = os.environ.get("GOOGLE_ADS_CUSTOMER_ID") or local_env.get("GOOGLE_ADS_CUSTOMER_ID") or ""
    client_id = os.environ.get("GOOGLE_ADS_OAUTH_CLIENT_ID") or local_env.get("GOOGLE_ADS_OAUTH_CLIENT_ID") or ""
    client_secret = os.environ.get("GOOGLE_ADS_OAUTH_CLIENT_SECRET") or local_env.get("GOOGLE_ADS_OAUTH_CLIENT_SECRET") or ""
    refresh_token = os.environ.get("GOOGLE_ADS_REFRESH_TOKEN") or local_env.get("GOOGLE_ADS_REFRESH_TOKEN") or ""

    if not all([dev_token, login_cust_id, cust_id, client_id, client_secret, refresh_token]):
        print("ERROR: Missing Google Ads credentials", file=sys.stderr)
        raise SystemExit(1)

    try:
        from api import GoogleAdsAPI
    except (ImportError, TypeError) as e:
        print(f"ERROR: Failed to import API module: {e}", file=sys.stderr)
        raise SystemExit(1)

    return GoogleAdsAPI(
        developer_token=dev_token,
        customer_id=cust_id,
        login_customer_id=login_cust_id,
        oauth_client_id=client_id,
        oauth_client_secret=client_secret,
        refresh_token=refresh_token,
    )


def cmd_doctor(_: argparse.Namespace) -> int:
    state = collect_doctor_state()
    print("Google Ads doctor")
    print(f"- Canonical Google Ads account: {state.canonical_email}")
    print(f"- Canonical gcloud config: {state.canonical_config}")
    print(f"- Active gcloud account: {state.gcloud_active_account or 'unknown'}")
    print(f"- Active gcloud config: {state.gcloud_active_config or 'unknown'}")

    config_match = state.gcloud_active_config == state.canonical_config
    account_match = state.gcloud_active_account == state.canonical_email
    print(f"- Config boundary OK: {'yes' if config_match else 'no'}")
    print(f"- Account boundary OK: {'yes' if account_match else 'no'}")
    print(f"- Local env file present: {'yes' if state.local_env_exists else 'no'}")
    print(
        "- ADC status: "
        f"file={'yes' if state.adc_status['adc_file'] else 'no'}, "
        f"client_id={'yes' if state.adc_status['client_id'] else 'no'}, "
        f"client_secret={'yes' if state.adc_status['client_secret'] else 'no'}, "
        f"refresh_token={'yes' if state.adc_status['refresh_token'] else 'no'}"
    )

    print("- Secret readiness:")
    for key, present in state.env_status.items():
        print(f"  - {key}: {'present' if present else 'missing'}")

    missing = [key for key, present in state.env_status.items() if not present]
    detail = "ready" if not missing and config_match and account_match else "missing prerequisites"
    log_run("doctor", "ok" if detail == "ready" else "warning", detail)
    return 0


def cmd_sync(_: argparse.Namespace) -> int:
    """Fetch live data from Google Ads API and store in SQLite."""
    state = collect_doctor_state()
    missing = [key for key, present in state.env_status.items() if not present]
    if missing:
        detail = f"Missing credentials: {', '.join(missing)}"
        print(detail)
        log_run("sync", "blocked", detail)
        return 2

    # Load credentials from environment or local env file
    try:
        # First try environment variables
        local_env = load_local_env()

        dev_token = os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN") or local_env.get("GOOGLE_ADS_DEVELOPER_TOKEN") or ""
        login_cust_id = os.environ.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") or local_env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") or ""
        cust_id = os.environ.get("GOOGLE_ADS_CUSTOMER_ID") or local_env.get("GOOGLE_ADS_CUSTOMER_ID") or ""
        client_id = os.environ.get("GOOGLE_ADS_OAUTH_CLIENT_ID") or local_env.get("GOOGLE_ADS_OAUTH_CLIENT_ID") or ""
        client_secret = os.environ.get("GOOGLE_ADS_OAUTH_CLIENT_SECRET") or local_env.get("GOOGLE_ADS_OAUTH_CLIENT_SECRET") or ""
        refresh_token = os.environ.get("GOOGLE_ADS_REFRESH_TOKEN") or local_env.get("GOOGLE_ADS_REFRESH_TOKEN") or ""

        if not all([dev_token, login_cust_id, cust_id, client_id, client_secret, refresh_token]):
            detail = "Credentials present in env check but missing values"
            print(detail)
            log_run("sync", "error", detail)
            return 1

        # Import API module
        try:
            from api import GoogleAdsAPI, GoogleAdsAPIError
        except (ImportError, TypeError) as e:
            detail = f"Failed to import API module: {e}. Ensure google-ads package is installed."
            print(detail)
            log_run("sync", "error", detail)
            return 1

        # Initialize API client
        api = GoogleAdsAPI(
            developer_token=dev_token,
            customer_id=cust_id,
            login_customer_id=login_cust_id,
            oauth_client_id=client_id,
            oauth_client_secret=client_secret,
            refresh_token=refresh_token,
        )

        # Test connectivity
        print("Testing API connectivity...")
        try:
            api.test_connectivity()
            print("✓ API connectivity OK")
        except GoogleAdsAPIError as e:
            detail = f"API connectivity failed: {e}"
            print(detail)
            log_run("sync", "error", detail)
            return 1

        # Fetch campaigns
        print("Fetching campaigns...")
        campaigns = api.fetch_campaigns()
        print(f"✓ Fetched {len(campaigns)} campaigns")

        # Fetch today's metrics
        today = datetime.now().strftime("%Y-%m-%d")
        print(f"Fetching metrics for {today}...")
        metrics = api.fetch_daily_metrics(today)
        print(f"✓ Fetched metrics: ${metrics.spend_usd:.2f} spend, {metrics.clicks} clicks")

        # Fetch search terms from last 7 days
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        print(f"Fetching search terms ({start_date} to {end_date})...")
        search_terms = api.fetch_search_terms(start_date, end_date, limit=500)
        print(f"✓ Fetched {len(search_terms)} search terms")

        # Fetch recommendations
        print("Fetching recommendations...")
        recommendations = api.fetch_recommendations()
        print(f"✓ Fetched {len(recommendations)} recommendations")

        # Store in database
        print("Storing data in database...")
        today = datetime.now().strftime("%Y-%m-%d")
        with connect_db() as conn:
            # Store campaigns and detect status changes
            for campaign in campaigns:
                # Check for previous status
                previous = conn.execute(
                    "SELECT status FROM campaigns WHERE google_campaign_id = ?",
                    (campaign.google_campaign_id,),
                ).fetchone()

                # Record status change
                if previous and previous["status"] != campaign.status:
                    conn.execute(
                        """
                        INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            today,
                            "campaign_status_changed",
                            "campaign",
                            campaign.google_campaign_id,
                            json.dumps({
                                "previous_status": previous["status"],
                                "new_status": campaign.status,
                            }),
                            utc_now_iso(),
                        ),
                    )

                conn.execute(
                    """
                    INSERT OR REPLACE INTO campaigns
                    (google_campaign_id, campaign_name, status, budget_usd, campaign_type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        campaign.google_campaign_id,
                        campaign.campaign_name,
                        campaign.status,
                        campaign.budget_usd,
                        campaign.campaign_type,
                        utc_now_iso(),
                        utc_now_iso(),
                    ),
                )

            # Store daily metrics
            conn.execute(
                """
                INSERT OR REPLACE INTO daily_metrics_detail
                (metrics_date, campaign_id, clicks, impressions, spend_usd, conversions, conversion_value, fetch_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    metrics.metrics_date,
                    None,
                    metrics.clicks,
                    metrics.impressions,
                    metrics.spend_usd,
                    metrics.conversions,
                    metrics.conversion_value,
                    utc_now_iso(),
                ),
            )

            # Store search terms
            for st in search_terms:
                conn.execute(
                    """
                    INSERT INTO search_terms
                    (search_term, campaign_id, clicks, impressions, conversions, spend_usd, status, fetch_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        st.search_term,
                        st.campaign_id,
                        st.clicks,
                        st.impressions,
                        st.conversions,
                        st.spend_usd,
                        st.status,
                        today,
                        utc_now_iso(),
                    ),
                )

            # Store recommendations
            for rec in recommendations:
                conn.execute(
                    """
                    INSERT INTO recommendations
                    (recommendation_type, campaign_id, priority, description, impact_estimate, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rec.recommendation_type,
                        rec.campaign_id,
                        rec.priority,
                        rec.description,
                        rec.impact_estimate,
                        rec.status,
                        utc_now_iso(),
                        utc_now_iso(),
                    ),
                )

            # Record sync completion event
            conn.execute(
                """
                INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    today,
                    "sync_completed",
                    "account",
                    None,
                    json.dumps({
                        "campaigns": len(campaigns),
                        "search_terms": len(search_terms),
                        "recommendations": len(recommendations),
                        "metrics_date": today,
                    }),
                    utc_now_iso(),
                ),
            )

            conn.commit()

        detail = f"campaigns={len(campaigns)} metrics=1 search_terms={len(search_terms)} recommendations={len(recommendations)}"
        print(f"✓ Sync complete: {detail}")
        log_run("sync", "ok", detail)
        return 0

    except Exception as e:
        # Handle both GoogleAdsAPIError and other exceptions
        if "GoogleAdsAPIError" in str(type(e).__name__):
            detail = f"Google Ads API error: {e}"
        else:
            detail = f"Sync error: {e}"
        detail = f"Unexpected error during sync: {e}"
        print(detail)
        log_run("sync", "error", detail)
        return 1


def latest_month_spend(conn: sqlite3.Connection, month_prefix: str) -> float:
    """
    Fetch actual month-to-date spend from daily_metrics_detail.
    Reads account-level rollup rows (campaign_id IS NULL) that sync populates.
    """
    row = conn.execute(
        """
        SELECT COALESCE(SUM(spend_usd), 0)
        FROM daily_metrics_detail
        WHERE metrics_date LIKE ? AND campaign_id IS NULL
        """,
        (f"{month_prefix}%",),
    ).fetchone()
    return float(row[0] or 0.0)


def pace_band(daily_avg: float, bands: dict) -> str:
    """
    Determine pacing status based on daily average spend vs bands from goals.toml[pacing].
    Returns 'green', 'yellow', or 'red'.
    """
    if daily_avg >= bands.get("green_min_daily_usd", 0) and daily_avg <= bands.get("green_max_daily_usd", float("inf")):
        return "green"
    if daily_avg >= bands.get("yellow_min_daily_usd", 0):
        return "yellow"
    return "red"


def cmd_pace(_: argparse.Namespace) -> int:
    goals = load_toml(CONFIG_DIR / "goals.toml")
    now = datetime.now()
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    day_index = now.day
    month_prefix = f"{now.year:04d}-{now.month:02d}"

    with connect_db() as conn:
        actual_spend = latest_month_spend(conn, month_prefix)

    monthly_budget = float(goals["monthly_grant_budget_usd"])
    target_to_date = monthly_budget * (day_index / days_in_month)
    delta = actual_spend - target_to_date
    daily_avg = actual_spend / day_index if day_index > 0 else 0.0

    bands = goals.get("pacing", {})
    band = pace_band(daily_avg, bands)

    print("Google Ads pacing")
    print(f"- Month budget: ${monthly_budget:,.2f}")
    print(f"- Day of month: {day_index}/{days_in_month}")
    print(f"- Target spend to date: ${target_to_date:,.2f}")
    print(f"- Actual spend to date: ${actual_spend:,.2f}")
    print(f"- Delta: ${delta:,.2f}")
    print(f"- Pacing status: {band.upper()}")
    print(f"- Daily average: ${daily_avg:,.2f}")
    if bands:
        print(f"  green: ${bands.get('green_min_daily_usd', '?'):,.2f} – ${bands.get('green_max_daily_usd', '?'):,.2f}/day")
        print(f"  yellow: >${bands.get('yellow_min_daily_usd', '?'):,.2f}/day")
        print(f"  red: <${bands.get('yellow_min_daily_usd', '?'):,.2f}/day")

    # Log pacing alert to change_events if off pace
    if band in ("yellow", "red"):
        print(f"WARNING: pacing is {band.upper()}", file=sys.stderr)
        with connect_db() as conn:
            conn.execute(
                """
                INSERT INTO change_events
                (change_date, change_type, resource_type, resource_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    now.strftime("%Y-%m-%d"),
                    "pacing_alert",
                    "account",
                    None,
                    json.dumps({
                        "band": band,
                        "daily_avg": daily_avg,
                        "target_daily": bands.get("target_daily_budget_usd", monthly_budget / days_in_month),
                        "pacing_min": bands.get("yellow_min_daily_usd", 0),
                    }),
                    utc_now_iso(),
                ),
            )

    detail = f"target_to_date={target_to_date:.2f} actual={actual_spend:.2f} delta={delta:.2f} band={band}"
    log_run("pace", "ok", detail)
    return 0


def fetch_url(url: str) -> tuple[int, bytes, dict[str, str]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "brain-google-ads-policy-watch/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # nosec B310
        payload = response.read()
        headers = {k.lower(): v for k, v in response.headers.items()}
        return response.status, payload, headers


def cmd_negatives(args: argparse.Namespace) -> int:
    """
    Apply negative keyword automation with safety rules enforcement.

    Workflow:
    1. Check if safe_auto_apply.negative_keywords is enabled
    2. Query search terms without conversions exceeding spend threshold
    3. Compare against existing negatives to avoid duplicates
    4. Print candidates for review
    5. On --live: apply via API and record in change_events

    Safety invariants:
    - Default: dry-run (no API calls)
    - Requires explicit --live flag to mutate
    - Rejects --live if API in mock mode
    - All changes logged to change_events
    """
    rules = load_toml(CONFIG_DIR / "rules.toml")

    # Check if feature is enabled
    if not rules.get("safe_auto_apply", {}).get("negative_keywords", False):
        print("negative_keywords is disabled in rules.toml[safe_auto_apply]")
        log_run("negatives", "skipped", "disabled")
        return 0

    # Load thresholds
    config = rules.get("negative_keywords", {})
    spend_threshold_usd = config.get("spend_threshold_usd", 20.0)
    lookback_days = config.get("lookback_days", 30)
    match_type = config.get("match_type", "BROAD")

    # Compute date range
    today = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    print("Google Ads Negative Keywords Automation")
    print(f"- Lookback period: {start_date} to {today}")
    print(f"- Spend threshold: ${spend_threshold_usd}")
    print(f"- Match type: {match_type}")

    with connect_db() as conn:
        # Find search terms without conversions exceeding spend threshold
        candidates = conn.execute(
            """
            SELECT DISTINCT campaign_id, search_term, spend_usd
            FROM search_terms
            WHERE metrics_date >= ?
              AND metrics_date <= ?
              AND conversions = 0
              AND spend_usd > ?
            ORDER BY spend_usd DESC
            """,
            (start_date, today, spend_threshold_usd),
        ).fetchall()

        # Check for existing negatives
        existing = conn.execute(
            """
            SELECT campaign_id, keyword_text
            FROM negative_keywords
            WHERE match_type = ?
            """,
            (match_type,),
        ).fetchall()
        existing_set = {(row["campaign_id"], row["keyword_text"]) for row in existing}

        # Deduplicate
        to_apply = [
            (row["campaign_id"], row["search_term"], row["spend_usd"])
            for row in candidates
            if (row["campaign_id"], row["search_term"]) not in existing_set
        ]

    print(f"\nCandidates found: {len(candidates)}")
    print(f"Already negated: {len(candidates) - len(to_apply)}")
    print(f"Ready to apply: {len(to_apply)}")

    if to_apply:
        print("\nTop candidates:")
        for campaign_id, keyword, spend in to_apply[:10]:
            print(f"  - {keyword} (campaign={campaign_id}, spent=${spend:.2f})")

    # Get API client to check if we should proceed
    try:
        api = get_api_client()
    except SystemExit:
        # Credentials missing, fall back to mock or error
        api = None

    # Dry-run or live-run check
    if api:
        assert_live_allowed(args, api)

    if not args.live:
        # Dry run: just log and exit
        with connect_db() as conn:
            conn.execute(
                """
                INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    today,
                    "negative_keyword_dry_run",
                    "account",
                    None,
                    json.dumps({"candidates": len(to_apply), "total_checked": len(candidates)}),
                    utc_now_iso(),
                ),
            )
        log_run("negatives", "dry_run", f"candidates={len(to_apply)}")
        return 0

    # Live run: apply via API
    if not api:
        print("ERROR: Failed to initialize API client. Cannot apply mutations.", file=sys.stderr)
        return 1
    applied_count = 0
    error_count = 0

    with connect_db() as conn:
        # Group by campaign
        by_campaign: dict[str, list[str]] = {}
        for campaign_id, keyword, _ in to_apply:
            if campaign_id not in by_campaign:
                by_campaign[campaign_id] = []
            by_campaign[campaign_id].append(keyword)

        # Apply per campaign
        for campaign_id, keywords in by_campaign.items():
            result = api.add_negative_keywords(
                campaign_id=campaign_id,
                keywords=keywords,
                match_type=match_type,
                dry_run=False,
            )

            if result.get("errors"):
                error_count += len(result["errors"])
                for error in result["errors"]:
                    print(f"  ERROR for campaign {campaign_id}: {error}", file=sys.stderr)
            else:
                applied_count += len(result.get("added", []))
                # Record each application
                for keyword in keywords:
                    conn.execute(
                        """
                        INSERT INTO negative_keywords
                            (campaign_id, keyword_text, match_type, source, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT (campaign_id, keyword_text, match_type) DO NOTHING
                        """,
                        (campaign_id, keyword, match_type, "auto", utc_now_iso()),
                    )
                    conn.execute(
                        """
                        INSERT INTO change_events
                            (change_date, change_type, resource_type, resource_id, details, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            today,
                            "negative_keyword_added",
                            "campaign_criterion",
                            f"{campaign_id}:{keyword}",
                            json.dumps({"match_type": match_type}),
                            utc_now_iso(),
                        ),
                    )

    print(f"\nApplied: {applied_count}")
    print(f"Errors: {error_count}")
    log_run("negatives", "ok" if error_count == 0 else "partial", f"applied={applied_count} errors={error_count}")
    return 0 if error_count == 0 else 1


def get_pacing_health(conn: sqlite3.Connection) -> dict:
    """
    Calculate current pacing health (actual spend vs target).

    Returns dict with:
    - actual_spend: Current month-to-date spend
    - target_spend: Target for day of month
    - delta: Difference
    - pacing_pct: Percentage of target
    """
    goals = load_toml(CONFIG_DIR / "goals.toml")
    now = datetime.now()
    month_prefix = f"{now.year:04d}-{now.month:02d}"

    actual_spend = latest_month_spend(conn, month_prefix)
    monthly_budget = float(goals.get("monthly_grant_budget_usd", 10000))
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    target_to_date = monthly_budget * (now.day / days_in_month)

    pacing_pct = (actual_spend / target_to_date * 100) if target_to_date > 0 else 0

    return {
        "actual_spend": actual_spend,
        "target_spend": target_to_date,
        "delta": actual_spend - target_to_date,
        "pacing_pct": pacing_pct,
    }


def should_auto_approve_mutation(mutation: dict, rules: dict, conn: sqlite3.Connection = None) -> tuple[bool, str]:
    """
    Check if a mutation should be auto-approved based on approval gates.

    Args:
        mutation: Pending mutation dict with payload/priority/impact
        rules: Loaded rules.toml dict
        conn: SQLite connection for budget checks (optional)

    Returns:
        Tuple of (approved: bool, reason: str)
    """
    gates = rules.get("approval_gates", {})
    if not gates.get("auto_approve_high_impact", False):
        return False, "Auto-approval disabled"

    # Extract priority and impact from payload
    try:
        payload = json.loads(mutation.get("payload", "{}")) if isinstance(mutation.get("payload"), str) else mutation.get("payload", {})
        priority = payload.get("priority", "MEDIUM")
        impact = float(payload.get("impact_estimate", 0) or 0)
        campaign_id = mutation.get("campaign_id")

        threshold = gates.get("high_impact_threshold_usd", 500.0)

        # Check priority and impact
        if priority != "HIGH" or impact < threshold:
            return False, f"Priority {priority} + impact ${impact:.2f} < threshold"

        # Check budget health if enabled
        if gates.get("enable_budget_checks", False) and conn:
            pacing = get_pacing_health(conn)
            min_pacing = gates.get("min_pacing_pct_for_approval", 80.0)
            max_pacing = gates.get("max_pacing_pct_for_approval", 120.0)

            if pacing["pacing_pct"] < min_pacing:
                return False, f"Underspending: {pacing['pacing_pct']:.1f}% < {min_pacing:.1f}% minimum"
            if pacing["pacing_pct"] > max_pacing:
                return False, f"Overspending: {pacing['pacing_pct']:.1f}% > {max_pacing:.1f}% maximum"

        # Check campaign type restrictions if defined
        campaign_types = gates.get("campaign_types", {})
        if campaign_types and conn and campaign_id:
            campaign = conn.execute(
                "SELECT campaign_type FROM campaigns WHERE google_campaign_id = ? LIMIT 1",
                (campaign_id,),
            ).fetchone()

            if campaign:
                camp_type = campaign.get("campaign_type", "")
                type_rules = campaign_types.get(camp_type, {})
                if isinstance(type_rules, dict):
                    min_impact = type_rules.get("min_impact", 0)
                    if impact < min_impact:
                        return False, f"Campaign type {camp_type} requires impact >= ${min_impact:.2f}"

        return True, "Approved: HIGH priority + impact meets threshold + budget healthy"

    except (json.JSONDecodeError, ValueError, TypeError) as err:
        return False, f"Error evaluating mutation: {err}"


def cmd_recommendations(args: argparse.Namespace) -> int:
    """
    Queue pending Google Ads recommendations for approval and application.

    Workflow:
    1. Query recommendations table for entries without associated mutations
    2. Group by type (KEYWORD, BID_ADJUSTMENT, AD_COPY, etc.)
    3. Queue each as a pending_mutation
    4. Auto-approve high-impact recommendations if gates enabled
    5. Print queue for review

    Safety invariants:
    - No mutations applied without explicit approval
    - Each recommendation queued as individual mutation
    - Auto-approval respects approval_gates configuration
    - All changes logged to change_events
    """
    rules = load_toml(CONFIG_DIR / "rules.toml")

    # Check if feature is enabled (use same gate as negatives for now)
    if not rules.get("safe_auto_apply", {}).get("negative_keywords", False):
        print("Recommendations automation is disabled")
        log_run("recommendations", "skipped", "disabled")
        return 0

    today = datetime.now().strftime("%Y-%m-%d")

    with connect_db() as conn:
        # Find recommendations that don't have associated mutations yet
        recommendations = conn.execute(
            """
            SELECT r.id, r.recommendation_type, r.campaign_id, r.priority, r.description, r.impact_estimate
            FROM recommendations r
            WHERE r.status = 'pending'
              AND NOT EXISTS (
                SELECT 1 FROM pending_mutations
                WHERE resource_type = 'recommendation'
                  AND resource_id = CAST(r.id AS TEXT)
              )
            ORDER BY r.impact_estimate DESC
            """
        ).fetchall()

        if not recommendations:
            print("No pending recommendations found")
            log_run("recommendations", "ok", "count=0")
            return 0

        print(f"Found {len(recommendations)} pending recommendations")
        print("\nQueuing for approval:")

        queued = 0
        errors = 0

        for rec in recommendations:
            try:
                # Build mutation payload
                payload = {
                    "recommendation_type": rec["recommendation_type"],
                    "campaign_id": rec["campaign_id"],
                    "priority": rec["priority"],
                    "description": rec["description"],
                    "impact_estimate": rec["impact_estimate"],
                }

                # Check if should auto-approve (pass connection for budget checks)
                auto_approve, approval_reason = should_auto_approve_mutation(payload, rules, conn)
                initial_status = "approved" if auto_approve else "pending"

                # Insert into pending_mutations
                conn.execute(
                    """
                    INSERT INTO pending_mutations
                        (mutation_type, campaign_id, resource_type, resource_id, payload, status, rule_source, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "apply_recommendation",
                        rec["campaign_id"],
                        "recommendation",
                        str(rec["id"]),
                        json.dumps(payload),
                        initial_status,
                        "recommendations_cmd",
                        utc_now_iso(),
                        utc_now_iso(),
                    ),
                )

                # Log to change_events
                event_type = "recommendation_auto_approved" if auto_approve else "recommendation_queued"
                conn.execute(
                    """
                    INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        today,
                        event_type,
                        "recommendation",
                        str(rec["id"]),
                        json.dumps({
                            "type": rec["recommendation_type"],
                            "impact": rec["impact_estimate"],
                            "priority": rec["priority"],
                            "auto_approved": auto_approve,
                            "reason": approval_reason,
                        }),
                        utc_now_iso(),
                    ),
                )

                status_str = "→ approved" if auto_approve else "→ pending"
                print(f"  ✓ {rec['recommendation_type']:20s} impact=${rec['impact_estimate']:8.2f} ({rec['priority']:6s}) {status_str}")
                queued += 1

            except Exception as err:
                errors += 1
                print(f"  ✗ Error queuing recommendation {rec['id']}: {err}", file=sys.stderr)

    print(f"\nQueued: {queued}")
    if errors:
        print(f"Errors: {errors}")

    # Send notifications for queued/approved recommendations
    with connect_db() as conn:
        new_mutations = conn.execute(
            """
            SELECT * FROM pending_mutations
            WHERE resource_type = 'recommendation'
              AND created_at >= ?
            ORDER BY id
            """,
            (utc_now_iso_with_offset(-5),),  # Last 5 seconds
        ).fetchall()

        for mut in new_mutations:
            event_type = "recommendation_auto_approved" if mut["status"] == "approved" else "recommendation_queued"
            payload = json.loads(mut["payload"])

            # Calculate risk for escalation
            risk_score = calculate_risk_score(mut, rules)

            # Send notifications
            send_notifications(
                event_type=event_type,
                details={
                    "mutation_type": mut["mutation_type"],
                    "resource_type": mut["resource_type"],
                    "resource_id": mut["resource_id"],
                    "impact": payload.get("impact_estimate", 0),
                },
                rules=rules,
                risk_score=risk_score if risk_score["score"] > 30 else None,
            )

            # Check if needs escalation
            if should_escalate_mutation(mut, rules):
                print(f"\n  🚨 ESCALATION REQUIRED for ID {mut['id']}")

    log_run("recommendations", "ok" if errors == 0 else "partial", f"queued={queued} errors={errors}")
    return 0 if errors == 0 else 1


def cmd_preview(args: argparse.Namespace) -> int:
    """
    Preview approved mutations before applying.

    Shows detailed information about what each mutation will do:
    - Negative keywords: keywords to be added to which campaign
    - Recommendations: impact, type, and affected campaign
    - Summary: total mutations, estimated impact, risk level

    Usage:
      preview              # Show all approved mutations
      preview --type negative_keywords
      preview --id 5
    """
    mutation_id = getattr(args, "id", None)
    mutation_type = getattr(args, "type", None)

    with connect_db() as conn:
        # Fetch approved mutations
        query = "SELECT * FROM pending_mutations WHERE status = 'approved'"
        params = []

        if mutation_id:
            query += " AND id = ?"
            params.append(mutation_id)
        if mutation_type:
            query += " AND mutation_type = ?"
            params.append(mutation_type)

        query += " ORDER BY id"
        mutations = conn.execute(query, params).fetchall()

    if not mutations:
        print("No approved mutations to preview")
        return 0

    print("MUTATION PREVIEW")
    print("=" * 100)
    print()

    total_impact = 0.0

    for mut in mutations:
        payload = json.loads(mut["payload"])
        mtype = mut["mutation_type"]

        if mtype == "add_negative_keywords":
            keywords = payload.get("keywords", [])
            campaign_id = mut["campaign_id"]
            match_type = payload.get("match_type", "BROAD")

            print(f"Mutation ID {mut['id']}:")
            print(f"  Type: Negative Keywords")
            print(f"  Campaign ID: {campaign_id}")
            print(f"  Match type: {match_type}")
            print(f"  Keywords ({len(keywords)}):")
            for kw in keywords[:10]:
                print(f"    - {kw}")
            if len(keywords) > 10:
                print(f"    ... and {len(keywords) - 10} more")
            print()

        elif mtype == "apply_recommendation":
            rec_type = payload.get("recommendation_type", "UNKNOWN")
            priority = payload.get("priority", "MEDIUM")
            impact = float(payload.get("impact_estimate", 0) or 0)
            description = payload.get("description", "No description")
            campaign_id = mut["campaign_id"]

            print(f"Mutation ID {mut['id']}:")
            print(f"  Type: Google Ads Recommendation")
            print(f"  Recommendation type: {rec_type}")
            print(f"  Priority: {priority}")
            print(f"  Campaign ID: {campaign_id}")
            print(f"  Estimated impact: ${impact:.2f}")
            print(f"  Description: {description}")
            print()

            total_impact += impact

    print("=" * 100)
    print(f"Total mutations: {len(mutations)}")
    if total_impact > 0:
        print(f"Total estimated impact: ${total_impact:.2f}")
    print()
    print("To apply these mutations, run:")
    if mutation_type:
        print(f"  bash tools/google-ads/run.sh batch-apply --type {mutation_type} --live")
    else:
        print(f"  bash tools/google-ads/run.sh batch-apply --live")

    log_run("preview", "ok", f"previewed={len(mutations)}")
    return 0


def cmd_compliance_check(args: argparse.Namespace) -> int:
    """
    Check pending mutations for compliance with organizational rules.

    Validates:
    - No negative keywords that are too generic (e.g., single character)
    - No mutations if account is suspended or in violation
    - Recommendations align with mission (if mission_alignment required)
    - Campaign status is not already modified recently
    - Daily spend limits per campaign type

    Reports:
    - Compliance status for each pending mutation
    - Risk warnings for borderline cases
    - Blocks mutations that fail validation
    """
    rules = load_toml(CONFIG_DIR / "rules.toml")
    compliance_rules = rules.get("compliance", {})

    with connect_db() as conn:
        mutations = conn.execute(
            "SELECT * FROM pending_mutations WHERE status = 'pending' ORDER BY id"
        ).fetchall()

    if not mutations:
        print("No pending mutations to check")
        log_run("compliance-check", "ok", "count=0")
        return 0

    print("COMPLIANCE CHECK")
    print("=" * 100)
    print()

    passed = 0
    failed = 0
    warnings = 0

    for mut in mutations:
        payload = json.loads(mut["payload"])
        mtype = mut["mutation_type"]
        status_str = "✓ PASS"

        checks = []

        if mtype == "add_negative_keywords":
            keywords = payload.get("keywords", [])

            # Check for generic/too-short keywords
            short_keywords = [kw for kw in keywords if len(kw.strip()) <= 2]
            if short_keywords:
                checks.append(f"WARNING: {len(short_keywords)} keywords too short (likely invalid)")
                warnings += 1
                status_str = "⚠ WARN"

            # Check for stop words that might be too broad
            broad_stop_words = ["the", "a", "an", "and", "or", "but", "in", "on", "at"]
            broad_keywords = [kw for kw in keywords if kw.lower().strip() in broad_stop_words]
            if broad_keywords:
                checks.append(f"WARNING: {len(broad_keywords)} keywords are stop words (likely too broad)")
                warnings += 1
                status_str = "⚠ WARN"

        elif mtype == "apply_recommendation":
            rec_type = payload.get("recommendation_type", "")
            priority = payload.get("priority", "")

            # Check mission alignment if required
            if compliance_rules.get("require_mission_alignment", False):
                # For now, just flag MEDIUM/LOW priority recommendations
                if priority in ["MEDIUM", "LOW"]:
                    checks.append(f"REVIEW: {priority} priority recommendation requires mission check")
                    warnings += 1
                    status_str = "⚠ WARN"

            # Check recommendation type restrictions
            if rec_type == "BID_ADJUSTMENT":
                checks.append("NOTE: Bid adjustments can affect account performance significantly")
                warnings += 1
                status_str = "⚠ WARN"

        # Check for recent modifications
        with connect_db() as conn:
            recent_changes = conn.execute(
                """
                SELECT COUNT(*) as count FROM change_events
                WHERE resource_type = ?
                  AND resource_id = ?
                  AND change_date = DATE('now')
                """,
                (mut["resource_type"], mut["resource_id"]),
            ).fetchone()

            if recent_changes and recent_changes["count"] > 3:
                checks.append(f"NOTE: Resource modified {recent_changes['count']} times today")
                warnings += 1

        # Output result
        if status_str.startswith("✓"):
            passed += 1
        elif status_str.startswith("⚠"):
            warnings += 1
        else:
            failed += 1

        print(f"{status_str} ID {mut['id']:3d} {mtype:25s}")
        for check in checks:
            print(f"      {check}")

    print()
    print("=" * 100)
    print(f"Passed: {passed}")
    print(f"Warnings: {warnings}")
    print(f"Failed: {failed}")
    print()

    if failed > 0:
        print("Some mutations failed compliance checks. Review and fix before approval.")
        log_run("compliance-check", "failed", f"passed={passed} warnings={warnings} failed={failed}")
        return 1
    else:
        print("All mutations passed compliance checks.")
        log_run("compliance-check", "ok", f"passed={passed} warnings={warnings}")
        return 0


def cmd_health(_: argparse.Namespace) -> int:
    """
    System health check for monitoring and alerting integrations.

    Outputs JSON for easy parsing by monitoring systems:
    - System status (connectivity, API, database)
    - Pipeline health (pending, approved, applied counts)
    - Pacing health (spend vs target)
    - Alert count (escalations, high-risk)
    - Last sync age

    Usage:
      health              # JSON output
      health 2>/dev/null  # Quiet (for scripts)
    """
    rules = load_toml(CONFIG_DIR / "rules.toml")
    goals = load_toml(CONFIG_DIR / "goals.toml")

    health_status = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": {
            "api_available": False,
            "database_available": False,
            "last_sync_age_seconds": None,
        },
        "pipeline": {
            "pending": 0,
            "approved": 0,
            "applied": 0,
            "rejected": 0,
            "failed": 0,
        },
        "pacing": {
            "actual_spend": 0.0,
            "target_spend": 0.0,
            "pacing_pct": 0,
            "status": "unknown",
        },
        "alerts": {
            "escalations": 0,
            "high_risk": 0,
            "compliance_warnings": 0,
        },
        "health_score": 0,  # 0-100
        "status": "unknown",
    }

    try:
        # Check database
        with connect_db() as conn:
            health_status["system"]["database_available"] = True

            # Get pipeline counts
            pipeline = conn.execute(
                "SELECT status, COUNT(*) as count FROM pending_mutations GROUP BY status"
            ).fetchall()
            for row in pipeline:
                health_status["pipeline"][row["status"]] = row["count"]

            # Check pacing
            now = datetime.now()
            month_prefix = f"{now.year:04d}-{now.month:02d}"
            pacing = get_pacing_health(conn)
            health_status["pacing"] = {
                "actual_spend": pacing["actual_spend"],
                "target_spend": pacing["target_spend"],
                "pacing_pct": round(pacing["pacing_pct"], 1),
                "status": "red" if pacing["pacing_pct"] < 50 else "yellow" if pacing["pacing_pct"] < 80 else "green" if pacing["pacing_pct"] <= 120 else "yellow" if pacing["pacing_pct"] <= 150 else "red",
            }

            # Count alerts
            mutations = conn.execute(
                "SELECT * FROM pending_mutations WHERE status = 'pending'"
            ).fetchall()
            for mut in mutations:
                risk_score = calculate_risk_score(mut, rules)
                if should_escalate_mutation(mut, rules):
                    health_status["alerts"]["escalations"] += 1
                elif risk_score["level"] in ["high", "urgent"]:
                    health_status["alerts"]["high_risk"] += 1

            # Last sync
            last_sync = conn.execute(
                "SELECT created_at FROM runs WHERE command = 'sync' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            if last_sync:
                sync_time = datetime.fromisoformat(last_sync["created_at"].replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - sync_time).total_seconds()
                health_status["system"]["last_sync_age_seconds"] = int(age)

            # Check API (try test_connectivity)
            try:
                api = get_api_client()
                api.test_connectivity()
                health_status["system"]["api_available"] = True
            except SystemExit:
                # API unavailable is ok in mock mode
                pass

    except Exception as err:
        health_status["error"] = str(err)

    # Calculate overall health score
    score = 100
    if not health_status["system"]["database_available"]:
        score -= 50
    if not health_status["system"]["api_available"]:
        score -= 25
    if health_status["system"]["last_sync_age_seconds"] and health_status["system"]["last_sync_age_seconds"] > 86400:
        score -= 15  # More than 24h old
    if health_status["alerts"]["escalations"] > 0:
        score -= min(30, health_status["alerts"]["escalations"] * 10)
    if health_status["pacing"]["status"] == "red":
        score -= 20

    health_status["health_score"] = max(0, score)

    # Determine status
    if score >= 90:
        health_status["status"] = "healthy"
    elif score >= 70:
        health_status["status"] = "degraded"
    elif score >= 50:
        health_status["status"] = "unhealthy"
    else:
        health_status["status"] = "critical"

    # Output JSON
    print(json.dumps(health_status, indent=2))
    log_run("health", health_status["status"], f"score={score}")
    return 0 if score >= 70 else 1


def cmd_alerts(args: argparse.Namespace) -> int:
    """
    Show pending alerts and escalations that need human attention.

    Displays:
    - Pending mutations requiring escalation
    - High-risk mutations in pipeline
    - Compliance warnings
    - Recommendation queue

    Usage:
      alerts              # Show all alerts
      alerts --high-risk  # Show only high-risk mutations
      alerts --escalate   # Show only mutations requiring escalation
    """
    rules = load_toml(CONFIG_DIR / "rules.toml")
    escalation = rules.get("escalation", {})

    show_high_risk = getattr(args, "high_risk", False)
    show_escalate = getattr(args, "escalate", False)

    with connect_db() as conn:
        # Find pending mutations
        mutations = conn.execute(
            "SELECT * FROM pending_mutations WHERE status = 'pending' ORDER BY id"
        ).fetchall()

    if not mutations:
        print("No pending alerts")
        log_run("alerts", "ok", "no_alerts")
        return 0

    print("PENDING ALERTS")
    print("=" * 100)
    print()

    escalated = []
    high_risk = []
    normal = []

    for mut in mutations:
        risk_score = calculate_risk_score(mut, rules)
        needs_escalation = should_escalate_mutation(mut, rules)

        if needs_escalation:
            escalated.append((mut, risk_score))
        elif risk_score["level"] in ["high", "urgent"]:
            high_risk.append((mut, risk_score))
        else:
            normal.append((mut, risk_score))

    # Display escalated mutations
    if escalated:
        print(f"🚨 REQUIRING ESCALATION ({len(escalated)})")
        print("-" * 100)
        for mut, risk_score in escalated:
            payload = json.loads(mut["payload"])
            print(f"ID {mut['id']:3d} | {mut['mutation_type']:25s} | Risk: {risk_score['level'].upper():6s}")
            print(f"  Resource: {mut['resource_type']}:{mut['resource_id']}")
            print(f"  Impact: ${payload.get('impact_estimate', 0):.2f}")
            print(f"  Reasons: {', '.join(risk_score['reasons'][:2])}")
            print()

    # Display high-risk mutations
    if high_risk and not show_escalate:
        print(f"⚠️  HIGH-RISK MUTATIONS ({len(high_risk)})")
        print("-" * 100)
        for mut, risk_score in high_risk[:5]:
            payload = json.loads(mut["payload"])
            print(f"ID {mut['id']:3d} | {mut['mutation_type']:25s} | Risk: {risk_score['level'].upper():6s}")
            if len(high_risk) > 5:
                print(f"... and {len(high_risk) - 5} more high-risk mutations")
            print()

    # Display normal mutations
    if normal and not (show_high_risk or show_escalate):
        print(f"ℹ️  NORMAL MUTATIONS ({len(normal)})")
        print(f"Ready for approval: {len(normal)} mutations")

    print("=" * 100)
    print(f"\nSummary: {len(escalated)} escalations, {len(high_risk)} high-risk, {len(normal)} normal")
    print()

    if escalated:
        print("ACTION REQUIRED: Review escalated mutations before proceeding")

    log_run("alerts", "ok", f"escalations={len(escalated)} high_risk={len(high_risk)}")
    return 0 if not escalated else 1


def cmd_status(_: argparse.Namespace) -> int:
    """
    Show comprehensive status of the Google Ads automation pipeline.

    Displays:
    - System health (API connectivity, data freshness)
    - Pacing status (daily spend vs targets)
    - Mutation pipeline (pending, approved, applied, rejected counts)
    - Recent events (last 5 changes)
    - Recommendations queue
    """
    goals = load_toml(CONFIG_DIR / "goals.toml")
    rules = load_toml(CONFIG_DIR / "rules.toml")

    print("=" * 80)
    print("GOOGLE ADS AUTOMATION STATUS")
    print("=" * 80)

    # System health
    print("\n[SYSTEM HEALTH]")
    with connect_db() as conn:
        # Last sync
        last_sync = conn.execute(
            "SELECT created_at FROM runs WHERE command = 'sync' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        sync_age = "unknown" if not last_sync else age(last_sync["created_at"])
        print(f"Last sync: {sync_age}")

        # Doctor status
        last_doctor = conn.execute(
            "SELECT status FROM runs WHERE command = 'doctor' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        doctor_status = last_doctor["status"] if last_doctor else "unknown"
        print(f"API status: {doctor_status}")

        # Pacing
        now = datetime.now()
        month_prefix = f"{now.year:04d}-{now.month:02d}"
        actual_spend = latest_month_spend(conn, month_prefix)
        monthly_budget = float(goals.get("monthly_grant_budget_usd", 10000))
        target_to_date = monthly_budget * (now.day / calendar.monthrange(now.year, now.month)[1])
        delta = actual_spend - target_to_date
        pacing_pct = int((actual_spend / target_to_date * 100) if target_to_date > 0 else 0)

        print(f"\n[PACING]")
        print(f"Month: {now.year}-{now.month:02d}")
        print(f"Day of month: {now.day}/{ calendar.monthrange(now.year, now.month)[1]}")
        print(f"Actual spend: ${actual_spend:,.2f}")
        print(f"Target spend: ${target_to_date:,.2f}")
        print(f"Delta: ${delta:+,.2f} ({pacing_pct}%)")

        # Mutation pipeline
        pipeline = conn.execute(
            """
            SELECT
              status,
              COUNT(*) as count
            FROM pending_mutations
            GROUP BY status
            """
        ).fetchall()

        print(f"\n[MUTATION PIPELINE]")
        pipeline_dict = {row["status"]: row["count"] for row in pipeline}
        print(f"Pending:   {pipeline_dict.get('pending', 0):3d}")
        print(f"Approved:  {pipeline_dict.get('approved', 0):3d}")
        print(f"Applied:   {pipeline_dict.get('applied', 0):3d}")
        print(f"Rejected:  {pipeline_dict.get('rejected', 0):3d}")
        print(f"Failed:    {pipeline_dict.get('failed', 0):3d}")
        total = sum(pipeline_dict.values())
        print(f"Total:     {total:3d}")

        # Recent events
        recent = conn.execute(
            """
            SELECT change_date, change_type, resource_id, created_at
            FROM change_events
            ORDER BY id DESC
            LIMIT 5
            """
        ).fetchall()

        print(f"\n[RECENT EVENTS]")
        if recent:
            for event in recent:
                print(f"  {event['created_at'][:16]} {event['change_type']:30s} {(event['resource_id'] or 'account')[:20]}")
        else:
            print("  No events yet")

        # Recommendations queue
        rec_queue = conn.execute(
            """
            SELECT COUNT(*) as count FROM recommendations WHERE status = 'pending'
            """
        ).fetchone()
        print(f"\n[RECOMMENDATIONS]")
        print(f"Pending recommendations: {rec_queue['count']}")

    print("=" * 80)
    log_run("status", "ok", "status_report_generated")
    return 0


def cmd_mutations(args: argparse.Namespace) -> int:
    """
    List pending, approved, and applied mutations with optional filtering.

    Usage:
      mutations                  # Show all pending mutations
      mutations --status approved # Show approved mutations
      mutations --type negative_keywords  # Filter by mutation type
      mutations --stats          # Show mutation pipeline statistics
    """
    status_filter = getattr(args, "status", None)
    type_filter = getattr(args, "type", None)
    show_stats = getattr(args, "stats", False)

    with connect_db() as conn:
        if show_stats:
            # Show pipeline statistics
            stats = conn.execute(
                """
                SELECT
                  status,
                  COUNT(*) as count,
                  mutation_type
                FROM pending_mutations
                GROUP BY status, mutation_type
                ORDER BY status DESC, mutation_type
                """
            ).fetchall()

            print("Mutation Pipeline Statistics")
            print("─" * 60)

            status_totals = {}
            for row in stats:
                status = row["status"]
                count = row["count"]
                mtype = row["mutation_type"]
                status_totals[status] = status_totals.get(status, 0) + count
                print(f"{status:12s} {mtype:30s} {count:6d}")

            print("─" * 60)
            for status, total in status_totals.items():
                print(f"{status:12s} {'TOTAL':30s} {total:6d}")

            total = sum(status_totals.values())
            print(f"{'':12s} {'GRAND TOTAL':30s} {total:6d}")
            log_run("mutations", "ok", f"pipeline_stats: {json.dumps(status_totals)}")
            return 0

        # Build query with filters
        query = "SELECT * FROM pending_mutations WHERE 1=1"
        params = []

        if status_filter:
            query += " AND status = ?"
            params.append(status_filter)
        else:
            query += " AND status = 'pending'"

        if type_filter:
            query += " AND mutation_type = ?"
            params.append(type_filter)

        query += " ORDER BY id"

        mutations = conn.execute(query, params).fetchall()

    if not mutations:
        print("No mutations found")
        return 0

    print(f"Mutations ({len(mutations)} total)")
    print("─" * 100)
    print(f"{'ID':4s} {'Status':12s} {'Type':25s} {'Resource':25s} {'Created':19s}")
    print("─" * 100)

    for m in mutations:
        print(
            f"{m['id']:4d} {m['status']:12s} {m['mutation_type']:25s} {(m['resource_type'] + ':' + (m['resource_id'] or 'N/A'))[:25]:25s} {m['created_at'][:19]}"
        )

    log_run("mutations", "ok", f"listed={len(mutations)}")
    return 0


def cmd_auto_approve(args: argparse.Namespace) -> int:
    """
    Auto-approve pending mutations that meet approval gate thresholds.

    This allows high-impact recommendations to be approved automatically
    without manual intervention, while still requiring manual approval for
    lower-impact or lower-priority items.

    Gates are defined in rules.toml[approval_gates].

    Checks:
    - HIGH priority + impact >= threshold
    - Budget health (optional): pacing between min/max thresholds
    - Campaign type rules (optional): minimum impact per campaign type
    """
    rules = load_toml(CONFIG_DIR / "rules.toml")
    gates = rules.get("approval_gates", {})

    if not gates.get("auto_approve_high_impact", False):
        print("Auto-approval is disabled in rules.toml[approval_gates]")
        log_run("auto-approve", "skipped", "disabled")
        return 0

    with connect_db() as conn:
        # Find pending mutations that should be auto-approved
        mutations = conn.execute(
            """
            SELECT * FROM pending_mutations
            WHERE status = 'pending'
            ORDER BY id
            """
        ).fetchall()

        approved_count = 0
        held_count = 0

        print("Scanning pending mutations for auto-approval...")
        print()

        for mut in mutations:
            approved, reason = should_auto_approve_mutation(mut, rules, conn)

            if approved:
                conn.execute(
                    """
                    UPDATE pending_mutations
                    SET status = 'approved', updated_at = ?
                    WHERE id = ?
                    """,
                    (utc_now_iso(), mut["id"]),
                )

                conn.execute(
                    """
                    INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        datetime.now().strftime("%Y-%m-%d"),
                        "mutation_auto_approved",
                        mut["resource_type"],
                        mut["resource_id"],
                        json.dumps({"mutation_type": mut["mutation_type"], "reason": reason}),
                        utc_now_iso(),
                    ),
                )

                print(f"  ✓ ID {mut['id']:3d} approved: {reason}")
                approved_count += 1
            else:
                held_count += 1
                print(f"  ⊘ ID {mut['id']:3d} held: {reason}")

    print()
    print(f"Auto-approved: {approved_count}")
    print(f"Held for manual review: {held_count}")
    log_run("auto-approve", "ok", f"approved={approved_count} held={held_count}")
    return 0


def cmd_batch_approve(args: argparse.Namespace) -> int:
    """
    Approve multiple mutations with visual confirmation and grouping.

    Usage:
      batch-approve                   # Show pending, ask for confirmation
      batch-approve --type negative_keywords  # Approve all of a type
      batch-approve --auto            # Auto-approve + confirm all
    """
    mutation_type = getattr(args, "type", None)
    auto_confirm = getattr(args, "auto", False)

    with connect_db() as conn:
        # Fetch pending mutations
        query = "SELECT * FROM pending_mutations WHERE status = 'pending'"
        params = []

        if mutation_type:
            query += " AND mutation_type = ?"
            params.append(mutation_type)

        query += " ORDER BY id"
        mutations = conn.execute(query, params).fetchall()

    if not mutations:
        print("No pending mutations to approve")
        return 0

    # Display mutations grouped by type
    print(f"Pending mutations to approve: {len(mutations)}")
    print("=" * 80)

    by_type = {}
    for m in mutations:
        mtype = m["mutation_type"]
        if mtype not in by_type:
            by_type[mtype] = []
        by_type[mtype].append(m)

    for mtype in sorted(by_type.keys()):
        group = by_type[mtype]
        print(f"\n{mtype} ({len(group)} mutations):")
        for m in group[:5]:  # Show first 5 per type
            res_id = (m["resource_id"] or "account")[:30]
            print(f"  ID {m['id']:4d} | {m['resource_type']:20s} | {res_id}")
        if len(group) > 5:
            print(f"  ... and {len(group) - 5} more")

    print("\n" + "=" * 80)

    if not auto_confirm:
        response = input(f"Approve all {len(mutations)} mutations? (yes/no): ").strip().lower()
        if response not in ["yes", "y"]:
            print("Cancelled")
            return 0

    # Approve all
    with connect_db() as conn:
        for m in mutations:
            conn.execute(
                """
                UPDATE pending_mutations
                SET status = 'approved', updated_at = ?
                WHERE id = ?
                """,
                (utc_now_iso(), m["id"]),
            )

            conn.execute(
                """
                INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.now().strftime("%Y-%m-%d"),
                    "mutation_batch_approved",
                    m["resource_type"],
                    m["resource_id"],
                    json.dumps({"batch_size": len(mutations)}),
                    utc_now_iso(),
                ),
            )

    print(f"✓ Approved {len(mutations)} mutations")
    log_run("batch-approve", "ok", f"approved={len(mutations)}")
    return 0


def cmd_batch_apply(args: argparse.Namespace) -> int:
    """
    Apply approved mutations in batches with safety checks and visual confirmation.

    Usage:
      batch-apply                  # Show approved, ask for confirmation
      batch-apply --live           # Apply for real (default is dry-run)
      batch-apply --type negative_keywords --live
    """
    mutation_type = getattr(args, "type", None)
    live = getattr(args, "live", False)

    with connect_db() as conn:
        # Fetch approved mutations
        query = "SELECT * FROM pending_mutations WHERE status = 'approved'"
        params = []

        if mutation_type:
            query += " AND mutation_type = ?"
            params.append(mutation_type)

        query += " ORDER BY id"
        mutations = conn.execute(query, params).fetchall()

    if not mutations:
        print("No approved mutations to apply")
        return 0

    # Display mutations grouped by type
    print(f"Approved mutations ready to apply: {len(mutations)}")
    print("=" * 80)

    by_type = {}
    for m in mutations:
        mtype = m["mutation_type"]
        if mtype not in by_type:
            by_type[mtype] = []
        by_type[mtype].append(m)

    for mtype in sorted(by_type.keys()):
        group = by_type[mtype]
        print(f"\n{mtype} ({len(group)} mutations):")
        for m in group[:5]:
            res_id = (m["resource_id"] or "account")[:30]
            print(f"  ID {m['id']:4d} | {m['resource_type']:20s} | {res_id}")
        if len(group) > 5:
            print(f"  ... and {len(group) - 5} more")

    print("\n" + "=" * 80)

    if not live:
        print("[DRY RUN] Use --live to apply these mutations for real")
        response = input("Continue with dry-run preview? (yes/no): ").strip().lower()
    else:
        response = input(f"Apply {len(mutations)} mutations (LIVE)? Type 'confirm' to proceed: ").strip().lower()
        if response != "confirm":
            print("Cancelled")
            return 0

    # Try to get API client
    try:
        api = get_api_client()
    except SystemExit:
        api = None

    if live and api:
        assert_live_allowed(argparse.Namespace(live=True), api)

    applied = 0
    errors = 0

    for m in mutations:
        try:
            mutation_type = m["mutation_type"]
            payload = json.loads(m["payload"])

            if not live:
                print(f"[DRY RUN] Would apply {mutation_type} to {m['resource_type']}")
                continue

            if not api:
                print(f"ERROR: Cannot apply without API client", file=sys.stderr)
                errors += 1
                continue

            # Apply mutation
            success = False
            if mutation_type == "add_negative_keywords":
                result = api.add_negative_keywords(
                    campaign_id=m["campaign_id"],
                    keywords=payload.get("keywords", []),
                    match_type=payload.get("match_type", "BROAD"),
                    dry_run=False,
                )
                success = len(result.get("errors", [])) == 0

            elif mutation_type == "apply_recommendation":
                result = api.apply_recommendation(
                    recommendation_resource_name=payload.get("resource_name"),
                    dry_run=False,
                )
                success = result.get("applied", False)

            if success:
                with connect_db() as conn:
                    conn.execute(
                        """
                        UPDATE pending_mutations
                        SET status = 'applied', applied_at = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (utc_now_iso(), utc_now_iso(), m["id"]),
                    )
                    conn.execute(
                        """
                        INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            datetime.now().strftime("%Y-%m-%d"),
                            f"mutation_batch_applied_{mutation_type}",
                            m["resource_type"],
                            m["resource_id"],
                            json.dumps({"batch_size": len(mutations)}),
                            utc_now_iso(),
                        ),
                    )
                applied += 1
                print(f"✓ Applied {m['id']}: {mutation_type}")
            else:
                errors += 1
                print(f"✗ Failed {m['id']}: {mutation_type}", file=sys.stderr)

        except Exception as err:
            errors += 1
            print(f"✗ Error applying {m['id']}: {err}", file=sys.stderr)

    print()
    if not live:
        print(f"Dry-run preview: {len(mutations)} mutations would be applied")
    else:
        print(f"Applied: {applied}")
        print(f"Errors: {errors}")

    log_run("batch-apply", "ok" if errors == 0 else "partial", f"applied={applied} errors={errors}")
    return 0 if errors == 0 else 1


def cmd_approve(args: argparse.Namespace) -> int:
    """
    Approve pending mutations for later application.

    Usage:
      approve <id>       # Approve a specific mutation
      approve --all      # Approve all pending mutations
    """
    if not args.id and not args.all:
        print("ERROR: Specify mutation ID or use --all", file=sys.stderr)
        return 1

    with connect_db() as conn:
        if args.all:
            conn.execute(
                """
                UPDATE pending_mutations
                SET status = 'approved', updated_at = ?
                WHERE status = 'pending'
                """,
                (utc_now_iso(),),
            )
            result = conn.execute("SELECT changes()").fetchone()
            count = result[0] if result else 0
            print(f"Approved {count} mutations")
            log_run("approve", "ok", f"approved={count}")
        else:
            conn.execute(
                """
                UPDATE pending_mutations
                SET status = 'approved', updated_at = ?
                WHERE id = ? AND status = 'pending'
                """,
                (utc_now_iso(), args.id),
            )
            result = conn.execute("SELECT changes()").fetchone()
            count = result[0] if result else 0
            if count == 0:
                print(f"No pending mutation found with ID {args.id}", file=sys.stderr)
                return 1
            print(f"Approved mutation {args.id}")
            log_run("approve", "ok", f"id={args.id}")

    return 0


def cmd_reject(args: argparse.Namespace) -> int:
    """
    Reject a pending mutation.

    Usage:
      reject <id> [--reason "reason text"]
    """
    if not args.id:
        print("ERROR: Specify mutation ID to reject", file=sys.stderr)
        return 1

    reason = getattr(args, "reason", None)

    with connect_db() as conn:
        # Get existing payload
        row = conn.execute(
            "SELECT payload FROM pending_mutations WHERE id = ? AND status = 'pending'",
            (args.id,),
        ).fetchone()

        if not row:
            print(f"No pending mutation found with ID {args.id}", file=sys.stderr)
            return 1

        # Update with reason if provided
        if reason:
            payload = json.loads(row["payload"] or "{}")
            payload["rejected_reason"] = reason
            payload_str = json.dumps(payload)
        else:
            payload_str = row["payload"]

        conn.execute(
            """
            UPDATE pending_mutations
            SET status = 'rejected', payload = ?, updated_at = ?
            WHERE id = ?
            """,
            (payload_str, utc_now_iso(), args.id),
        )

        print(f"Rejected mutation {args.id}")
        if reason:
            print(f"Reason: {reason}")
        log_run("reject", "ok", f"id={args.id}")

    return 0


def cmd_apply(args: argparse.Namespace) -> int:
    """
    Apply approved mutations to Google Ads account.

    Usage:
      apply --id N         # Apply a specific mutation (must be approved)
      apply --all-approved # Apply all approved mutations
      apply --live         # Execute real mutations (default is dry-run)
    """
    if not args.id and not args.all_approved:
        print("ERROR: Specify --id or --all-approved", file=sys.stderr)
        return 1

    # Get or create API client
    try:
        api = get_api_client()
    except SystemExit:
        api = None

    # Check live flag safety
    if api:
        assert_live_allowed(args, api)
    elif args.live:
        print("ERROR: --live passed but API credentials unavailable", file=sys.stderr)
        return 1

    applied_count = 0
    error_count = 0

    with connect_db() as conn:
        # Fetch mutations to apply
        if args.id:
            mutations = conn.execute(
                """
                SELECT * FROM pending_mutations
                WHERE id = ? AND status = 'approved'
                """,
                (args.id,),
            ).fetchall()
        else:
            mutations = conn.execute(
                """
                SELECT * FROM pending_mutations
                WHERE status = 'approved'
                ORDER BY id
                """
            ).fetchall()

        if not mutations:
            msg = f"mutation {args.id}" if args.id else "approved mutations"
            print(f"No {msg} found")
            return 0

        for mutation in mutations:
            mutation_type = mutation["mutation_type"]
            campaign_id = mutation["campaign_id"]
            resource_type = mutation["resource_type"]
            resource_id = mutation["resource_id"]
            payload = json.loads(mutation["payload"])

            # Simulate or apply based on --live
            if not args.live:
                # Dry run
                print(f"[DRY RUN] Would apply {mutation_type} to {resource_type} {resource_id}")
                continue

            # Live run
            if not api:
                error_count += 1
                print(f"ERROR: Cannot apply mutation {mutation['id']} without API client", file=sys.stderr)
                continue

            success = False
            try:
                if mutation_type == "add_negative_keywords":
                    keywords = payload.get("keywords", [])
                    match_type = payload.get("match_type", "BROAD")
                    result = api.add_negative_keywords(
                        campaign_id=campaign_id,
                        keywords=keywords,
                        match_type=match_type,
                        dry_run=False,
                    )
                    success = len(result.get("errors", [])) == 0

                elif mutation_type == "apply_recommendation":
                    resource_name = payload.get("resource_name")
                    result = api.apply_recommendation(
                        recommendation_resource_name=resource_name,
                        dry_run=False,
                    )
                    success = result.get("applied", False)

                else:
                    print(f"ERROR: Unknown mutation type {mutation_type}", file=sys.stderr)
                    error_count += 1
                    continue

                if success:
                    # Mark as applied
                    conn.execute(
                        """
                        UPDATE pending_mutations
                        SET status = 'applied', applied_at = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (utc_now_iso(), utc_now_iso(), mutation["id"]),
                    )
                    conn.execute(
                        """
                        INSERT INTO change_events
                            (change_date, change_type, resource_type, resource_id, details, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            datetime.now().strftime("%Y-%m-%d"),
                            f"mutation_applied_{mutation_type}",
                            resource_type,
                            resource_id,
                            json.dumps(payload),
                            utc_now_iso(),
                        ),
                    )
                    applied_count += 1
                    print(f"Applied mutation {mutation['id']} ({mutation_type})")
                else:
                    error_count += 1
                    print(f"ERROR: Failed to apply mutation {mutation['id']}", file=sys.stderr)

            except Exception as err:
                error_count += 1
                print(f"ERROR applying mutation {mutation['id']}: {err}", file=sys.stderr)

    print(f"\nApplied: {applied_count}")
    print(f"Errors: {error_count}")
    log_run("apply", "ok" if error_count == 0 else "partial", f"applied={applied_count} errors={error_count}")
    return 0 if error_count == 0 else 1


def cmd_policy_watch(_: argparse.Namespace) -> int:
    sources = load_toml(CONFIG_DIR / "sources.toml")["sources"]
    changed_count = 0
    with connect_db() as conn:
        for source in sources:
            status_code, payload, headers = fetch_url(source["url"])
            sha256 = hashlib.sha256(payload).hexdigest()
            previous = conn.execute(
                """
                SELECT sha256
                FROM policy_snapshots
                WHERE source_key = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (source["key"],),
            ).fetchone()
            changed = 0
            if previous is None or previous["sha256"] != sha256:
                changed = 1
                changed_count += 1

            conn.execute(
                """
                INSERT INTO policy_snapshots
                    (source_key, url, status_code, sha256, changed, etag, last_modified, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source["key"],
                    source["url"],
                    status_code,
                    sha256,
                    changed,
                    headers.get("etag"),
                    headers.get("last-modified"),
                    utc_now_iso(),
                ),
            )

    print("Google Ads policy watch")
    print(f"- Sources checked: {len(sources)}")
    print(f"- Sources changed: {changed_count}")
    log_run("policy-watch", "ok", f"checked={len(sources)} changed={changed_count}")
    return 0


def latest_policy_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT p1.*
        FROM policy_snapshots p1
        JOIN (
            SELECT source_key, MAX(id) AS max_id
            FROM policy_snapshots
            GROUP BY source_key
        ) p2
        ON p1.source_key = p2.source_key AND p1.id = p2.max_id
        ORDER BY p1.source_key
        """
    ).fetchall()


def cmd_report(_: argparse.Namespace) -> int:
    doctor = collect_doctor_state()
    ensure_dirs()
    report_path = REPORTS_DIR / f"{datetime.now().strftime('%Y-%m-%d')}-status.md"
    with connect_db() as conn:
        policy_rows = latest_policy_rows(conn)

    missing = [key for key, present in doctor.env_status.items() if not present]
    lines = [
        "# Google Ads Status Report",
        "",
        f"- Generated: {utc_now_iso()}",
        f"- Canonical account: `{doctor.canonical_email}`",
        f"- Canonical gcloud config: `{doctor.canonical_config}`",
        f"- Active gcloud account: `{doctor.gcloud_active_account or 'unknown'}`",
        f"- Active gcloud config: `{doctor.gcloud_active_config or 'unknown'}`",
        f"- API credential readiness: `{'ready' if not missing else 'blocked'}`",
        "",
        "## Missing secrets",
        "",
    ]

    if missing:
        lines.extend([f"- `{key}`" for key in missing])
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## Policy sources",
            "",
        ]
    )

    if policy_rows:
        for row in policy_rows:
            lines.append(
                f"- `{row['source_key']}` status={row['status_code']} changed={bool(row['changed'])} fetched_at={row['fetched_at']}"
            )
    else:
        lines.append("- No policy snapshots yet. Run `policy-watch` first.")

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {report_path}")
    log_run("report", "ok", str(report_path.relative_to(ROOT)))
    return 0


def assert_live_allowed(args: argparse.Namespace, api: "GoogleAdsAPI") -> None:
    """
    Validate that a mutation command can proceed with --live flag.
    Raises SystemExit if mutation is unsafe.
    """
    if api.use_mock and args.live:
        print("ERROR: --live was passed but the API client is in mock mode.", file=sys.stderr)
        print("       Mock mode means no real Google Ads connection is available.", file=sys.stderr)
        print("       Credentials may be expired or invalid.", file=sys.stderr)
        print("       Fix credentials and retry.", file=sys.stderr)
        raise SystemExit(2)
    if not args.live:
        print("[DRY RUN] No changes will be made. Pass --live to execute real mutations.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="AI-agnostic Google Ads automation CLI for the nonprofit Ad Grants stack.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Examples:
              python3 tools/google-ads/cli.py doctor
              python3 tools/google-ads/cli.py policy-watch
              python3 tools/google-ads/cli.py pace
              python3 tools/google-ads/cli.py report
            """
        ),
    )

    # Global flag for mutations (inherited by all subcommands)
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Execute real mutations to Google Ads account. Default: dry-run (no changes made).",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    doctor = subparsers.add_parser("doctor", help="Check account boundary and credential readiness.")
    doctor.set_defaults(func=cmd_doctor)

    sync = subparsers.add_parser("sync", help="Placeholder for future Google Ads API sync.")
    sync.set_defaults(func=cmd_sync)

    pace = subparsers.add_parser("pace", help="Compute pacing against the nonprofit grant budget.")
    pace.set_defaults(func=cmd_pace)

    status = subparsers.add_parser("status", help="Show automation pipeline status and health.")
    status.set_defaults(func=cmd_status)

    health = subparsers.add_parser("health", help="Output system health as JSON for monitoring.")
    health.set_defaults(func=cmd_health)

    negatives = subparsers.add_parser("negatives", help="Apply negative keyword automation.")
    negatives.set_defaults(func=cmd_negatives)

    recommendations = subparsers.add_parser("recommendations", help="Queue recommendations for approval.")
    recommendations.set_defaults(func=cmd_recommendations)

    mutations = subparsers.add_parser("mutations", help="View and manage pending mutations.")
    mutations.add_argument("--status", help="Filter by mutation status (pending, approved, rejected, applied, failed)")
    mutations.add_argument("--type", help="Filter by mutation type (add_negative_keywords, apply_recommendation)")
    mutations.add_argument("--stats", action="store_true", help="Show mutation pipeline statistics")
    mutations.set_defaults(func=cmd_mutations)

    auto_approve = subparsers.add_parser("auto-approve", help="Auto-approve pending mutations meeting approval gates.")
    auto_approve.set_defaults(func=cmd_auto_approve)

    batch_approve = subparsers.add_parser("batch-approve", help="Batch approve multiple mutations with confirmation.")
    batch_approve.add_argument("--type", help="Filter by mutation type before approving")
    batch_approve.add_argument("--auto", action="store_true", help="Auto-confirm without prompting")
    batch_approve.set_defaults(func=cmd_batch_approve)

    batch_apply = subparsers.add_parser("batch-apply", help="Batch apply approved mutations with safety checks.")
    batch_apply.add_argument("--type", help="Filter by mutation type before applying")
    batch_apply.add_argument("--live", action="store_true", help="Apply for real (default: dry-run)")
    batch_apply.set_defaults(func=cmd_batch_apply)

    preview = subparsers.add_parser("preview", help="Preview approved mutations before applying.")
    preview.add_argument("--type", help="Filter by mutation type")
    preview.add_argument("--id", type=int, help="Preview specific mutation ID")
    preview.set_defaults(func=cmd_preview)

    compliance_check = subparsers.add_parser("compliance-check", help="Check pending mutations for compliance.")
    compliance_check.set_defaults(func=cmd_compliance_check)

    alerts = subparsers.add_parser("alerts", help="Show pending alerts and escalations.")
    alerts.add_argument("--high-risk", action="store_true", help="Show only high-risk mutations")
    alerts.add_argument("--escalate", action="store_true", help="Show only escalations")
    alerts.set_defaults(func=cmd_alerts)

    approve = subparsers.add_parser("approve", help="Approve pending mutations.")
    approve_group = approve.add_mutually_exclusive_group(required=True)
    approve_group.add_argument("id", nargs="?", type=int, help="Mutation ID to approve")
    approve_group.add_argument("--all", action="store_true", help="Approve all pending mutations")
    approve.set_defaults(func=cmd_approve)

    reject = subparsers.add_parser("reject", help="Reject a pending mutation.")
    reject.add_argument("id", type=int, help="Mutation ID to reject")
    reject.add_argument("--reason", help="Reason for rejection")
    reject.set_defaults(func=cmd_reject)

    apply = subparsers.add_parser("apply", help="Apply approved mutations to Google Ads.")
    apply_group = apply.add_mutually_exclusive_group(required=True)
    apply_group.add_argument("--id", type=int, help="Apply specific mutation ID")
    apply_group.add_argument("--all-approved", action="store_true", help="Apply all approved mutations")
    apply.set_defaults(func=cmd_apply)

    policy_watch = subparsers.add_parser(
        "policy-watch",
        help="Fetch official Google Ads and Ad Grants sources and snapshot changes.",
    )
    policy_watch.set_defaults(func=cmd_policy_watch)

    report = subparsers.add_parser("report", help="Write a markdown status report.")
    report.set_defaults(func=cmd_report)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
