---
name: meta-oauth-scope-failure
description: Use when Meta/Facebook OAuth fails with "Invalid Scopes" or page-level permissions are rejected despite the app appearing correctly configured — the root cause is almost always the Meta app's use-case type, not the permission list.
---

# Meta OAuth Scope Failure

## The insight

Meta gates which OAuth scopes are available based on the **app's use-case type**, set at creation time — not based on which permissions you request in your OAuth URL. A generic `Facebook Login` app will reject `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` at runtime even if those scopes are listed in the app's permissions dashboard and the OAuth call looks syntactically correct.

The wrong app shape can appear approved, pass the Meta app review UI, and still fail the actual OAuth call. The failure only surfaces when the user hits the OAuth dialog.

There are two distinct failure classes that look similar from the outside:

1. **App-shape failure** — wrong use-case type, blocking Page-level scopes at the OAuth dialog
2. **Runtime-config failure** — correct app shape, but the live deployment is still using stale credentials (old `client_id`, old secret) from a previous app or a cached env

Diagnosing them in the wrong order wastes significant time.

## When this applies

- Meta OAuth dialog says: `Invalid Scopes: pages_show_list, pages_read_engagement, pages_manage_posts`
- OAuth URL looks correct, scopes are listed in the Meta app dashboard, but the dialog still rejects them
- App has been through Meta review but Page permissions are still unavailable at runtime
- Credentials were rotated in the deployment env, but the live OAuth redirect still contains the old `client_id`
- A new Facebook app was created to replace a broken one, but behavior appears unchanged after deploy

## The approach

Diagnose in this order — do not skip ahead:

1. **Validate app-shape first.** Check the Meta app's use-case type in the Meta developer dashboard. For any flow that needs `pages_*` scopes, the app must be created under the `Manage Pages` use case (or equivalent). The generic `Authenticate and request data from users with Facebook Login` shape does not grant Page-level scopes.

2. **Validate Meta app settings second.** Confirm App Domains, Site URL, and Valid OAuth Redirect URIs match the live deployment exactly. A mismatch here produces a different error ("URL cannot be loaded / domain not added") but is often conflated with the scope error.

3. **Validate live runtime third.** Do not trust the deployment UI (Dokploy, Vercel, Railway, etc.) as the source of truth after a credential change. The deployment env can look updated while the running process still uses the old credentials. The correct check is to hit the live OAuth start route directly and inspect the `Location` header — the `client_id` in the redirect must match the new app ID.

Heuristics:
- `Invalid Scopes` → wrong app use-case type
- `URL cannot be loaded` or `domain not in list` → App Domains or Redirect URI misconfigured
- Correct scopes, correct redirect, but old `client_id` in live redirect → stale runtime env, redeploy required

## The fix

**App shape:** Create (or recreate) the Meta app using the `Manage Pages` use case. Minimal required scopes for a page-posting reviewer flow: `public_profile`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.

**Runtime verification:** After any credential change and redeploy, verify the live OAuth start route:

```bash
curl -sI https://{your-domain}/api/facebook/{oauth-start-path}
```

The `Location` header must contain `client_id={new-app-id}`. If it still shows the old ID, the process has not picked up the new env — force a full redeploy (not just a config update).

**Repo-specific implementation (says-the-bible):** See `brain/ai/skills/active/says-the-bible-facebook-reviewer-flow/SKILL.md` for the exact file paths, Meta settings, Dokploy steps, and verification commands for that repo.

## Gotchas

- Meta app approval status does not validate app-shape correctness. An approved app with the wrong use-case type will still fail the Page scope request.
- The Meta developer dashboard permissions tab shows which permissions *can* be requested — it does not prove those permissions will be granted by the OAuth dialog for the current app shape.
- Rotating credentials in a PaaS env (Dokploy, Render, Fly, etc.) does not always hot-reload the running process. Check the live redirect header — not the env dashboard.
- If a user pastes live Meta app secrets or long-lived tokens into the chat during debugging, treat them as exposed and rotate them immediately after the session.

## Context

Discovered: 2026-04-05  
Area: Meta/Facebook OAuth, Page-level permissions, PaaS runtime config  
Source repo: says-the-bible (see repo-specific skill for full implementation details)  
Applies to: any project using `pages_*` Meta OAuth scopes
