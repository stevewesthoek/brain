# Ory Authentication Platform Runbook

Complete reference for managing Ory self-hosted authentication on prochat.tools infrastructure.

## Overview

- **CLI:** `ory` (installed via Homebrew v1.3.0)
- **Deployment:** Dokploy (Ops project)
- **URL:** https://auth.prochat.tools (public API)
- **Admin URL:** https://auth-admin.prochat.tools (admin API)
- **Database:** Supabase PostgreSQL (ory_prod, user: ory_user)
- **Status:** ✅ Production (live 2026-04-12)

## Quick Start

```bash
# Load credentials
source ~/.config/ory/.env

# List all projects (domains)
ory list projects

# List users in a project
ory list identities --project <project-id>
```

## Projects (Domains)

### Create a new project (auto-provision domain)

```bash
ory create project --name "another-domain.com"
# Returns: Project ID

# Save to .env for future reference
echo "PROJECT_ANOTHER_DOMAIN=<project-id>" >> ~/.config/ory/projects.env
```

### List all projects

```bash
ory list projects --format json | jq '.[] | {id, name, created_at}'
```

### Get project details

```bash
ory get project <project-id>
```

### Delete project

```bash
ory delete project <project-id>
```

## Users (Identities)

### Create user

```bash
ory create identity \
  --project <project-id> \
  --schema-id default \
  --trait email=user@example.com \
  --trait name.first="John" \
  --trait name.last="Doe" \
  --trait role="user"
```

### List users

```bash
# All users in project
ory list identities --project <project-id>

# Export to JSON
ory list identities --project <project-id> --format json > users.json

# Search by email
ory list identities --project <project-id> --format json | jq '.[] | select(.traits.email == "user@example.com")'
```

### Get user

```bash
ory get identity <user-id> --project <project-id>
```

### Update user

```bash
ory patch identity <user-id> --project <project-id> \
  --trait email=newemail@example.com \
  --trait name.first="Jane"
```

### Delete user

```bash
ory delete identity <user-id> --project <project-id>
```

## Sessions

### List active sessions

```bash
ory list sessions --project <project-id>

# Export to JSON
ory list sessions --project <project-id> --format json > sessions.json
```

### Get session

```bash
ory get session <session-id> --project <project-id>
```

### Revoke session

```bash
ory delete session <session-id> --project <project-id>
```

### List user's sessions

```bash
ory list sessions --project <project-id> --format json | jq ".[] | select(.identity.id == \"<user-id>\")"
```

## Recovery & Verification

### Send recovery email

```bash
ory send-recovery-email --project <project-id> --email user@example.com
```

### Resend verification email

```bash
ory send-verification-email --project <project-id> --email user@example.com
```

### List recovery codes

```bash
ory list recovery-codes --project <project-id> --user <user-id>
```

## Bulk Operations

### Export all users (backup)

```bash
#!/bin/bash
PROJECT_ID="<project-id>"
BACKUP_DIR=~/Backups/ory
mkdir -p $BACKUP_DIR

ory list identities --project $PROJECT_ID --format json > $BACKUP_DIR/users_$(date +%Y%m%d_%H%M%S).json
echo "✅ Users exported to $BACKUP_DIR/users_$(date +%Y%m%d_%H%M%S).json"
```

### Bulk create users (from CSV)

```bash
#!/bin/bash
PROJECT_ID="<project-id>"

# CSV format: email,first_name,last_name
while IFS=, read email first last; do
  ory create identity \
    --project $PROJECT_ID \
    --schema-id default \
    --trait email="$email" \
    --trait name.first="$first" \
    --trait name.last="$last"
  echo "✅ Created: $email"
done < users.csv
```

### Bulk update role (add admin role)

```bash
#!/bin/bash
PROJECT_ID="<project-id>"
ADMIN_EMAILS=("admin1@example.com" "admin2@example.com")

for email in "${ADMIN_EMAILS[@]}"; do
  USER=$(ory list identities --project $PROJECT_ID --format json | jq -r ".[] | select(.traits.email == \"$email\") | .id")
  ory patch identity $USER --project $PROJECT_ID --trait role="admin"
  echo "✅ Updated $email to admin"
done
```

