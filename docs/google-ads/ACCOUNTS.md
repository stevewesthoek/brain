# Google Ads Accounts

## Canonical account

The only approved Google account for Google Ads work is:

- `steve@yeshua.academy`

This is the only account to use for:
- Google Ads Manager access
- the nonprofit Google Ads account itself
- Google Ads API developer token setup
- OAuth client creation for Google Ads automation
- Google Cloud config used for Google Ads automation

Do not use these accounts for Google Ads:
- `westhoek@hotmail.com`
- `info@prochat.tools`

## GCP config mapping

The local `gcloud` account/config mapping is:

- `personal` → `westhoek@hotmail.com`
- `prochat-tools` → `info@prochat.tools`
- `google-ads-nonprofit` → `steve@yeshua.academy`

Activate the Google Ads config before any Ads-related cloud work:

```bash
~/.local/bin/gcp-cli config configurations activate google-ads-nonprofit
```

Current bootstrap project:

- `project-d63f458f-8fba-450e-acf`

## Required future setup

The following Google Ads API prerequisites are still missing and must be created under `steve@yeshua.academy`:

1. Google Ads API developer token
2. OAuth client for the automation system
3. Refresh token for the automation runtime
4. Final Manager customer ID and customer ID entries in `config/google-ads/account.toml`

Until those are provisioned, the repo supports governance, documentation awareness, pacing, and reporting scaffolding, but not live API mutation.

## Developer token rule

The developer token must be requested from the Google Ads Manager API Center while logged in as `steve@yeshua.academy`.

Official entrypoint:

- `https://ads.google.com/aw/apicenter`

Official docs:

- `https://developers.google.com/google-ads/api/docs/get-started/dev-token`

Do not attempt to create or manage the developer token from any other Google account.
