---
name: says-the-bible-facebook-reviewer-flow
description: Use when wiring or repairing the Says the Bible Facebook reviewer flow, especially when Meta OAuth fails with invalid Page scopes, callback/domain errors, or production still redirects with an old app ID after env changes.
---

# Says The Bible Facebook Reviewer Flow

## The insight
There are two separate failure classes in the Says the Bible Facebook setup, and they look deceptively similar from the reviewer page.

The first class is Meta app-shape failure: a generic Facebook Login app can look mostly correct and still reject the actual Page scopes at OAuth time. For this repo, the reviewer flow only works reliably with a dedicated `Manage Pages` app shape requesting the minimal Page permissions.

The second class is app-runtime failure: even after Dokploy env is updated, the live Next.js Facebook review routes can still behave like they are bound to stale credentials. The correct test is not "the env value looks right in Dokploy"; the correct test is whether `/api/facebook-review/oauth/start` redirects with the expected `client_id`.

## When this applies
Use this skill when any of these show up:

- Facebook OAuth dialog says `Invalid Scopes: pages_show_list, pages_read_engagement, pages_manage_posts`
- Facebook says the callback URL or page cannot be loaded because the domain is not added
- The reviewer page at `/admin/facebook-review` loads, but the Facebook connect flow fails before Pages load
- Production Dokploy env has been updated, but `Connect Facebook Reviewer Account` still redirects to the old Meta app
- The live status page looks healthy, but OAuth still uses the wrong app ID

Repo-specific surfaces involved:

- `src/app/admin/facebook-review/page.tsx`
- `src/app/api/facebook-review/oauth/start/route.ts`
- `src/app/api/facebook-review/oauth/callback/route.ts`
- `src/app/api/facebook-review/status/route.ts`
- `src/lib/facebook-review.ts`
- `docs/marketing/facebook-os.md`

## The approach
Treat the debugging sequence as:

1. Validate the Meta app shape first.
2. Validate the exact Meta callback/domain settings second.
3. Validate the live runtime redirect third.

Do not jump straight to n8n or token debugging if OAuth itself is failing.

Heuristics:

- `Invalid Scopes` means the app shape/use case is wrong, not that the website button is wrong.
- `URL cannot be loaded` means App Domains or Valid OAuth Redirect URIs are wrong or incomplete.
- A stale `client_id` in the live redirect means runtime config is still wrong, regardless of what Dokploy shows.

## The fix
For Says the Bible, the stable Meta configuration is:

- Create a dedicated Meta app using the `Manage Pages` use case
- Do not rely on the generic `Authenticate and request data from users with Facebook Login` app shape if it rejects Page scopes
- Minimal permissions:
  - `public_profile`
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_posts`

Required Meta settings:

- App Domains:
  - `saysthe.bible`
- Site URL:
  - `https://saysthe.bible/`
- Valid OAuth Redirect URI:
  - `https://saysthe.bible/api/facebook-review/oauth/callback`
- Allowed domains for the JavaScript SDK:
  - `saysthe.bible`
- Data Deletion Request URL:
  - `https://saysthe.bible/data-deletion`

Recommended Meta settings:

- `Client OAuth login` -> `Yes`
- `Web OAuth login` -> `Yes`
- `Enforce HTTPS` -> `Yes`
- `Use Strict Mode for redirect URIs` -> `Yes`
- `Require app secret` -> `Off` unless app-side Graph calls are upgraded to send `appsecret_proof`
- Category -> `Education`

Repo/runtime fixes:

- Keep Facebook reviewer config reads centralized in `src/lib/facebook-review.ts`
- Use a runtime accessor instead of scattered direct env reads for the Facebook reviewer surfaces
- After any Dokploy credential change, redeploy and then verify:

```bash
curl -sI https://saysthe.bible/api/facebook-review/oauth/start
```

The `Location` header must contain the expected `client_id`.

Also verify:

```bash
curl -s https://saysthe.bible/api/facebook-review/status
```

Expected booleans for reviewer readiness:

- `appIdConfigured: true`
- `appSecretConfigured: true`
- `n8nWebhookConfigured: true`

`pageIdConfigured` and `accessTokenConfigured` can remain false for reviewer testing. They matter later for unattended pipeline posting.

## Gotchas
- A reviewer page that logs in successfully does not prove the Facebook flow is ready. The real checkpoint is successful Meta OAuth plus `/me/accounts` Page loading.
- Dokploy env updates alone are not the source of truth. The live redirect header is.
- Meta app approval does not mean the app can request the right Page scopes. The wrong app shape can still be "approved."
- If a user pastes live Meta secrets or long-lived tokens into chat, treat them as exposed and rotate them afterward.

## Context
Repo: says-the-bible  
Discovered: 2026-04-05  
Area: Facebook reviewer flow, Meta app configuration, Dokploy runtime config
