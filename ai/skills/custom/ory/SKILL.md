---
name: ory
description: "Ory Kratos self-hosted authentication platform. Manage identities, sessions, recovery, and verification via CLI. Primary auth for prochat.tools infrastructure."
---

# Ory Authentication Platform

Self-hosted Ory Kratos v1.3.1 running at `https://auth.prochat.tools`.

## What it is

Primary authentication platform for prochat.tools and all sub-products. Handles:
- User registration, login, logout
- Email verification and account recovery
- TOTP (2FA) and code-based auth
- Session management
- Admin API for user/identity management

## When to use

- Creating or managing users across prochat.tools products
- Adding authentication to a new project
- Debugging login or registration issues
- Bulk user operations, identity exports
- Provisioning new projects/domains

## How to use

```bash
# Load credentials (has ORY_ADMIN_URL, ORY_PROJECT_ID, etc.)
source ~/.config/ory/.env

# CLI is the ory binary (Homebrew v1.3.0)
ory list projects
ory list identities --project <project-id>
```

## Key URLs

- **Public API:** `https://auth.prochat.tools` (login, register, verification)
- **Admin API:** `https://auth-admin.prochat.tools` (identity management)
- **Health check:** `https://auth.prochat.tools/health/ready`

## Deployment

- **Platform:** Dokploy (Ops project), compose ID `DpMDhd91-YVUbHCxTD3Mx`
- **Image:** `oryd/kratos:v1.3.1`
- **Config:** Docker named volume `ory-config` (server: `/var/lib/docker/volumes/ory-config`)
- **Database:** Supabase PostgreSQL — `ory_prod` at `10.0.2.4:5433` (isolated from Dokploy DB)
- **Tunnel:** Cloudflare tunnel `dc7bb87e` routes `auth.prochat.tools` → `localhost:80` → Traefik → Ory port 4433

## Credentials

Stored at `~/.config/ory/.env` (gitignored, mode 600).
Reference the credentials-index at `operations/accounts/credentials-index.md` (Ory section).

## Common operations

```bash
# List users
ory list identities --project <project-id>

# Create user
ory create identity --project <project-id> \
  --schema-id default \
  --trait email=user@example.com

# Get identity
ory get identity <identity-id> --project <project-id>

# Delete identity
ory delete identity <identity-id> --project <project-id>

# List active sessions
ory list sessions --project <project-id>
```

## Runbook

Full operational reference: `brain/operations/runbooks/ory-cli.md`

## Notes

- The `ory-config` Docker volume stores `kratos.yml` and `identity.schema.json`
- To update config: modify files in the volume via alpine container, then `docker restart ory-kratos`
- The Cloudflare tunnel ingress rule for `auth.prochat.tools` must be present in the `dc7bb87e` tunnel
- Ory is the PRIMARY auth provider; Clerk is legacy/fallback only
