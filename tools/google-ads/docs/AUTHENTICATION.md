# Google Ads Authentication

## Purpose

This document defines the exact local authentication model for the Google Ads automation stack.
The goal is:

- minimal interaction after a machine restart
- one clear owner for each credential file
- no ambiguity about which Google account or OAuth client belongs to Google Ads

## Canonical identity

All Google Ads authentication and authorization must use:

- Google account: `steve@yeshua.academy`
- `gcloud` config: `google-ads-nonprofit`
- Google Ads manager account: `935-769-8503`
- Google Ads client account: `592-920-2435`

Do not use:

- `westhoek@hotmail.com`
- `info@prochat.tools`

for any Google Ads authentication step.

## Credential file ownership

### 1. Stable account constants

File:

- `~/.config/google-ads/brain-google-ads.env`

Owns:

- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- `GOOGLE_ADS_CUSTOMER_ID`

This file is for stable Google Ads account-specific values.
It is not the canonical owner of the renewable OAuth token state anymore.

### 2. OAuth desktop client download

File:

- `~/.config/google-ads/yeshua-google-ads-oauth.json`

Owns:

- the Google Cloud desktop OAuth client definition downloaded from the correct project

This file is used when running `gcloud auth application-default login`.

### 3. Active OAuth runtime credentials

File:

- `~/.config/gcloud/application_default_credentials.json`

Owns:

- active OAuth client ID
- active OAuth client secret
- active refresh token

This is the canonical runtime OAuth source for the Google Ads CLI.

## Runtime precedence

The Google Ads CLI resolves credentials in this order:

1. shell environment overrides
2. ADC file for OAuth values
3. local env file fallback

Concretely:

- OAuth values come from ADC first
- account constants come from `brain-google-ads.env`

This design prevents restart fragility caused by duplicated OAuth tokens in multiple places.

## Why this is robust

After a restart:

- ADC still exists on disk
- the refresh token remains available
- the CLI reads OAuth directly from ADC
- no manual token sync is required

As long as the refresh token remains valid, the runtime should be seamless.

## Standard startup check

Run:

```bash
~/.local/bin/gcp-cli config configurations activate google-ads-nonprofit
tools/google-ads/run.sh doctor
```

Expected:

- account boundary OK
- config boundary OK
- local env file present
- ADC file/client_id/client_secret/refresh_token all present

## Re-authentication

Only re-authenticate if:

- Google Ads commands fail with expired credentials
- Google Ads commands fail with insufficient scopes
- the ADC file was rotated or removed

Run:

```bash
~/.local/bin/gcp-cli auth application-default login \
  --client-id-file="$HOME/.config/google-ads/yeshua-google-ads-oauth.json" \
  --scopes="https://www.googleapis.com/auth/adwords,https://www.googleapis.com/auth/cloud-platform"
```

Use:

- Google account: `steve@yeshua.academy`

## Important warning

The ADC login must use the correct Google Ads desktop OAuth client.
If ADC is refreshed with a different client than the one intended for Google Ads, the CLI may stop working until ADC and the local runtime are realigned.

The correct operational pattern is:

- one Google Ads desktop OAuth client
- one ADC file
- one canonical Google account

## What not to do

- do not commit any of these files
- do not create duplicate Google Ads OAuth clients unless there is a deliberate rotation plan
- do not use multiple Google accounts for Google Ads auth
- do not treat the env file as the primary OAuth token store
