# Google Ads Automation

This directory is the source of truth for the `brain` Google Ads automation system.

Current scope:
- Yeshua Academy
- Google Ad Grants only
- up to `$10,000 USD/month`
- Search-led nonprofit acquisition and stewardship

Canonical files:
- `ARCHITECTURE.md` — system shape and execution model
- `ACCOUNTS.md` — account boundary and access rules
- `RUNBOOK.md` — operator workflow
- `COMPLIANCE.md` — Ad Grants program assumptions and documentation-watch model
- `PROBOT-DASHBOARD.md` — ProBot dashboard integration and metrics display

Primary CLI:

```bash
python3 tools/google-ads/cli.py doctor
python3 tools/google-ads/cli.py pace
python3 tools/google-ads/cli.py report
python3 tools/google-ads/cli.py policy-watch
```

## Dashboard

All Google Ads metrics are centralized in the **ProBot dashboard** under the **Google Ads** tab. This provides:

- Real-time pacing against the monthly grant budget
- Policy monitoring status (official Google sources)
- System health checks
- Account and program information

See `PROBOT-DASHBOARD.md` for details.

Every 30 seconds, the dashboard pulls the latest metrics from:
```
data/google-ads/google_ads.sqlite3
```
