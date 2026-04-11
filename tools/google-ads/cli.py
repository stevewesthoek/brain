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
        except ImportError as e:
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
        with connect_db() as conn:
            # Store campaigns
            for campaign in campaigns:
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

            conn.commit()

        detail = f"campaigns={len(campaigns)} metrics=1 search_terms={len(search_terms)} recommendations={len(recommendations)}"
        print(f"✓ Sync complete: {detail}")
        log_run("sync", "ok", detail)
        return 0

    except GoogleAdsAPIError as e:
        detail = f"Google Ads API error: {e}"
        print(detail)
        log_run("sync", "error", detail)
        return 1
    except Exception as e:
        detail = f"Unexpected error during sync: {e}"
        print(detail)
        log_run("sync", "error", detail)
        return 1


def latest_month_spend(conn: sqlite3.Connection, month_prefix: str) -> float:
    row = conn.execute(
        """
        SELECT COALESCE(SUM(spend_usd), 0)
        FROM metrics_snapshots
        WHERE snapshot_date LIKE ?
        """,
        (f"{month_prefix}%",),
    ).fetchone()
    return float(row[0] or 0.0)


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

    print("Google Ads pacing")
    print(f"- Month budget: ${monthly_budget:,.2f}")
    print(f"- Day of month: {day_index}/{days_in_month}")
    print(f"- Target spend to date: ${target_to_date:,.2f}")
    print(f"- Actual spend to date: ${actual_spend:,.2f}")
    print(f"- Delta: ${delta:,.2f}")

    detail = f"target_to_date={target_to_date:.2f} actual={actual_spend:.2f} delta={delta:.2f}"
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
    subparsers = parser.add_subparsers(dest="command", required=True)

    doctor = subparsers.add_parser("doctor", help="Check account boundary and credential readiness.")
    doctor.set_defaults(func=cmd_doctor)

    sync = subparsers.add_parser("sync", help="Placeholder for future Google Ads API sync.")
    sync.set_defaults(func=cmd_sync)

    pace = subparsers.add_parser("pace", help="Compute pacing against the nonprofit grant budget.")
    pace.set_defaults(func=cmd_pace)

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
