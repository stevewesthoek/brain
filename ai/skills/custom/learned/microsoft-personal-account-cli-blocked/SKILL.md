---
name: microsoft-personal-account-cli-blocked
description: All CLI access paths for free personal Microsoft accounts (Hotmail/Live/Outlook.com)
  fail in 2026. Prevents re-investigation of a confirmed dead end.
---

# Microsoft Personal Account — CLI Access Is Fully Blocked

## The insight
Free personal Microsoft accounts (Hotmail, Live, Outlook.com) are effectively locked out
of programmatic CLI access in 2026. Microsoft has closed every practical auth path for
consumer accounts. This is not a configuration problem — it is intentional platform
behaviour pushing users toward paid M365 accounts.

## When this applies
Any attempt to read/send email or access calendar for a personal `@hotmail.com`,
`@live.com`, or `@outlook.com` account via CLI.

Specific symptoms:
- `BasicAuthBlocked — LogonDenied` on IMAP connection
- `AADSTS160021: Application requested a user session which does not exist` in portal.azure.com
- `unauthorized_client: not enabled for consumers` on OAuth redirect
- `az login --allow-no-subscriptions` crashes with `NoneType.get` in `_subscription_selector.py`
- `portal.azure.com/consumers#view/...` URL downloads a file instead of opening the page

## The approach
Don't try. All five paths have been exhausted:

1. **IMAP + app passwords** — server returns `BasicAuthBlocked`. Basic auth was assumed
   to affect only business M365 accounts — confirmed it also blocks personal Outlook.com.
2. **`az login` personal account** — Azure CLI 2.84.0 bug crashes after OAuth succeeds,
   in the subscription selector, because personal accounts have no subscriptions.
3. **`m365` CLI** — designed for business tenants only. Needs Entra app registration,
   which itself fails for personal accounts.
4. **App registration via `portal.azure.com`** — session fails with `AADSTS160021`.
5. **`portal.azure.com/consumers` URL** — browser treats the `#fragment` URL as a
   file download, never opens the page.

## The fix
No CLI fix exists. Access personal Hotmail at `https://outlook.live.com` (browser only).

If Microsoft ever fixes their portal flow for personal accounts, the unblocked path is:
- portal.azure.com → App registrations → New → "Personal Microsoft accounts only"
- Get App ID → configure OAuth2/XOAUTH2 in an IMAP client (e.g., Himalaya)

## Gotchas
- App passwords look like they should work for IMAP — they don't; blocked server-side
- `m365` CLI is the wrong tool entirely for consumer accounts — do not install for this
- Azure CLI is designed for Azure resource management, not personal email access
- The `/consumers` tenant trick (used for organizational personal-account apps) does not
  work when the portal itself can't establish a session

## Context
Repo: brain  
Discovered: 2026-04-07  
Account: westhoek@hotmail.com  
Area: operations/accounts/email-inventory.md
