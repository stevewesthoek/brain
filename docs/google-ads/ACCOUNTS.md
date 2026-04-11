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

## Customer-owned manager account

A customer-owned Google Ads manager account now exists:

- `Yeshua Academy Google Ads Manager`
- manager customer ID `935-769-8503`
- controlled by `steve@yeshua.academy`

Current state:
- the manager account exists
- it still needs to be linked to client account `592-920-2435`
- after that, API Center should be accessed from manager account `935-769-8503`

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

1. A manager-to-client link invitation from MCC `935-769-8503` to `592-920-2435`
2. Acceptance of that manager link from the client account
3. Google Ads API developer token from manager account `935-769-8503`
4. OAuth client for the automation system
5. Refresh token for the automation runtime

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

The intended developer-token source is now:

- `Yeshua Academy Google Ads Manager`
- customer ID `935-769-8503`
