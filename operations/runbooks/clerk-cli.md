# Clerk CLI Runbook

Clerk CLI reference for authentication management across all Clerk applications.

## Overview

**CLI:** `clerk` (installed globally at `~/bin/clerk`)  
**Auth:** Browser OAuth via https://dashboard.clerk.com  
**Local storage:** `~/.clerk.json` (gitignored, not in repo)  
**Expiration:** ~30 days of inactivity; auto-refreshes on next CLI use  
**Current version:** 0.0.2-canary (2026-04-12)

---

## Quick Start

```bash
# Authenticate (opens browser to dashboard.clerk.com)
clerk auth

# Check authentication status
clerk status

# List all Clerk applications
clerk applications list

# Get API keys for an app
clerk applications show-api-keys <app-id>
```

---

## Core Commands

### Authentication

```bash
# Log in (required before any command)
clerk auth

# Log out
clerk logout

# Check current auth status
clerk status
```

### Applications

```bash
# List all apps with details
clerk applications list

# Get specific app info
clerk applications get <app-id>

# Show API keys for an app (publishable + secret)
clerk applications show-api-keys <app-id>

# Get environment ID (useful for multi-env setups)
clerk applications get-env-id <app-id>
```

### Users

```bash
# List all users across all apps (paginated)
clerk users list [--limit 100] [--offset 0]

# Get specific user
clerk users get <user-id>

# Search by email
clerk users list --email <email>

# Export all users to JSON (useful for backup/audit)
clerk users export > users_export.json

# Inspect user metadata/attributes
clerk users get <user-id> --format json
```

### Organizations (if enabled)

```bash
# List organizations
clerk organizations list

# Get org details
clerk organizations get <org-id>

# List members in organization
clerk organizations members <org-id>
```

### Sessions

```bash
# List active sessions
clerk sessions list [--user-id <id>]

# Get specific session
clerk sessions get <session-id>

# Revoke a session
clerk sessions revoke <session-id>

# Revoke all sessions for a user
# (not direct — use the query-and-revoke pattern below)
```

### Webhooks

```bash
# List webhooks
clerk webhooks list

# Get webhook details
clerk webhooks get <webhook-id>

# Test webhook (triggers sample event)
clerk webhooks test <webhook-id> --event user.created

# Available events: user.created, user.updated, user.deleted, organization.created, etc.
```

### Development

```bash
# Start local dev sync (connects CLI to local dev environment)
clerk dev

# This starts the local sync server; press Ctrl+C to stop
```

---

## Usage Patterns

### Inventory: List all apps and their API keys

```bash
#!/bin/bash
echo "=== Clerk Applications Inventory ==="
clerk applications list --format json | jq -r '.[] | "\(.name) (\(.id))"' | while read app; do
  app_id=$(echo "$app" | grep -oP '\(\K[^)]+')
  keys=$(clerk applications show-api-keys "$app_id" --format json)
  echo "App: $app"
  echo "$keys" | jq '.[] | "\(.type): \(.value)"' | head -2
  echo "---"
done
```

### Cleanup: Revoke all sessions for inactive users

```bash
#!/bin/bash
# Get all users and revoke their sessions if last activity > 30 days ago
clerk users export | jq -r '.[] | select(.last_sign_in_at < (now - 2592000)) | .id' | while read uid; do
  clerk sessions list --user-id "$uid" | jq -r '.[] | .id' | xargs -I {} clerk sessions revoke {}
done
```

### Audit: Export users and their organization membership

```bash
#!/bin/bash
clerk users export > users.json
clerk organizations list --format json | jq -r '.[] | .id' | while read org_id; do
  echo "=== Organization: $org_id ==="
  clerk organizations members "$org_id" --format json | jq '.[] | "\(.user_id): \(.role)"'
done
```

### Test webhook before n8n integration

```bash
#!/bin/bash
WEBHOOK_ID="your-webhook-id"

# Test with user.created event
clerk webhooks test "$WEBHOOK_ID" --event user.created

# Wait a moment, then check n8n/webhook server logs
# Expected: HTTP 200 + timestamp in logs
```

