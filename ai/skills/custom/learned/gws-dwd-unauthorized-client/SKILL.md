---
name: gws-dwd-unauthorized-client
description: When a GWS service account call returns `unauthorized_client`, diagnose and fix it — the error always means a missing DWD scope in Admin Console, not a GCP IAM problem.
---

# GWS Service Account: unauthorized_client = missing DWD scope

## The insight
`unauthorized_client` from a GWS service account call has nothing to do with GCP IAM roles
or the service account's permissions in the GCP console. It means the scope used in the Python
call is not listed in the Admin Console domain-wide delegation entry for that service account.
GCP and Admin Console are two separate authorization layers — GCP grants the service account
existence; Admin Console grants it the right to impersonate org users for specific scopes.

## When this applies
Error: `unauthorized_client: Client is unauthorized to retrieve access tokens using this method,
or client not authorized for any of the scopes requested.`

Appears when calling any Google Admin SDK or Gmail/Drive/Calendar API via a service account
with `subject=` set to an org user.

## The approach
1. Identify the exact scope string used in `service_account.Credentials.from_service_account_file(..., scopes=[...])`.
2. Go to Admin Console → Security → Access and data control → API controls → Manage Domain Wide Delegation.
3. Find the entry for this service account's Client ID.
4. Check whether that exact scope string is in the authorized list.
5. If missing, add it and save. Changes take effect within ~1 minute.

Never touch GCP IAM for this error — it's irrelevant.

## The fix
Admin Console → Security → API Controls → Domain-wide Delegation → Edit entry → add missing scope.

## Gotchas
- `https://www.googleapis.com/auth/admin.directory.domain.readonly` and
  `https://www.googleapis.com/auth/admin.directory.domain` are different scopes.
  Read-only lets you list domains; the non-readonly version is required for
  `domains().delete()`. You need both if you want both operations.
- Each new scope requires a manual Admin Console edit. There is no way to grant
  scopes programmatically from the service account itself.
- The service account Client ID (long numeric string) is different from the service
  account email. Use the Client ID when editing the DWD entry.

## Context
Repo: brain (gws-org-wrapper setup)
Discovered: 2026-04-07
Area: operations/system-configs/bin/gws-org-wrapper
