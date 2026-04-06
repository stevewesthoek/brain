---
name: meta-app-shape-empty-me-accounts
description: When /me/accounts returns empty array despite successful OAuth, the Meta app use case is wrong — must be "Manage Pages", not generic Facebook Login.
---

# Meta App Shape: /me/accounts Empty Response

## The insight

Meta apps come in two fundamental shapes:

1. **Facebook Login** (generic) — authenticates users, accesses user data
2. **Manage Pages** (specialized) — allows access to Pages the authenticated user manages

The OAuth flow can succeed with *either* shape. The user will see the login dialog, approve, and get redirected back. **But only the "Manage Pages" shape can query `/me/accounts` to list managed Pages.**

If you use the generic Facebook Login shape and request Page-level scopes (`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`), Facebook's OAuth dialog will reject them with `Invalid Scopes`. However, if those permissions are not explicitly requested, the app can still authenticate — but the resulting token has no Page access, so `/me/accounts` returns empty.

The confusion arises because:
- The OAuth flow *looks* like it worked (user logged in, got redirected)
- The app *looks* configured (status page shows `appIdConfigured: true`)
- But the token lacks the permissions to actually see Pages

## When this applies

Symptoms:
- User successfully completes Facebook OAuth flow and returns to your app
- Query `GET /me/accounts?fields=id,name,access_token` returns `"data": []` (empty)
- User is definitely an admin of at least one Facebook Page
- Graph API Explorer shows no error — just an empty response
- Status page or reviewer flow shows OAuth connected, but Pages dropdown is empty

## The approach

**Diagnosis sequence:**

1. Verify the user is actually an admin of a Page in their Facebook account
   - Have them log into facebook.com directly and check they can access the Page
   - Confirm they have Admin role (not Editor, Analyst, etc.)

2. Check the Meta app's use case
   - Go to developers.facebook.com → Your Apps → [App Name]
   - Settings → Basic
   - Look at the app description/type
   - If it says "Authenticate and request data from users with Facebook Login" → **this is the problem**
   - If it says "Manage Pages" → the shape is correct, problem is elsewhere

3. If the shape is wrong, rebuild the app
   - Create a NEW Meta app (don't modify the existing one)
   - Choose "Manage Pages" as the use case during creation
   - Copy the new App ID and App Secret
   - Update your deployment env with the new credentials
   - Redeploy
   - Test OAuth again

4. After redeploying, verify the runtime is using the new app
   - Don't just check Dokploy UI — verify the live redirect
   - Run: `curl -sI https://your-domain/api/facebook-review/oauth/start`
   - Check the `Location` header contains the expected `client_id` (not the old one)
   - If it still has the old app ID, the runtime hasn't picked up the new env — redeploy again

## The fix

**For Says the Bible specifically:**

1. Create a new Meta app at developers.facebook.com
2. During creation, select the **"Manage Pages"** use case (not the generic login option)
3. Configure it with:
   - App Domains: `saysthe.bible`
   - Site URL: `https://saysthe.bible/`
   - Valid OAuth Redirect URI: `https://saysthe.bible/api/facebook-review/oauth/callback`
   - Allowed domains for JavaScript SDK: `saysthe.bible`
   - Data Deletion Request URL: `https://saysthe.bible/data-deletion`

4. Copy the new App ID and App Secret
5. In Dokploy, update:
   - `FACEBOOK_APP_ID` → new app ID
   - `FACEBOOK_APP_SECRET` → new app secret
6. Redeploy the says-the-bible app
7. Verify: `curl -sI https://saysthe.bible/api/facebook-review/oauth/start | grep Location`
8. Check the redirect contains your new `client_id`
9. Test the reviewer flow again — `/me/accounts` should now return Pages

## Gotchas

- **Don't reuse the old app** — if it has the wrong shape, trying to "fix" it by adding permissions won't work. The use case is baked into the app at creation time. Create a new one.

- **Env updates alone aren't enough** — after updating Dokploy env, redeploy the app. The runtime reads env at startup; stale processes will keep using the old credentials.

- **The live redirect is the source of truth** — don't trust what Dokploy UI shows. Always verify the actual HTTP redirect contains the expected `client_id`. This catches the case where Dokploy is updated but the app hasn't redeployed yet.

- **Old app ID in the redirect = stale runtime** — if the redirect still has the old app ID, your deployment didn't pick up the new env. Redeploy again.

- **Pages must be admin-accessible** — if the user created the Page under a Business Account or doesn't have admin access, they won't see it even with the correct app shape. Have them verify directly in facebook.com.

## Context

Repo: says-the-bible  
Discovered: 2026-04-06  
Area: `src/app/api/facebook-review/`, `src/lib/facebook-review.ts`, Meta app configuration