---

## Authentication & Multi-Account Support

### Single account (default)

```bash
clerk auth
# Browser opens → log in to Clerk dashboard → credentials cached
```

### Switch accounts

```bash
# Re-run clerk auth to log in as a different user
clerk auth

# The CLI supports one active account; switching logs out the previous user
```

### Verify credentials

```bash
clerk status
# Output: Authenticated as: steve@example.com (account: acct_xxx)
```

---

## Credential Management

**Location:** `~/.clerk.json` (local only, not in git)  
**Format:** Browser OAuth token (no API key)  
**Expiration:** ~30 days of inactivity  
**Refresh:** Automatic on next CLI use  
**Rotation:** N/A (OAuth tokens auto-refresh)  
**Multi-device:** Each device has its own `~/.clerk.json`; no central sync

If credentials become stale or you want to force re-auth:

```bash
rm ~/.clerk.json
clerk auth  # Re-authenticate
```

---

## Integration with n8n

### Webhook testing before deployment

1. Create webhook in Clerk dashboard
2. Point to n8n webhook endpoint
3. Test from CLI:

```bash
WEBHOOK_ID="wh_xxx"
clerk webhooks test "$WEBHOOK_ID" --event user.created
```

4. Check n8n logs for incoming event (should see HTTP 200)

### Programmatic user queries (for workflows)

```bash
# Export users and pipe to n8n or jq
clerk users export | jq '.[] | select(.email_addresses[] | .email_address == "user@example.com")'

# Filter users by metadata
clerk users export | jq '.[] | select(.public_metadata.tier == "premium")'
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Not authenticated" | `~/.clerk.json` missing or expired | Run `clerk auth` |
| "App not found" | Invalid app ID | Check `clerk applications list` for correct ID |
| "Permission denied" | User account lacks required scopes | Log in as account owner via `clerk auth` |
| "Webhook test failed" | Endpoint timeout or unreachable | Verify endpoint URL in dashboard; test with `curl` first |
| "Invalid session ID" | Session doesn't exist or already revoked | Verify session ID from `clerk sessions list` |

---

## Deep Links

- **Clerk Dashboard:** https://dashboard.clerk.com
- **Applications & API Keys:** https://dashboard.clerk.com/apps
- **Webhooks:** https://dashboard.clerk.com/webhooks
- **Users:** https://dashboard.clerk.com/users
- **Clerk API Reference:** https://clerk.com/docs/reference/backend-api
- **Clerk CLI Documentation:** https://clerk.com/docs/cli
- **Sign In & Authentication Flows:** https://dashboard.clerk.com/auth

---

## Quick Access Commands

```bash
# Copy Publishable Key for an app
clerk applications show-api-keys <app-id> --format json | jq -r '.[] | select(.type == "Publishable") | .value' | pbcopy

# Copy Secret Key for an app
clerk applications show-api-keys <app-id> --format json | jq -r '.[] | select(.type == "Secret") | .value' | pbcopy

# Count total users
clerk users export | jq '. | length'

# List users created in last 7 days
clerk users export | jq '.[] | select(.created_at > (now - 604800))'
```

---

## Automation Hooks

If needed, add cron jobs for automated tasks:

```bash
# Daily: export users for backup
0 2 * * * clerk users export > ~/backups/clerk_users_$(date +\%Y\%m\%d).json

# Weekly: revoke expired sessions
0 3 * * 1 clerk sessions revoke-expired

# Monthly: audit org membership changes
0 0 1 * * clerk organizations audit > ~/logs/org_audit_$(date +\%Y\%m).log
```

---

## Related

- **Skill:** `brain/ai/skills/custom/clerk/SKILL.md`
- **Credentials index:** `brain/operations/accounts/credentials-index.md` (Clerk section)
- **Parent guide:** `/brain-universal-capability-install` (how Clerk was installed)
- **Related skills:** `/stripe` (similar CLI pattern), `/whatsapp` (credentials + CLI pattern)
