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

Because the current account `592-920-2435` is a client account, this workflow starts with creating or accessing a customer-owned manager account first.

Current required path:

1. Sign into Google Ads as `steve@yeshua.academy`
2. Use manager account `935-769-8503`
3. From that MCC, send a manager link invitation to client account `592-920-2435`
4. Accept that invitation from the client account
5. Open `https://ads.google.com/aw/apicenter` from manager account `935-769-8503`
6. Complete the API Access form
7. Record the resulting token locally, never in git
8. Update `config/google-ads/account.toml` statuses from `missing` to the real state

Official references:

- `https://developers.google.com/google-ads/api/docs/get-started/dev-token`
- `https://developers.google.com/google-ads/api/docs/oauth/overview`
- `https://developers.google.com/google-ads/api/docs/oauth/cloud-project`
- `https://developers.google.com/google-ads/api/docs/account-management/linking-manager-accounts`

## Reporting cadence

- Daily: `policy-watch`, `pace`, `report`
- Weekly: review official source changes and update `COMPLIANCE.md` if needed
- Monthly: compare utilization against the `$10,000` grant envelope and adjust goals/rules
