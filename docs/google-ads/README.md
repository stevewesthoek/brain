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

Primary CLI:

```bash
python3 tools/google-ads/cli.py doctor
python3 tools/google-ads/cli.py pace
python3 tools/google-ads/cli.py report
python3 tools/google-ads/cli.py policy-watch
```
