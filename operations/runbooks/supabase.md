# Supabase Runbook

## Purpose
Safe access to Supabase — both local development (OrbStack) and production (self-hosted).

## Two environments

### Local Development (OrbStack)
**Database:** PostgreSQL in docker-compose container on localhost:5433
**Managed by:** OrbStack (see `/orbstack` skill)
**Safe operations:** Reset, push migrations, drop tables, truncate
**Do not do:** Leave unattended; it's for development only

**Start local Supabase:**
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

### Production (Self-Hosted)
**Database:** PostgreSQL on VPS, reachable via Tailscale (100.71.31.88:5433)
**Managed by:** Dokploy, never manually
**Safe operations:** Schema read, type generation, dry-run migrations
**Never do:** Push migrations, reset, or delete data from Mac

**Read-only access (Mac):**
```bash
PGSSLMODE=disable supabase gen types typescript --db-url "$SUPABASE_DB_URL_READONLY"
PGSSLMODE=disable supabase db diff --db-url "$SUPABASE_DB_URL_READONLY"
```

**Migrations (production):** Always via `prebuild-sync.mjs` + Dokploy build pipeline.

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
