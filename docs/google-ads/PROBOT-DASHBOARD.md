# Google Ads Tab in ProBot Dashboard

## Overview

The ProBot dashboard includes a dedicated **Google Ads** tab that centralizes all nonprofit grant metrics, operational status, and policy monitoring data in one unified interface.

This tab is the single source of truth for Google Ads dashboard metrics across all three AI engines (Claude, Codex, Gemini) and any manual operations workflows.

## Tab Features

### Current Metrics Section

The tab displays real-time pacing information:

- **Daily Spend (USD):** Current daily spending against the nonprofit grant
- **Target Daily Budget:** Expected daily spend for the $10,000/month grant ($329/day)
- **% of Daily Target:** Visual indicator showing how close the account is to daily pacing goals
- **Day of Month:** Current day and days remaining in the calendar month
- **Progress Indicator:** Percentage of the month elapsed

### Health Status

- **System Status:** CLI doctor check (ready/warning/error)
- **Last Metrics Sync:** Timestamp of the most recent metrics snapshot from the database

### Color-Coded Indicators

- **Red (<50% of target):** Underspending — account is below pacing
- **Amber (50-99% of target):** Approaching target
- **Green (100%+ of target):** On or above target pace

### Policy Monitoring Section

Displays official Google Ad Grants documentation awareness:

- **Sources Tracked:** Number of official Google sources being monitored for policy changes
- **Changes Detected:** Count of documentation changes since last check
- **Last Check:** Timestamp of the most recent policy-watch run

### Account Information Footer

Displays the canonical account setup:

```
Account: Vila Solidária (592-920-2435)
Manager: Yeshua Academy Google Ads Manager (935-769-8503)
Program: Google Ad Grants (nonprofit)
Monthly Budget: $10,000 USD
```

## Data Source

All metrics are pulled from the local SQLite database:

```
~/.config/google-ads/google_ads.sqlite3
```

The database is populated by the CLI commands:
- `cli.py pace` — calculates daily pacing
- `cli.py policy-watch` — monitors official sources
- `cli.py doctor` — validates system health

## Accessing the Tab

1. Open ProBot dashboard (typically at `http://localhost:7070`)
2. Click the **Google Ads** tab in the navigation bar
3. View current metrics and status

The tab auto-refreshes every 30 seconds with the dashboard.

## Next Phase: Live API Integration

Once the Google Ads API credentials are fully provisioned, the dashboard will expand to include:

- Live campaign names and performance metrics
- Search term quality scores and recommendations
- Real spend data ingested from the Google Ads API
- Campaign-level pacing analysis
- Ad group health indicators
- Negative keyword suggestions

## AI-Agnostic Integration

The Google Ads tab is designed to work with any AI engine:

- **Claude:** Uses the `/google-ads` skill to inspect/interact
- **Codex:** Uses the same CLI and database
- **Gemini:** Can read reports and status via `/firecrawl` or MCP access

All three engines reference the same data source and CLI interface.

## Metrics Latency

Dashboard metrics may lag behind CLI output by up to 30 seconds (the auto-refresh interval). To see the absolute latest metrics:

```bash
python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py pace
python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py report
```

## Troubleshooting

### Google Ads Tab Shows "No Data"

- Database may not exist yet: Run `cli.py doctor` and ensure all prerequisites are met
- Path to database may have changed: Check the path in `config/google-ads/account.toml`

### Google Ads Tab Shows Error

- Database file permission issue: Ensure `~/.config/google-ads/google_ads.sqlite3` is readable
- Database corruption: Delete and recreate with `cli.py policy-watch`

### Metrics Not Updating

- Dashboard refresh interval: Wait 30 seconds for auto-refresh
- CLI commands not running: Manually run `cli.py pace` to update the database
- Check ProBot logs for errors reading the database

## Dashboard Code

The Google Ads dashboard integration is implemented in:

- **Source:** `projects/probot/src/bot/dashboard.ts`
- **Functions:**
  - `getGoogleAdsMetrics()` — reads from SQLite (lines ~680-730)
  - `renderGoogleAds(data)` — renders the tab UI (lines ~1246-1285)

## Related Documentation

- `docs/google-ads/README.md` — project overview
- `docs/google-ads/ARCHITECTURE.md` — system design
- `docs/google-ads/RUNBOOK.md` — operator workflow
- `docs/google-ads/COMPLIANCE.md` — Ad Grants compliance model
- `config/google-ads/goals.toml` — budget and pacing configuration
