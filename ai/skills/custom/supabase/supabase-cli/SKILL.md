---
name: supabase
description: Use when the user asks to manage Supabase — running migrations, generating TypeScript types, diffing schemas, managing local dev stack, or inspecting the self-hosted Supabase instance. Supabase CLI is operational as of 2026-05-03 with restored credentials and verified self-hosted access.
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-db-prod.sh"
          statusMessage: "Checking database context safety..."
---

# Supabase CLI

## STOP — DB Context Check (run before every operation)

Before executing any database command, state this out loud:

> "I am working on **[APP NAME]** — **[LOCAL / PRODUCTION]** database."

Identify the target from the connection string:

| Connection | Environment | Rules |
|---|---|---|
| `localhost:544X` (per-app port) | **LOCAL** | Safe to reset, push, drop |
| `100.71.31.88:5433` (Tailscale VPS) | **PRODUCTION** | Read-only only from Mac; all writes via Dokploy pipeline |
| `$SUPABASE_DB_URL_READONLY` | **PRODUCTION READ-ONLY** | Never pass to write commands |
| `$SUPABASE_DB_URL` | **PRODUCTION WRITE** | Never from Mac — migrations run via Dokploy pipeline only |

**If the target is ambiguous — ask before running anything.**

### Operation risk levels

| Operation | Local | Production |
|---|---|---|
| `migration list`, `db diff`, `gen types` | ✅ proceed | ✅ proceed (read-only) |
| `db push`, `migration apply` | ✅ proceed | 🚫 NEVER (migrations run via Dokploy pipeline only) |
| `db reset` | ✅ proceed | 🚫 NEVER |
| `DROP TABLE/DATABASE`, `TRUNCATE` | ✅ proceed | 🚫 NEVER |
| `prisma db push`, `prisma migrate dev` | ✅ proceed | 🚫 NEVER |

---

## What this skill is for

Supabase CLI is the unified workflow tool for managing databases:
- **Locally:** Against plain PostgreSQL running in OrbStack
- **Production:** Against the self-hosted Supabase instance on Tailscale

Use this skill when:
- Setting up a new application's database workflow
- Running migrations locally or in production
- Generating TypeScript types from the database schema
- Inspecting database schemas and diffing changes
- Managing database versions and upgrades

## Do not use this skill for
- Supabase Cloud management — this setup is self-hosted only
- `supabase login` — Cloud auth, not needed here
- `supabase start` / `supabase stop` — local development uses plain PostgreSQL in OrbStack, not a full Supabase stack
- Edge Functions deployment — Cloud-only feature
- Any write operation against the production database from the Mac

## Safety rules
1. **`SUPABASE_DB_URL_READONLY` is for inspection only.** Never pass it to `db push`, `db reset`, or any write command.
2. **Never run migrations from the Mac against production.** The only migration path to production is the Dokploy build pipeline (`prebuild-sync.mjs` → `prisma migrate deploy`).
3. **Never run `db reset` against production.** It wipes the entire database. Only use it against the local dev stack.
4. **Never commit database credentials.** Keep all DB URLs and service role keys in `~/.zshrc`, never in repo files.
5. **Dry-run before any write.** Use `--dry-run` or `db diff` before `db push` in any context.
6. **Migrations alter schema only.** `prisma migrate deploy` (what runs in production) only changes table structure — it never deletes or overwrites row data.

## Allowed from Mac (read-only against production)

**Status (2026-05-03):** ✅ **All commands verified working**

```bash
# Using admin connection string directly:
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"

PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"

PGSSLMODE=disable ~/.local/bin/supabase-cli db diff \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
```

**Or with environment variables:**
```bash
export SUPABASE_DB_URL_ADMIN="postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list --db-url "$SUPABASE_DB_URL_ADMIN"
```

## Forbidden against production from Mac
```bash
~/.local/bin/supabase-cli db push        # ← NEVER — applies schema changes to production
~/.local/bin/supabase-cli db reset       # ← NEVER — wipes database
prisma db push                           # ← NEVER — bypasses migration files
prisma migrate dev                       # ← NEVER against production (guard script enforces this)
prisma migrate deploy                    # ← NEVER manually — runs only via Dokploy build
```

## CLI path
```bash
~/.local/bin/supabase-cli   # use this — 'supabase' in shell is aliased to ssh supabase (VPS shortcut)
```
Always call the CLI via `~/.local/bin/supabase-cli` or `/opt/homebrew/bin/supabase` to avoid the alias conflict.

## Self-hosted connection

Reachable directly from the Mac via Tailscale — no tunnel or subnet routing needed.

| Endpoint | Address |
|---|---|
| PostgreSQL | `100.71.31.88:5433` |
| Supabase API | `http://100.71.31.88:8000` |
| Tailscale IP (Dokploy) | `100.71.47.24` (`dokploy-aws`; former Azure `100.83.38.48` is decommissioned) |

**Central credential location:**
```text
~/.config/supabase/.env
```

Contains:
```bash
SYSTEM_DATABASE_URL="postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres?schema=public"
SUPABASE_HOST="100.71.31.88"
SUPABASE_PORT="5433"
SUPABASE_ADMIN_USER="supabase_admin"
```

