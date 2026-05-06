# Supabase Runbook

## Purpose
Central reference for database provisioning, workflow, and safety across local and production environments.

**IMPORTANT: Family Finance is local-only and must never use production Supabase.** Family Finance uses only OrbStack PostgreSQL at `localhost:5452/family_finance`. Do not create Family Finance databases on production Supabase.

## Database Architecture

| Environment | Database | Managed by | Connection |
|---|---|---|---|
| **Local** | Plain PostgreSQL in OrbStack | docker-compose | `localhost:544X` (per-app unique port) |
| **Production** | Full self-hosted Supabase (Azure VM vm-supabase) | Dokploy | Tailscale VPN: `100.71.31.88:5433` (canonical; not 10.0.2.4 which is stale) |

## Supabase CLI: Unified Workflow Tool

Supabase CLI is the central tool for both environments:
- **Locally:** Manages migrations and types against plain PostgreSQL
- **Production:** Manages migrations and types against self-hosted Supabase on Azure VM

Use `~/.local/bin/supabase-cli` (not bare `supabase` — that's an SSH alias).

### CLI Status (2026-05-03)

✅ **Supabase CLI is OPERATIONAL**

| Component | Status | Details |
|-----------|--------|---------|
| Binary | ✅ Working | `/Users/Office/.local/bin/supabase-cli` v2.84.2 |
| Self-hosted access | ✅ Working | Connects to production Supabase at 100.71.31.88:5433 |
| Authentication | ✅ Restored | Admin password valid and verified |
| Migration commands | ✅ Working | `migration list`, `migration up`, `migration down` functional |
| Central credential | ✅ Present | `~/.config/supabase/.env` with valid connection string |

### Supabase CLI Reference

**Central credential location:**
```text
~/.config/supabase/.env
```

Expected variables:
```text
SYSTEM_DATABASE_URL="postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres?schema=public"
SUPABASE_HOST="100.71.31.88"
SUPABASE_PORT="5433"
SUPABASE_ADMIN_USER="supabase_admin"
```

**Self-hosted production access pattern (required):**

All commands for production Supabase must use this pattern:

```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli <command> \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
```

**Why `PGSSLMODE=disable`?**
- The self-hosted Supabase instance on Azure does not have TLS configured
- Direct PostgreSQL connections require this flag to bypass TLS verification
- Local OrbStack databases use `PGSSLMODE=disable` for the same reason

**Common commands:**

```bash
# List migrations from production
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"

# Apply pending migrations
PGSSLMODE=disable ~/.local/bin/supabase-cli migration up \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"

# Pull production schema (requires psql)
PGSSLMODE=disable ~/.local/bin/supabase-cli db pull \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
```

**Important notes:**
- Do not echo or print the password in commands
- Use environment variables for credential storage
- Never copy production credentials into scripts or repos
- Supabase Cloud commands (`projects list`, `projects info`) are not configured — they require `SUPABASE_ACCESS_TOKEN` which is only needed if managing Supabase Cloud projects (we use self-hosted only)

## Provisioning a New Application's Local Database

**1. Create the docker-compose.yml:**
```bash
mkdir -p ~/Repos/stevewesthoek/brain/operations/database/standalone/<app-name>
cat > docker-compose.yml << 'EOF'
volumes:
  data:

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: <app-name>
    ports:
      - "544X:5432"  # Choose unique port (5440, 5441, 5442, etc.)
    volumes:
      - data:/var/lib/postgresql/data
EOF
```

**2. Start the database:**
```bash
docker-compose up -d
```

**3. Initialize and apply migrations:**
```bash
cd ~/Repos/prochattools/saas/<app-name>  # (or clients/<app-name>)
~/.local/bin/supabase-cli init
~/.local/bin/supabase-cli migration new initial_schema

# Apply migrations to local database
PGSSLMODE=disable ~/.local/bin/supabase-cli db push \
  --db-url "postgresql://postgres:postgres@localhost:544X/<app-name>"
```

**4. Generate types:**
```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript \
  --db-url "postgresql://postgres:postgres@localhost:544X/<app-name>" \
  > src/types/database.types.ts
```

See `/supabase` skill for detailed unified workflow examples.

## Production Database Management

**From Mac (read-only only):**
```bash
# Inspect schema
PGSSLMODE=disable ~/.local/bin/supabase-cli db diff --db-url "$SUPABASE_DB_URL_READONLY"

# Generate types
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript --db-url "$SUPABASE_DB_URL_READONLY"
```

**Migrations (from Mac):** NEVER. Use the Dokploy build pipeline instead:
- Commit migration file to repo
- Push to GitHub
- Dokploy automatically runs `prebuild-sync.mjs` → `prisma migrate deploy` on deploy

**Database provisioning:** Handled by Dokploy and infrastructure team — not from Mac.

## Safety Checklist

**Before any database operation:**
1. Identify which environment (local or production)
2. Verify connection string — production is `100.71.31.88`, local is `localhost`
3. For production reads only: Use `SUPABASE_DB_URL_READONLY`
4. For migrations: Use `--dry-run` first
5. For local: Safe to reset with `docker-compose down -v`

**Rules:**
- ❌ Never push migrations from Mac to production — use Dokploy
- ❌ Never run `db reset` against production
- ❌ Never commit production DB URLs to repo — store in `~/.zshrc`
- ✅ Always use `~/.local/bin/supabase-cli` (not bare `supabase`)
- ✅ Dry-run before any write operation

## Recovery

**Local database reset:**
```bash
cd ~/Repos/stevewesthoek/brain/operations/database/standalone/<app-name>
docker-compose down -v
docker-compose up -d
# Reapply migrations manually
```

**Production:** Contact Dokploy team or use automated backups (Dokploy manages this).
