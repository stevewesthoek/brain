# Clerk CLI Quick Reference

**Status:** ✅ Fully operational  
**Keys:** Live API keys verified  
**Helper:** `clerk-env` script automates credential loading

---

## TL;DR — Copy/Paste Commands

```bash
# Load credentials and list all users
clerk-env ~/bin/clerk api "/v1/users" | jq '.[]' | head -20

# Export all users to JSON
clerk-env ~/bin/clerk api "/v1/users" > ~/Desktop/clerk_users_export.json

# Get user count
clerk-env ~/bin/clerk api "/v1/users" | jq '. | length'

# Find user by email
clerk-env ~/bin/clerk api "/v1/users" | jq '.[] | select(.email_addresses[].email_address == "user@example.com")'

# List all sessions
clerk-env ~/bin/clerk api "/v1/sessions"

# Revoke session by ID (replace SESSION_ID)
clerk-env ~/bin/clerk api -X DELETE "/v1/sessions/SESSION_ID"

# List webhooks
clerk-env ~/bin/clerk api "/v1/webhooks"

# Create test webhook event
# (Use dashboard → Webhooks → Manual Test instead)
```

---

## Credentials Location

```
~/.config/clerk/.env
├── CLERK_SECRET_KEY=sk_live_*
└── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_*
```

Never commit this file — it's gitignored ✓

---

## Helper Script Usage

```bash
# Option A: Run command with credentials
clerk-env ~/bin/clerk api "/v1/users"

# Option B: Load environment, then use commands
source <(clerk-env)
~/bin/clerk api "/v1/users"
```

---

## Common API Endpoints

| Endpoint | What it does |
|----------|--------------|
| `GET /v1/users` | List all users |
| `GET /v1/users/{id}` | Get specific user |
| `PATCH /v1/users/{id}` | Update user |
| `DELETE /v1/users/{id}` | Delete user |
| `GET /v1/sessions` | List sessions |
| `DELETE /v1/sessions/{id}` | Revoke session |
| `GET /v1/webhooks` | List webhooks |
| `POST /v1/webhooks` | Create webhook |
| `GET /v1/templates` | List email templates |
| `GET /v1/organizations` | List organizations (if enabled) |

Full API reference: https://clerk.com/docs/reference/backend-api

---

## Automation Examples

### Daily user export (backup)
```bash
#!/bin/bash
BACKUP_DIR=~/Backups/clerk
mkdir -p $BACKUP_DIR
clerk-env ~/bin/clerk api "/v1/users" > $BACKUP_DIR/users_$(date +%Y%m%d).json
echo "✓ Users exported to $BACKUP_DIR/users_$(date +%Y%m%d).json"
```

### Add to crontab for daily backups
```bash
0 2 * * * clerk-env ~/bin/clerk api "/v1/users" > ~/Backups/clerk/users_$(date +\%Y\%m\%d).json
```

### Count users
```bash
clerk-env ~/bin/clerk api "/v1/users" | jq 'length'
```

### Find recently created users (last 7 days)
```bash
clerk-env ~/bin/clerk api "/v1/users" | jq '.[] | select(.created_at > (now - 604800))' | jq '{email: .email_addresses[0].email_address, created: .created_at}'
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `command not found: clerk-env` | Reload shell: `source ~/.zshrc` or restart terminal |
| `No such file: ~/.config/clerk/.env` | File should exist with your API keys |
| `Unauthorized (403)` | Check API key is correct and not expired in dashboard |
| `Invalid numeric literal` | Some outputs aren't JSON — remove `\| jq` |

---

## Next: n8n Integration

Use these API endpoints in n8n HTTP Request nodes:

```
Base URL: https://api.clerk.com
Headers: Authorization: Bearer sk_live_*

GET /v1/users
GET /v1/sessions
POST /v1/webhooks
```

See: `operations/runbooks/clerk-cli.md` for full webhook testing guide.

---

## Key Links

- **Dashboard:** https://dashboard.clerk.com
- **API Docs:** https://clerk.com/docs/reference/backend-api
- **API Keys:** https://dashboard.clerk.com/apps → Select app → API Keys
