# Supabase Runbook

## Purpose
Central reference for database provisioning, workflow, and safety across local and production environments.

## Database Architecture

| Environment | Database | Managed by | Connection |
|---|---|---|---|
| **Local** | Plain PostgreSQL in OrbStack | docker-compose | `localhost:544X` (per-app unique port) |
| **Production** | Full self-hosted Supabase | Dokploy | Tailscale VPN: `100.71.31.88:5433` |

## Supabase CLI: Unified Workflow Tool

Supabase CLI is the central tool for both environments:
- **Locally:** Manages migrations and types against plain PostgreSQL
- **Production:** Manages migrations and types against full Supabase

Use `~/.local/bin/supabase-cli` (not bare `supabase` — that's an SSH alias).

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