**Required environment variable for CLI:**
```bash
export PGSSLMODE=disable   # REQUIRED — Supabase CLI ignores sslmode in connection string, needs this env var
```

**Important:** Do not copy passwords into shell profiles (`~/.zshrc`). Instead:
1. Use `PGSSLMODE=disable ~/.local/bin/supabase-cli` with direct connection string, OR
2. Store connection string securely and load from `~/.config/supabase/.env` as needed

**Credentials source:** Central `~/.config/supabase/.env` file (updated 2026-05-03 with valid password)

Note: `10.0.2.4` is the internal LAN IP — only reachable from the Dokploy machine. Always use `100.71.31.88` from the Mac.

## Unified database workflow — local development

For a new application stored at `~/Repos/prochattools/saas/myapp/`:

**1. Initialize Supabase config:**
```bash
cd ~/Repos/prochattools/saas/myapp
~/.local/bin/supabase-cli init
```

**2. Start the local database (OrbStack):**
```bash
cd ~/Repos/stevewesthoek/brain/operations/database/standalone/myapp
docker-compose up -d
# Get the local connection string from docker-compose.yml
```

**3. Create and apply migrations:**
```bash
cd ~/Repos/prochattools/saas/myapp

# Create new migration
~/.local/bin/supabase-cli migration new create_users_table

# Apply to local database
PGSSLMODE=disable ~/.local/bin/supabase-cli db push --db-url "postgresql://postgres:postgres@localhost:5445/myapp"
```

**4. Generate TypeScript types:**
```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript \
  --db-url "postgresql://postgres:postgres@localhost:5445/myapp" \
  > src/types/database.types.ts
```

**5. When ready for production:**
- Migrations go through the Dokploy build pipeline (`prebuild-sync.mjs`)
- Never push migrations from your Mac to production directly
- Use `SUPABASE_DB_URL_READONLY` for read-only inspection only

## Example commands

**Local development:**
```bash
# Version
~/.local/bin/supabase-cli --version

# Schema diff against local database
PGSSLMODE=disable ~/.local/bin/supabase-cli db diff --db-url "postgresql://postgres:postgres@localhost:5445/myapp"

# Push pending migrations to local database
PGSSLMODE=disable ~/.local/bin/supabase-cli db push --db-url "postgresql://postgres:postgres@localhost:5445/myapp"

# Generate TypeScript types from local database
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript --db-url "postgresql://postgres:postgres@localhost:5445/myapp"

# Create a new migration file
~/.local/bin/supabase-cli migration new <migration-name>

# List applied migrations on local database
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list --db-url "postgresql://postgres:postgres@localhost:5445/myapp"
```

**Production (read-only from Mac) — Status: ✅ VERIFIED WORKING (2026-05-03):**
```bash
# Schema diff against production (read-only)
PGSSLMODE=disable ~/.local/bin/supabase-cli db diff \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"

# Generate TypeScript types from production (read-only)
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"

# List applied migrations on production (verified working)
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
```

## Environment architecture
| Environment | Database | Managed by | What runs here |
|---|---|---|---|
| Local | PostgreSQL (plain, localhost:544X per-app) | OrbStack (docker-compose container) | PostgreSQL only; Supabase CLI tools for migrations/types |
| Production | PostgreSQL (Supabase-managed) | VPS at 100.71.31.88:5433 | Full self-hosted Supabase instance (auth, storage, API, etc.) |

**Local development does not run a full Supabase stack.** The Supabase CLI is a tool for managing schemas against any PostgreSQL — it does not require or run the Supabase server locally.

**To manage local PostgreSQL:**
- Start/stop container: See `/orbstack` skill for docker-compose commands
- Run migrations: Use `~/.local/bin/supabase-cli` with `--db-url` pointing to local postgres on unique per-app port
- Generate types: Use `~/.local/bin/supabase-cli gen types typescript --db-url`

## CLI Status & Reference

**Status (2026-05-03):** ✅ **Operational**
- Binary: `~/.local/bin/supabase-cli` v2.84.2
- Authentication: ✅ Restored (admin password valid)
- Production access: ✅ Verified working
- Central credentials: `~/.config/supabase/.env`

**Installation & Upgrades:**
- CLI installed at: `/opt/homebrew/bin/supabase` (via `brew install supabase/tap/supabase`)
- Stable symlink: `~/.local/bin/supabase-cli`
- Upgrade: `brew upgrade supabase/tap/supabase`
- New version available: v2.95.4 (optional)

**Infrastructure:**
- Production Tailscale IP: `100.71.31.88` (PostgreSQL :5433, API :8000)
- Database connection: Requires `PGSSLMODE=disable` (TLS not configured on self-hosted)
- No Supabase Cloud account required for any self-hosted operation

**Documentation:**
- Runbook: `operations/runbooks/supabase.md`
- CLI diagnostics: `operations/infrastructure/CLI_ACCESS_REPAIR.md`
- Family Finance constraint: Local-only; production Supabase verified empty of Family Finance
