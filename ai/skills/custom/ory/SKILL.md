---
name: ory
description: Ory Kratos CLI — self-hosted authentication platform for prochat.tools and future domains with full automation
---

# Ory Authentication Platform

## What it is

**Ory** is a self-hosted, open-source authentication and identity platform. Unlike SaaS solutions (Clerk, Auth0), Ory runs on your infrastructure and can auto-provision authentication for unlimited domains.

**Key features:**
- ✅ Self-hosted (Docker on Dokploy)
- ✅ Multi-domain support (one instance, many projects)
- ✅ Programmatic provisioning (CLI + API)
- ✅ Full user lifecycle management
- ✅ Email verification, password recovery, MFA
- ✅ Session management via HTTP cookies
- ✅ Open-source (Apache 2.0)

## When to use

- **Primary authentication** for prochat.tools (live since 2026-04-12)
- **Adding new domains** — auto-provision via Ory CLI (no manual setup)
- **User management** — list, create, update, delete users programmatically
- **Session management** — inspect, revoke active sessions
- **Webhook integration** — n8n workflows for user events

## Installation & Setup

**Already installed:**
```bash
ory version  # v1.3.0
```

**Configuration:**
```bash
source ~/.config/ory/.env
ory list projects  # List all projects (domains)
```

## Common Commands

### Projects (Domains)

```bash
# Create a new project for a domain
ory create project --name "another-domain.com"

# List all projects
ory list projects

# Get project details
ory get project <project-id>

# Set default project
export ORY_PROJECT_ID=<project-id>
```

### Users

```bash
# Create a user
ory create identity \
  --project <project-id> \
  --schema-id default \
  --trait email=user@example.com \
  --trait name.first="John" \
  --trait name.last="Doe"

# List users in a project
ory list identities --project <project-id>

# Get user details
ory get identity <user-id> --project <project-id>

# Delete user
ory delete identity <user-id> --project <project-id>

# Export all users
ory list identities --project <project-id> --format json > users_export.json
```

### Sessions

```bash
# List active sessions
ory list sessions --project <project-id>

# Get session details
ory get session <session-id> --project <project-id>

# Revoke session
ory delete session <session-id> --project <project-id>
```

### Email & Recovery

```bash
# Send recovery email to user
ory send-recovery-email --project <project-id> --email user@example.com

# List recovery codes
ory list recovery-codes --project <project-id> --user <user-id>
```

## Auto-Provisioning for New Domains

**The entire point of Ory:**

```bash
#!/bin/bash
# Auto-provision a new domain

NEW_DOMAIN="$1"  # e.g., another-domain.com

# 1. Create Ory project for the domain
ory create project --name "$NEW_DOMAIN"

# 2. Get project ID
PROJECT_ID=$(ory list projects --format json | jq -r ".[] | select(.name == \"$NEW_DOMAIN\") | .id")

# 3. Save to .env
echo "ORY_PROJECT_ID=$PROJECT_ID" >> ~/.config/ory/projects.env

# 4. Done! Now users can auth at:
#    https://auth.prochat.tools/?project=$PROJECT_ID
echo "✅ Project created: $NEW_DOMAIN (ID: $PROJECT_ID)"
```

## Credential Storage & Rotation

**Location:** `~/.config/ory/.env` (gitignored, mode 600)  
**Database:** Supabase PostgreSQL (`ory_prod`)  
**Deployment:** Dokploy (Ops project)  
**URL:** https://auth.prochat.tools  
**Admin URL:** https://auth-admin.prochat.tools  

**Credentials:**
- `ORY_DATABASE_URL` — PostgreSQL connection (read-only here, actual secrets in `.env`)
- `ORY_ADMIN_API_KEY` — For CLI/API access
- Project IDs — Auto-generated for each domain

## Architecture

```
Internet
  ↓
Cloudflare (auth.prochat.tools tunnel)
  ↓
Dokploy (port 4433/4434)
  ↓
Ory Container
  ↓
Supabase PostgreSQL (ory_prod)
```

## Integration with Applications

### Next.js / React

```typescript
// Auth URL
const ORY_PUBLIC_URL = 'https://auth.prochat.tools'

// Redirect to login
window.location.href = `${ORY_PUBLIC_URL}/self-service/login/browser?return_to=${window.location.origin}`

// Get current session
fetch(`${ORY_PUBLIC_URL}/sessions/whoami`, {
  credentials: 'include'
}).then(r => r.json())
```

### n8n Webhooks

```
Webhook URL: https://auth.prochat.tools/events
Events: user.created, user.updated, user.deleted, session.created, session.deleted
```

## Automation Patterns

### Daily user export (backup)
```bash
#!/bin/bash
BACKUP_DIR=~/Backups/ory
mkdir -p $BACKUP_DIR
ory list identities --project <project-id> --format json > $BACKUP_DIR/users_$(date +%Y%m%d).json
```

### Bulk user creation
```bash
#!/bin/bash
while IFS=, read email first last; do
  ory create identity \
    --project <project-id> \
    --schema-id default \
    --trait email=$email \
    --trait name.first="$first" \
    --trait name.last="$last"
done < users.csv
```

### Auto-provision domain (CI/CD)
```bash
#!/bin/bash
# Called from GitHub Actions on new domain creation
NEW_DOMAIN="$1"
ory create project --name "$NEW_DOMAIN"
echo "Domain $NEW_DOMAIN ready at: https://auth.prochat.tools"
```

## Migration from Clerk

**Fallback:** Clerk still operates for legacy apps  
**Plan:** One-by-one migration (prochat.tools first)  
**Process:**
1. Export Clerk users: `clerk-env ~/bin/clerk api "/v1/users" > clerk_users.json`
2. Transform to Ory schema
3. Import to Ory: `ory bulk create identities --project <id> < users.jsonl`
4. Test auth flows
5. Switch app to Ory

**Status:** Clerk remains active; no rush to migrate

## Deep Links

- **Ory Docs:** https://www.ory.sh/docs
- **Ory CLI Reference:** https://www.ory.sh/docs/cli
- **Ory API Reference:** https://www.ory.sh/docs/apis
- **GitHub:** https://github.com/ory/kratos
- **Admin Dashboard:** https://auth-admin.prochat.tools (when configured)

## Related

- **Runbook:** `operations/runbooks/ory-cli.md`
- **Credentials:** `operations/accounts/credentials-index.md` (Ory section)
- **Deployment:** `operations/infrastructure/ory-deployment-plan.md`
- **Quick Reference:** `operations/runbooks/ory-quick-reference.md`
- **Fallback:** `/clerk` (legacy authentication)