## Auto-Provisioning Script

```bash
#!/bin/bash
# Auto-provision a new domain with Ory

NEW_DOMAIN="$1"

if [ -z "$NEW_DOMAIN" ]; then
  echo "Usage: $0 <domain.com>"
  exit 1
fi

echo "Auto-provisioning Ory for $NEW_DOMAIN..."

# 1. Create project
PROJECT=$(ory create project --name "$NEW_DOMAIN" --format json)
PROJECT_ID=$(echo "$PROJECT" | jq -r '.id')

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Failed to create project"
  exit 1
fi

echo "✅ Project created: $PROJECT_ID"

# 2. Save to .env
echo "ORY_PROJECT_$(echo $NEW_DOMAIN | tr '.' '_' | tr '-' '_' | tr '[:lower:]' '[:upper:]')=$PROJECT_ID" >> ~/.config/ory/projects.env

# 3. Create initial admin user
ADMIN_EMAIL="admin@$NEW_DOMAIN"
ory create identity \
  --project $PROJECT_ID \
  --schema-id default \
  --trait email="$admin_email" \
  --trait name.first="Admin" \
  --trait role="admin"

echo "✅ Admin user created: $ADMIN_EMAIL"

echo ""
echo "=== DOMAIN READY ==="
echo "Domain: $NEW_DOMAIN"
echo "Project ID: $PROJECT_ID"
echo "Auth URL: https://auth.prochat.tools?project=$PROJECT_ID"
echo "Admin Email: $ADMIN_EMAIL"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `command not found: ory` | `ory` not in PATH; run `brew install ory/tap/cli` |
| `No project found` | Check PROJECT_ID is correct: `ory list projects` |
| `Database connection failed` | Verify `~/.config/ory/.env` has correct credentials |
| `Permission denied` | Check CLI is authenticated: `ory auth` |

## Integration with Applications

### Environment variables (add to app .env)

```bash
# Public auth endpoint
NEXT_PUBLIC_ORY_PUBLIC_URL=https://auth.prochat.tools

# Admin API (backend only)
ORY_ADMIN_URL=https://auth-admin.prochat.tools
ORY_ADMIN_API_KEY=<key-from-credentials>

# Project ID
ORY_PROJECT_ID=<project-id>
```

### Next.js middleware (protect routes)

```typescript
// middleware.ts
import { getSession } from '@ory/client'

export async function middleware(req: NextRequest) {
  const session = await getSession({
    basePath: 'https://auth.prochat.tools',
    cookie: req.headers.get('cookie')
  })

  if (!session) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_ORY_PUBLIC_URL}/login`)
  }

  return NextResponse.next()
}
```

## Automation (n8n Integration)

### Trigger: New user created

```
Webhook URL: https://auth.prochat.tools/webhooks/user.created
Headers: Authorization: Bearer <api-key>
Body: { user: {...}, project_id: "..." }
```

### Action: Export user data

```bash
ory list identities --project <project-id> --format json | jq '.[]' > users_for_crm.json
```

## Credentials & Secrets

**Storage:** `~/.config/ory/.env` (mode 600, gitignored)  
**Backup:** `~/.config/ory/projects.env` (project ID map)

**Rotation:**
- Never share credentials
- Rotate API keys if compromised
- Database credentials: managed by Supabase

## Deep Links

- **Ory Documentation:** https://www.ory.sh/docs
- **Ory CLI Guide:** https://www.ory.sh/docs/cli
- **Ory API Reference:** https://www.ory.sh/docs/apis
- **GitHub:** https://github.com/ory/kratos
- **Community:** https://community.ory.sh

## Related Documentation

- **Skill:** `brain/ai/skills/custom/ory/SKILL.md`
- **Credentials:** `operations/accounts/credentials-index.md` (Ory section)
- **Deployment:** `operations/infrastructure/ory-deployment-plan.md`
- **Clerk (fallback):** `operations/runbooks/clerk-cli.md`
