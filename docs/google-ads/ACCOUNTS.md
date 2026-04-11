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

## Current account structure

The current nonprofit Google Ads customer account is:

- `Vila Solidária`
- customer ID `592-920-2435`

This account is **not** a manager account.

It is currently linked to an upstream manager account controlled by Google Ad Grants:

- `Ad Grants Netherlands`
- manager customer ID `715-717-3541`

This matters because:
- API Center is not available from the client account
- the Google-managed Ad Grants manager does not automatically give us API Center access
- we still need a manager account that we control if we want to request a developer token and run our own automation

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

1. A customer-owned Google Ads manager account (MCC)
2. A manager-to-client link invitation from that MCC to `592-920-2435`
3. Acceptance of that manager link from the client account
4. Google Ads API developer token from the customer-owned MCC API Center
5. OAuth client for the automation system
6. Refresh token for the automation runtime
7. Final manager customer ID entry in `config/google-ads/account.toml`

Until those are provisioned, the repo supports governance, documentation awareness, pacing, and reporting scaffolding, but not live API mutation.

## Developer token rule

The developer token must be requested from the API Center of a **customer-owned Google Ads manager account** while logged in as `steve@yeshua.academy`.

Official entrypoint:

- `https://ads.google.com/aw/apicenter`

Official docs:

- `https://developers.google.com/google-ads/api/docs/get-started/dev-token`
- `https://developers.google.com/google-ads/api/docs/account-management/linking-manager-accounts`

Do not attempt to create or manage the developer token from:
- the client account `592-920-2435`
- the Google-managed upstream manager `715-717-3541`
- any Google account other than `steve@yeshua.academy`
