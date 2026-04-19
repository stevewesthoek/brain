# Supabase Runbook

## Purpose
Safe access to Supabase — both local development (OrbStack) and production (self-hosted).

## Two environments

### Local Development (OrbStack)
**Database:** Plain PostgreSQL container in OrbStack (typically port 54XX per project)
**What runs:** PostgreSQL only; Supabase CLI is a tool, not a server
**Managed by:** OrbStack (see `/orbstack` skill)
**Safe operations:** Reset, push migrations, drop tables, truncate
**Do not do:** Leave unattended; it's for development only

**Start local PostgreSQL:**
```bash
cd ~/Repos/stevewesthoek/brain/operations/database/standalone/<app-name>
docker-compose up -d
```

**Reset completely (wipe all data):**
```bash
docker-compose down -v
docker-compose up -d
```

**Migrations (local):**
```bash
PGSSLMODE=disable supabase db push --db-url "postgresql://supabase:supabase@localhost:5433/postgres"
```

### Production (Self-Hosted Supabase)
**Database:** Full Supabase server on VPS (100.71.31.88:5433 + API at :8000)
**Managed by:** Dokploy, never manually from Mac
**What runs:** Full Supabase stack (Auth, PostgreSQL, Storage, API, etc.)
**Safe operations (Mac read-only):** Schema read, type generation, dry-run migrations
**Never do:** Push migrations, reset, or delete data from Mac

**Read-only access (Mac):**
```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript --db-url "$SUPABASE_DB_URL_READONLY"
PGSSLMODE=disable ~/.local/bin/supabase-cli db diff --db-url "$SUPABASE_DB_URL_READONLY"
```

**Migrations (production):** Always via `prebuild-sync.mjs` + Dokploy build pipeline — never from Mac.

## Production safety checklist
- Use `SUPABASE_DB_URL_READONLY` for reads only
- Always use `--dry-run` before any write
- Never run `db reset` against production
- Keep all DB URLs in `~/.zshrc`, never in repo files
- Check the connection string BEFORE running any command
- For detailed rules, see `/supabase` skill

## Rollback
- Local: `docker-compose down -v` then restart
- Production: Restore from backup (contact Dokploy team)
