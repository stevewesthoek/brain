---
name: clerk
description: Clerk authentication CLI — manage users, orgs, apps, sessions, and webhooks across all Clerk projects
---

# Clerk CLI

## What it is

Clerk CLI (`clerk`) is the official command-line tool for Clerk authentication service. It allows you to:

- **Authenticate** with your Clerk account (browser OAuth)
- **List and manage applications** (create, configure, inspect)
- **Inspect users, organizations, and sessions** (query, delete, export)
- **Manage webhooks** (configure endpoints, test events)
- **Run local development** with full sync to your live Clerk instance
- **Test authentication flows** before deployment

Clerk is used across multiple applications for passwordless auth, OAuth, and multi-factor authentication.

## When to use

- **Before building**: Inspect existing Clerk apps and configurations
- **During development**: Sync local auth with live Clerk instance, test flows
- **API discovery**: Browse available endpoints via `clerk` commands
- **User/org management**: Query or modify users, organizations, sessions programmatically
- **Webhook testing**: Trigger test events to verify webhook integrations
- **Production debugging**: Inspect user sessions, verify org permissions, audit logs

## Installation & Setup

```bash
# Already installed globally: /Users/Office/bin/clerk
clerk version

# First-time setup: authenticate with your Clerk account
clerk auth

# This opens a browser to log in to https://dashboard.clerk.com
# After login, credentials are stored at ~/.clerk.json (local only, gitignored)
```

## Authentication

Clerk CLI uses browser-based OAuth:

1. Run `clerk auth` (or just run any `clerk` command)
2. Browser opens → log in at https://dashboard.clerk.com
3. Credentials cached locally at `~/.clerk.json` (expires after ~30 days of inactivity; re-run `clerk auth` to refresh)

**Multiple accounts?** Run `clerk auth` to switch accounts. The CLI supports one active account at a time. Switch by re-authenticating.

## Common Commands

### Applications

```bash
# List all Clerk applications
clerk applications list

# Get details on a specific app (by app ID)
clerk applications get <app-id>

# Inspect API keys for development
clerk applications show-api-keys <app-id>
```

### Users

```bash
# Search and inspect users across all apps
clerk users list [--limit 100]

# Get specific user (by user ID or email)
clerk users get <user-id>

# Export all users to JSON
clerk users export
```

### Organizations

```bash
# List organizations (if enabled in your Clerk instance)
clerk organizations list

# Get organization details
clerk organizations get <org-id>
```

### Sessions & Tokens

```bash
# Inspect active sessions (useful for testing)
clerk sessions list

# Revoke a specific session
clerk sessions revoke <session-id>
```

### Webhooks

```bash
# List configured webhooks
clerk webhooks list

# View webhook details
clerk webhooks get <webhook-id>

# Test a webhook by triggering a sample event
clerk webhooks test <webhook-id> --event user.created
```

### Development

```bash
# Start Clerk development environment (syncs with live instance)
clerk dev

# This runs the local dev server in sync with your Clerk dashboard
```

## Credential Storage & Rotation

**Local credentials file:** `~/.clerk.json` (gitignored, not in repo)  
**Credential type:** Browser OAuth (no persistent API key)  
**Expiration:** ~30 days of inactivity (auto-refreshed on next auth)  
**Rotation:** Re-run `clerk auth` to refresh or switch accounts  
**Multiple accounts:** Use `clerk auth` to switch; only one active account per session

## Integration Notes

- **AI-agnostic:** Works with Claude, Codex, and Gemini equally
- **No API key management:** Uses OAuth, so no secrets to rotate in code
- **Per-app configuration:** Some Clerk features are per-application (retrieve via `clerk applications show-api-keys`)
- **Webhook testing:** Use `clerk webhooks test` to validate n8n or other webhook integrations before going live

## Automation Patterns

### Inspect all users (for scripts)
```bash
clerk users export > all_users.json
```

### List all apps and their settings (inventory)
```bash
clerk applications list --format json > clerk_apps_inventory.json
```

### Revoke sessions for a specific user (cleanup)
```bash
USER_ID="user_xxx"
clerk sessions list --user $USER_ID | grep -i "session" | awk '{print $1}' | xargs -I {} clerk sessions revoke {}
```

## Deep Links

- **Clerk Dashboard:** https://dashboard.clerk.com
- **Clerk API Reference:** https://clerk.com/docs/reference/backend-api
- **Clerk CLI Docs:** https://clerk.com/docs/cli
- **Applications & API Keys:** https://dashboard.clerk.com/apps
- **Webhooks:** https://dashboard.clerk.com/webhooks

## Troubleshooting

- **"Not authenticated"** → Run `clerk auth` to log in
- **"App not found"** → Verify app ID via `clerk applications list`
- **Webhook test fails** → Check endpoint is accessible; Clerk test uses a timeout of 10s
- **Session list empty** → Sessions are short-lived; check if users are actively logged in

## Related Skills & Tools

- `/whatsapp` — Another service integration pattern (credentials, CLI, automation)
- `/n8n` — Webhook management and workflow integration
- `stripe` CLI — Similar auth pattern (browser OAuth, local caching)
