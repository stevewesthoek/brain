# Google Ads Runbook

## Daily operator workflow

1. Activate the canonical Google Ads GCP config:

```bash
~/.local/bin/gcp-cli config configurations activate google-ads-nonprofit
```

2. Validate local readiness:

```bash
python3 tools/google-ads/cli.py doctor
```

3. Refresh Google documentation awareness:

```bash
python3 tools/google-ads/cli.py policy-watch
```

4. Review pacing:

```bash
python3 tools/google-ads/cli.py pace
```

5. Generate a status report:

```bash
python3 tools/google-ads/cli.py report
```

## Credential setup workflow

All credential setup must be performed under:

- Google account: `steve@yeshua.academy`
- gcloud config: `google-ads-nonprofit`

Required secrets that must remain local-only:
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_OAUTH_CLIENT_ID`
- `GOOGLE_ADS_OAUTH_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`

Store them outside git and inject them via shell environment or a local-only env loader.

### Developer token onboarding

The developer token is created in the Google Ads Manager UI, not in `gcloud`.

Current required path:

1. Sign into the Google Ads Manager account as `steve@yeshua.academy`
2. Open `https://ads.google.com/aw/apicenter`
3. Complete the API Access form
4. Record the resulting token locally, never in git
5. Update `config/google-ads/account.toml` statuses from `missing` to the real state

Official references:

- `https://developers.google.com/google-ads/api/docs/get-started/dev-token`
- `https://developers.google.com/google-ads/api/docs/oauth/overview`
- `https://developers.google.com/google-ads/api/docs/oauth/cloud-project`

## Reporting cadence

- Daily: `policy-watch`, `pace`, `report`
- Weekly: review official source changes and update `COMPLIANCE.md` if needed
- Monthly: compare utilization against the `$10,000` grant envelope and adjust goals/rules
